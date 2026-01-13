"""
Miki Executor - MacOS操作実行エンジン

このモジュールはコマンドディスパッチャーとして機能し、
実際の操作は各アクションモジュールに委譲されます。
"""
import sys
import json
import time
import logging
import pyautogui
import io

# ロギングの設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
    focus_element
)
from actions.web_elements import get_web_elements, get_default_browser

# 安全装置: マウスを画面の隅に移動させるとプログラムが停止する
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
    "focusElement": focus_element,
    "webElements": get_web_elements,
    "browser": get_default_browser,
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
    """メインループ: 標準入力からコマンドを読み取り、実行し、結果を返す"""
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
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            print(json.dumps({"status": "error", "message": "Invalid JSON format", "error_type": "json_decode"}, ensure_ascii=False))
            sys.stdout.flush()
        except (KeyError, TypeError) as e:
            logger.error(f"Invalid command structure: {e}")
            print(json.dumps({"status": "error", "message": "Invalid command structure", "error_type": "validation"}, ensure_ascii=False))
            sys.stdout.flush()
        except Exception as e:
            logger.exception("Unexpected error in main loop")
            print(json.dumps({"status": "error", "message": "Unexpected error", "error_type": "internal"}, ensure_ascii=False))
            sys.stdout.flush()


if __name__ == "__main__":
    main()
