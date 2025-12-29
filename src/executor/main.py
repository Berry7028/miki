import sys
import json
import pyautogui
import base64
import subprocess
import time
from io import BytesIO
from PIL import Image, ImageDraw

# 安全装置: マウスを画面の隅に移動させるとプログラムが停止する
pyautogui.FAILSAFE = True

def draw_point_on_screenshot(img, x, y, radius=15, color="red"):
    """スクリーンショット上の指定座標にハイライト（赤い点）を描画する"""
    draw = ImageDraw.Draw(img)
    # ディスプレイのスケーリング（Retina等）を考慮するため、pyautoguiのサイズと画像のサイズを比較
    screen_w, screen_h = pyautogui.size()
    img_w, img_h = img.size
    
    scale_x = img_w / screen_w
    scale_y = img_h / screen_h
    
    ix, iy = x * scale_x, y * scale_y
    
    left_up = (ix - radius, iy - radius)
    right_down = (ix + radius, iy + radius)
    draw.ellipse([left_up, right_down], fill=color, outline="white", width=2)
    return img

def screenshot(highlight_pos=None):
    """画面のスクリーンショットを撮り、Base64文字列で返し、現在のマウス位置も提供する"""
    shot = pyautogui.screenshot()
    
    # ハイライト位置が指定されている場合は描画
    if highlight_pos:
        shot = draw_point_on_screenshot(shot, highlight_pos['x'], highlight_pos['y'])
    
    buffered = BytesIO()
    shot.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    x, y = pyautogui.position()
    return {"status": "success", "data": img_str, "mouse_position": {"x": x, "y": y}}

def click(x, y, clicks=1, button="left"):
    """指定された座標をクリックする"""
    pyautogui.click(x=x, y=y, clicks=clicks, button=button)
    return {"status": "success"}

def type_text(text):
    """テキストを入力する（クリップボード経由でより確実に）"""
    try:
        # 特殊な文字や日本語入力の不安定さを避けるため、クリップボード経由での貼り付けを試みる
        import pyperclip
        old_clipboard = pyperclip.paste()
        pyperclip.copy(text)
        # command + v で貼り付け
        pyautogui.hotkey('command', 'v')
        # クリップボードを元に戻す（オプション）
        time.sleep(0.1)
        # pyperclip.copy(old_clipboard)
        return {"status": "success", "method": "clipboard"}
    except Exception:
        # クリップボードが使えない場合は通常のタイピング
        pyautogui.write(text, interval=0.05)
        return {"status": "success", "method": "write"}

def press_key(key):
    """特定のキーを押す"""
    pyautogui.press(key)
    return {"status": "success"}

def hotkey(keys):
    """ホットキーを実行する"""
    pyautogui.hotkey(*keys)
    return {"status": "success"}

def mouse_move(x, y):
    """マウスを移動する"""
    pyautogui.moveTo(x, y, duration=0.25)
    return {"status": "success"}

def scroll(amount):
    """スクロールする"""
    pyautogui.scroll(amount)
    return {"status": "success"}

def drag(from_x, from_y, to_x, to_y, duration=0.5, button="left"):
    """ドラッグアンドドロップを実行する"""
    try:
        # 開始位置に移動
        pyautogui.moveTo(from_x, from_y, duration=0.1)
        # ドラッグ実行
        pyautogui.drag(to_x - from_x, to_y - from_y, duration=duration, button=button)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def run_osa(script):
    """AppleScript (OSA) を実行する"""
    try:
        result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
        if result.returncode == 0:
            return {"status": "success", "output": result.stdout.strip()}
        else:
            return {"status": "error", "message": result.stderr.strip()}
    except Exception as e:
        return {"status": "error", "message": str(e)}

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
        result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
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
    return type_text(text=text)

