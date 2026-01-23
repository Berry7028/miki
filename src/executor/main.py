"""
Miki Executor - MacOS操作実行エンジン

このモジュールはコマンドディスパッチャーとして機能し、
実際の操作は各アクションモジュールに委譲されます。
"""
import sys
import json
import time
import pyautogui
import io
import os

sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', line_buffering=True)

# デバッグモードフラグ
DEBUG_MODE = os.environ.get("MIKI_DEBUG") == "1"

if DEBUG_MODE:
    print("[Executor] Debug mode enabled", file=sys.stderr, flush=True)

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
    if DEBUG_MODE:
        params_preview = str(params)[:200] if params else "{}"
        print(f"[Executor] Dispatching action: {action}, params: {params_preview}...", file=sys.stderr, flush=True)
    
    handler = ACTION_HANDLERS.get(action)
    if handler:
        result = handler(**params)
        if DEBUG_MODE:
            result_preview = str(result)[:200] if result else "{}"
            print(f"[Executor] Action {action} completed: {result_preview}...", file=sys.stderr, flush=True)
        return result
    else:
        return {"status": "error", "message": f"Unknown action: {action}"}


def main():
    """メインループ: 標準入力からコマンドを読み取り、実行し、結果を返す"""
    if DEBUG_MODE:
        print("[Executor] Starting main loop", file=sys.stderr, flush=True)
    
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
                if DEBUG_MODE:
                    print("[Executor] Exit command received", file=sys.stderr, flush=True)
                break

            result = dispatch_action(action, params)

            end_time = time.time()
            execution_time = int((end_time - start_time) * 1000)
            result["execution_time_ms"] = execution_time
            
            if DEBUG_MODE:
                print(f"[Executor] Total execution time: {execution_time}ms", file=sys.stderr, flush=True)

            print(json.dumps(result, ensure_ascii=False))
            sys.stdout.flush()
        except Exception as e:
            if DEBUG_MODE:
                import traceback
                print(f"[Executor] Exception occurred: {e}", file=sys.stderr, flush=True)
                print(f"[Executor] Traceback:\n{traceback.format_exc()}", file=sys.stderr, flush=True)
            print(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False))
            sys.stdout.flush()


if __name__ == "__main__":
    main()
