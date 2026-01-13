"""JXA (JavaScript for Automation) スクリプト生成ユーティリティ

このモジュールは、macOS の UI 要素操作に使用する JXA スクリプトの
共通パターンを提供し、コードの重複を削減します。
"""

from typing import Optional


def build_element_finder_script(max_depth: int = 5) -> str:
    """
    UI 要素を再帰的に検索する JXA 関数を生成

    Args:
        max_depth: 再帰の最大深さ（デフォルト: 5）

    Returns:
        JXA 関数定義の文字列
    """
    return f'''function findElementRecursive(elem, role, name, depth) {{
  if (depth > {max_depth}) return null;
  try {{
    const props = elem.properties();
    if (props.role === role && (props.name === name || props.title === name)) {{
      return elem;
    }}

    const children = elem.uiElements();
    for (let i = 0; i < children.length; i++) {{
      const found = findElementRecursive(children[i], role, name, depth + 1);
      if (found) return found;
    }}
  }} catch (e) {{}}
  return null;
}}'''


def build_ui_elements_inspector_script(max_depth: int = 5) -> str:
    """
    UI 要素のプロパティを再帰的に検査する JXA 関数を生成

    Args:
        max_depth: 再帰の最大深さ（デフォルト: 5）

    Returns:
        JXA 関数定義の文字列
    """
    return f'''function inspectElement(elem, depth) {{
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
}}'''


def build_web_area_finder_script() -> str:
    """
    AXWebArea を検索する JXA 関数を生成

    Returns:
        JXA 関数定義の文字列
    """
    return '''function findWebArea(root) {
  try {
    const elements = root.entireContents();
    for (let i = 0; i < elements.length; i++) {
      try {
        if (elements[i].role() === "AXWebArea") {
          return elements[i];
        }
      } catch (e) {}
    }
  } catch (e) {}
  return null;
}'''


def build_web_element_finder_script() -> str:
    """
    Web 内の要素を検索する JXA 関数を生成

    Returns:
        JXA 関数定義の文字列
    """
    return '''function findElement(root, role, name) {
  try {
    const elements = root.entireContents();
    for (let i = 0; i < elements.length; i++) {
      const elem = elements[i];
      try {
        const props = elem.properties();
        if (props.role === role && (props.name === name || props.title === name)) {
          return elem;
        }
      } catch (e) {}
    }
  } catch (e) {}
  return null;
}'''


def build_click_element_template(safe_app_name: str, safe_role: str, safe_name: str) -> str:
    """
    UI 要素をクリックする JXA スクリプトを生成

    Args:
        safe_app_name: サニタイズ済みアプリケーション名
        safe_role: サニタイズ済みロール
        safe_name: サニタイズ済み名前

    Returns:
        完全な JXA スクリプト文字列
    """
    element_finder = build_element_finder_script()
    return f'''
const se = Application("System Events");
const proc = se.processes["{safe_app_name}"];

{element_finder}

if (proc.windows.length === 0) {{
  "ERROR: No windows found";
}} else {{
  const elem = findElementRecursive(proc.windows[0], "{safe_role}", "{safe_name}", 0);
  if (elem !== null) {{
    const props = elem.properties();
    const pos = props.position;
    const size = props.size;
    // 座標とサイズをJSONで返す
    JSON.stringify({{
      status: "success",
      x: pos[0] + size[0] / 2,
      y: pos[1] + size[1] / 2
    }});
  }} else {{
    "ERROR: Element not found";
  }}
}}
'''


def build_focus_element_template(safe_app_name: str, safe_role: str, safe_name: str) -> str:
    """
    UI 要素にフォーカスを設定する JXA スクリプトを生成

    Args:
        safe_app_name: サニタイズ済みアプリケーション名
        safe_role: サニタイズ済みロール
        safe_name: サニタイズ済み名前

    Returns:
        完全な JXA スクリプト文字列
    """
    element_finder = build_element_finder_script()
    return f'''
const se = Application("System Events");
const proc = se.processes["{safe_app_name}"];

{element_finder}

if (proc.windows.length === 0) {{
  "ERROR: No windows found";
}} else {{
  const elem = findElementRecursive(proc.windows[0], "{safe_role}", "{safe_name}", 0);
  if (elem !== null) {{
    elem.focused = true;
    "success";
  }} else {{
    "ERROR: Element not found";
  }}
}}
'''


def build_web_elements_template(safe_app_name: str, max_results: int = 100) -> str:
    """
    Web 要素一覧を取得する JXA スクリプトを生成

    Args:
        safe_app_name: サニタイズ済みアプリケーション名
        max_results: 最大取得数（デフォルト: 100）

    Returns:
        完全な JXA スクリプト文字列
    """
    web_area_finder = build_web_area_finder_script()
    return f'''
const se = Application("System Events");
const proc = se.processes["{safe_app_name}"];

{web_area_finder}

if (proc.windows.length === 0) {{
  JSON.stringify({{ error: "No windows found" }});
}} else {{
  const webArea = findWebArea(proc.windows[0]);
  if (webArea !== null) {{
    const webElements = webArea.entireContents();
    const result = [];

    for (let i = 0; i < Math.min(webElements.length, {max_results}); i++) {{
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


def build_web_click_template(safe_app_name: str, safe_role: str, safe_name: str) -> str:
    """
    Web 内の要素をクリックする JXA スクリプトを生成

    Args:
        safe_app_name: サニタイズ済みアプリケーション名
        safe_role: サニタイズ済みロール
        safe_name: サニタイズ済み名前

    Returns:
        完全な JXA スクリプト文字列
    """
    web_area_finder = build_web_area_finder_script()
    web_element_finder = build_web_element_finder_script()
    return f'''
const se = Application("System Events");
const proc = se.processes["{safe_app_name}"];

{web_area_finder}

{web_element_finder}

if (proc.windows.length === 0) {{
  "ERROR: No windows found";
}} else {{
  const webArea = findWebArea(proc.windows[0]);
  if (webArea !== null) {{
    const elem = findElement(webArea, "{safe_role}", "{safe_name}");
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