def get_web_elements(app_name):
    """
    ブラウザ内のWeb要素を取得（AXWebArea配下）
    """
    jxa_script = f'''
    const se = Application("System Events");
    const proc = se.processes["{app_name}"];

    function findWebArea(root) {{
      try {{
        const elements = root.entireContents();
        for (let i = 0; i < elements.length; i++) {{
          try {{
            if (elements[i].role() === "AXWebArea") {{
              return elements[i];
            }}
          }} catch (e) {{}}
        }}
      }} catch (e) {{}}
      return null;
    }}

    if (proc.windows.length === 0) {{
      JSON.stringify({{ error: "No windows found" }});
    }} else {{
      const webArea = findWebArea(proc.windows[0]);
      if (webArea !== null) {{
        const webElements = webArea.entireContents();
        const result = [];

        for (let i = 0; i < Math.min(webElements.length, 100); i++) {{
          try {{
            const elem = webElements[i];
            const props = elem.properties();
            result.push({{
              role: props.role,
              name: props.name || props.title || "",
              value: props.value || "",
              description: props.description || "",
              position: props.position ? [props.position[0], props.position[1]] : [0, 0],
              size: props.size ? [props.size[0], props.size[1]] : [0, 0]
            }});
          }} catch (e) {{}}
        }}

        JSON.stringify({{ elements: result }});
      }} else {{
        JSON.stringify({{ error: "AXWebArea not found" }});
      }}
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
        return {"status": "error", "message": "Web要素取得がタイムアウトしました（10秒以上）"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def click_web_element(app_name, role, name):
    """
    ブラウザ内のWeb要素をクリック
    """
    jxa_script = f'''
    const se = Application("System Events");
    const proc = se.processes["{app_name}"];

    function findWebArea(root) {{
      try {{
        const elements = root.entireContents();
        for (let i = 0; i < elements.length; i++) {{
          try {{
            if (elements[i].role() === "AXWebArea") {{
              return elements[i];
            }}
          }} catch (e) {{}}
        }}
      }} catch (e) {{}}
      return null;
    }}

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
      const webArea = findWebArea(proc.windows[0]);
      if (webArea !== null) {{
        const elem = findElement(webArea, "{role}", "{name}");
        if (elem !== null) {{
          elem.click();
          "success";
        }} else {{
          "ERROR: Element not found";
        }}
      }} else {{
        "ERROR: AXWebArea not found";
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
        return {"status": "error", "message": "Web要素クリックがタイムアウトしました（5秒以上）"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def get_screen_size():
    """画面サイズを取得する"""
    width, height = pyautogui.size()
    return {"status": "success", "width": width, "height": height}

def main():
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        
        try:
            start_time = time.time()
            command_data = json.loads(line)
            action = command_data.get("action")
            params = command_data.get("params", {})

            if action == "screenshot":
                result = screenshot(**params)
            elif action == "click":
                result = click(**params)
            elif action == "type":
                result = type_text(**params)
            elif action == "press":
                result = press_key(**params)
            elif action == "hotkey":
                result = hotkey(**params)
            elif action == "move":
                result = mouse_move(**params)
            elif action == "scroll":
                result = scroll(**params)
            elif action == "drag":
                result = drag(**params)
            elif action == "osa":
                result = run_osa(**params)
            elif action == "elements":
                result = get_ui_elements(**params)
            elif action == "elementsJson":
                result = get_ui_elements_json(**params)
            elif action == "clickElement":
                result = click_element(**params)
            elif action == "typeToElement":
                result = type_to_element(**params)
            elif action == "focusElement":
                result = focus_element(**params)
            elif action == "webElements":
                result = get_web_elements(**params)
            elif action == "clickWebElement":
                result = click_web_element(**params)
            elif action == "size":
                result = get_screen_size()
            elif action == "exit":
                break
            else:
                result = {"status": "error", "message": f"Unknown action: {action}"}
            
            end_time = time.time()
            result["execution_time_ms"] = int((end_time - start_time) * 1000)
            
            print(json.dumps(result))
            sys.stdout.flush()
        except Exception as e:
            print(json.dumps({"status": "error", "message": str(e)}))
            sys.stdout.flush()

if __name__ == "__main__":
    main()
