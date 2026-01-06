"""
Miki Executor - MacOS操作実行エンジン
"""
import sys
import json
import time
import pyautogui
import io

sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', line_buffering=True)

from actions.screenshot import screenshot, get_screen_size
from actions.mouse_keyboard import (
    click, type_text, press_key, hotkey,
    mouse_move, scroll, drag, set_cursor_visibility
)
from actions.applescript import run_osa
from actions.ui_elements import (
    get_ui_elements, get_ui_elements_json,
    click_element, focus_element, type_to_element
)
from actions.web_elements import get_web_elements, click_web_element

pyautogui.FAILSAFE = True


ACTION_HANDLERS = {
    "screenshot": screenshot,
    "click": click,
    "type": type_text,
    "press": press_key,
    "hotkey": hotkey,
    "move": mouse_move,
    "scroll": scroll,
    "drag": drag,
    "setCursorVisibility": set_cursor_visibility,
    "osa": run_osa,
    "elements": get_ui_elements,
    "elementsJson": get_ui_elements_json,
    "clickElement": click_element,
    "typeToElement": type_to_element,
    "focusElement": focus_element,
    "webElements": get_web_elements,
    "clickWebElement": click_web_element,
    "size": get_screen_size,
}


def dispatch_action(action, params):
    """アクションをディスパッチして実行する"""
    handler = ACTION_HANDLERS.get(action)
    if handler:
        return handler(**params)
    else:
        return {"status": "error", "message": f"Unknown action: {action}"}


def main():
    """メインループ"""
    while True:
        line = sys.stdin.readline()
        if not line:
            break

        try:
            start_time = time.time()
            command_data = json.loads(line)
            action = command_data.get("action")
            params = command_data.get("params", {})

            if action == "exit":
                break

            result = dispatch_action(action, params)

            end_time = time.time()
            result["execution_time_ms"] = int((end_time - start_time) * 1000)

            print(json.dumps(result, ensure_ascii=False))
            sys.stdout.flush()
        except Exception as e:
            print(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False))
            sys.stdout.flush()


if __name__ == "__main__":
    main()
