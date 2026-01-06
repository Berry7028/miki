"""Web要素の取得と操作（ブラウザ内）"""
import subprocess
import json


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
          const props = elem.properties();
          const pos = props.position;
          const size = props.size;
          JSON.stringify({{
            status: "success",
            x: pos[0] + size[0] / 2,
            y: pos[1] + size[1] / 2
          }});
        }} else {{
          "ERROR: Element not found";
        }}
      }} else {{
        "ERROR: AXWebArea not found";
      }}
    }}
    '''

    try:
        import pyautogui
        
        result = subprocess.run(
            ['osascript', '-l', 'JavaScript', '-e', jxa_script],
            capture_output=True,
            text=True,
            timeout=5
        )
        output = result.stdout.strip()
        
        if output.startswith("{"):
            data = json.loads(output)
            if data.get("status") == "success":
                pyautogui.click(x=data["x"], y=data["y"], duration=0.5,
                                tween=pyautogui.easeInOutQuad)
                return {"status": "success"}
        
        if output == "success":
            return {"status": "success"}
        else:
            return {"status": "error", "message": output}
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "Web要素クリックがタイムアウトしました（5秒以上）"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
