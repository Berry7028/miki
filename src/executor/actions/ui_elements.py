"""UI要素の取得と操作"""
import subprocess
import json
import time
import pyautogui

from actions.clipboard_utils import copy_text


def _type_text(text):
    """
    テキストを入力する（クリップボード経由でより確実に）
    Note: This is duplicated from mouse_keyboard to avoid circular dependency
    """
    # 特殊な文字や日本語入力の不安定さを避けるため、クリップボード経由での貼り付けを試みる
    copy_result = copy_text(text)
    if copy_result["status"] == "success":
        try:
            # command + v で貼り付け
            pyautogui.hotkey('command', 'v')
            # クリップボードを元に戻す（オプション）
            time.sleep(0.1)
            return {"status": "success", "method": copy_result["method"]}
        except Exception as e:
            return {"status": "error", "message": f"Failed to paste text: {str(e)}"}

    # クリップボードが使えない場合は通常のタイピング
    try:
        pyautogui.write(text, interval=0.05)
        return {"status": "success", "method": "write"}
    except Exception as e:
        return {"status": "error", "message": f"Failed to type text: {str(e)}"}


def get_ui_elements(app_name):
    """
    AppleScriptのGUI Scriptingを使用して、指定されたアプリのGUI要素一覧を効率的に取得する。
    entire contentsを使用せず、一括プロパティ取得を利用することで高速化。
    """
    script = f'''
    tell application "System Events"
        if not (exists application process "{app_name}") then return "ERROR: Process not found"
        tell application process "{app_name}"
            set elements_data to {{}}
            repeat with win in windows
                try
                    -- ウィンドウ自身の情報
                    set {{r, n, p, s}} to {{role, name, position, size}} of win
                    if n is missing value then set n to ""
                    set end of elements_data to r & "|" & n & "|" & (item 1 of p) & "," & (item 2 of p) & "|" & (item 1 of s) & "," & (item 2 of s)

                    -- ウィンドウ直下の子要素を一括取得
                    set children to UI elements of win
                    set {{rs, ns, ps, ss}} to {{role, name, position, size}} of UI elements of win

                    repeat with i from 1 to count of rs
                        set n_val to item i of ns
                        if n_val is missing value then set n_val to ""
                        set end of elements_data to (item i of rs) & "|" & n_val & "|" & (item 1 of item i of ps) & "," & (item 2 of item i of ps) & "|" & (item 1 of item i of ss) & "," & (item 2 of item i of ss)

                        -- さらにその下 (ボタンやテキストフィールドを拾うため。3階層目まで)
                        try
                            set subchildren to UI elements of (item i of children)
                            if (count of subchildren) > 0 then
                                set {{rrs, nns, pps, sss}} to {{role, name, position, size}} of subchildren
                                repeat with j from 1 to count of rrs
                                    set nn to item j of nns
                                    if nn is missing value then set nn to ""
                                    set end of elements_data to (item j of rrs) & "|" & nn & "|" & (item 1 of item j of pps) & "," & (item 2 of item j of pps) & "|" & (item 1 of item j of sss) & "," & (item 2 of item j of sss)
                                end repeat
                            end if
                        end try
                    end repeat
                end try
            end repeat
            return elements_data
        end tell
    end tell
    '''
    try:
        result = subprocess.run(
            ['osascript', '-e', script], capture_output=True, text=True)
        if result.returncode == 0:
            output = result.stdout.strip()
            if output.startswith("ERROR"):
                return {"status": "error", "message": output}
            # osascriptの戻り値はカンマ区切り
            if not output:
                return {"status": "success", "elements": []}
            elements = output.split(", ")
            return {"status": "success", "elements": elements}
        else:
            return {"status": "error", "message": result.stderr.strip()}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def get_ui_elements_json(app_name, max_depth=3):
    """
    UI要素をJSON形式で詳細に取得（JXA使用）
    properties()とactions()を使って、UI要素の詳細情報を再帰的に取得する
    """
    jxa_script = f'''
    ObjC.import('stdlib');

    const se = Application("System Events");
    if (!se.processes["{app_name}"].exists()) {{
      JSON.stringify({{ error: "Process not found" }});
    }} else {{
      const proc = se.processes["{app_name}"];

      function inspectElement(elem, depth) {{
        if (depth > {max_depth}) return null;

        try {{
          const props = elem.properties();
          const result = {{
            role: props.role,
            roleDescription: props.roleDescription || "",
            name: props.name || props.title || "",
            description: props.description || "",
            value: props.value || null,
            position: props.position ? [props.position[0], props.position[1]] : [0, 0],
            size: props.size ? [props.size[0], props.size[1]] : [0, 0],
            enabled: props.enabled !== undefined ? props.enabled : true,
            focused: props.focused || false,
            selected: props.selected || false,
            actions: [],
            subrole: props.subrole || "",
            children: []
          }};

          // アクション一覧を取得
          try {{
            const actions = elem.actions();
            result.actions = actions.map(a => a.name());
          }} catch (e) {{}}

          // 子要素取得（depth制限）
          if (depth < {max_depth}) {{
            try {{
              const children = elem.uiElements();
              result.children = children.map(child => inspectElement(child, depth + 1))
                                       .filter(c => c !== null);
            }} catch (e) {{}}
          }}

          return result;
        }} catch (e) {{
          return null;
        }}
      }}

      const windows = proc.windows();
      const result = windows.map(win => inspectElement(win, 0)).filter(w => w !== null);
      JSON.stringify({{ windows: result }});
    }}
    '''

    try:
        result = subprocess.run(
            ['osascript', '-l', 'JavaScript', '-e', jxa_script],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            data = json.loads(result.stdout.strip())
            return {"status": "success", "ui_data": data}
        else:
            return {"status": "error", "message": result.stderr.strip()}
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "UI要素取得がタイムアウトしました（10秒以上）"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def click_element(app_name, role, name):
    """
    UI要素をroleとnameで検索してクリック
    """
    jxa_script = f'''
    const se = Application("System Events");
    const proc = se.processes["{app_name}"];

    function findElement(root, role, name) {{
      try {{
        const elements = root.entireContents();
        for (let i = 0; i < elements.length; i++) {{
          const elem = elements[i];
          try {{
            const props = elem.properties();
            if (props.role === role && (props.name === name || props.title === name)) {{
              return elem;
            }}
          }} catch (e) {{}}
        }}
      }} catch (e) {{}}
      return null;
    }}

    if (proc.windows.length === 0) {{
      "ERROR: No windows found";
    }} else {{
      const elem = findElement(proc.windows[0], "{role}", "{name}");
      if (elem !== null) {{
        elem.click();
        "success";
      }} else {{
        "ERROR: Element not found";
      }}
    }}
    '''

    try:
        result = subprocess.run(
            ['osascript', '-l', 'JavaScript', '-e', jxa_script],
            capture_output=True,
            text=True,
            timeout=5
        )
        output = result.stdout.strip()
        if output == "success":
            return {"status": "success"}
        else:
            return {"status": "error", "message": output}
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "クリック操作がタイムアウトしました（5秒以上）"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def focus_element(app_name, role, name):
    """
    UI要素にフォーカスを当てる
    """
    jxa_script = f'''
    const se = Application("System Events");
    const proc = se.processes["{app_name}"];

    function findElement(root, role, name) {{
      try {{
        const elements = root.entireContents();
        for (let i = 0; i < elements.length; i++) {{
          const elem = elements[i];
          try {{
            const props = elem.properties();
            if (props.role === role && (props.name === name || props.title === name)) {{
              return elem;
            }}
          }} catch (e) {{}}
        }}
      }} catch (e) {{}}
      return null;
    }}

    if (proc.windows.length === 0) {{
      "ERROR: No windows found";
    }} else {{
      const elem = findElement(proc.windows[0], "{role}", "{name}");
      if (elem !== null) {{
        elem.focused = true;
        "success";
      }} else {{
        "ERROR: Element not found";
      }}
    }}
    '''

    try:
        result = subprocess.run(
            ['osascript', '-l', 'JavaScript', '-e', jxa_script],
            capture_output=True,
            text=True,
            timeout=5
        )
        output = result.stdout.strip()
        if output == "success":
            return {"status": "success"}
        else:
            return {"status": "error", "message": output}
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "フォーカス操作がタイムアウトしました（5秒以上）"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def type_to_element(app_name, role, name, text):
    """
    UI要素をフォーカスしてテキスト入力
    """
    # まずフォーカス
    focus_result = focus_element(app_name, role, name)
    if focus_result["status"] != "success":
        return focus_result

    # テキスト入力
    time.sleep(0.2)
    return _type_text(text=text)
