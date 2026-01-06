"""マウスとキーボード操作"""
import pyautogui
import time
import AppKit

DEFAULT_SPEED_PROFILE = {
    "PAUSE": 0.1,
    "CLICK_DURATION": 0.1,
    "MOUSE_MOVE_DURATION": 0.1,
    "DRAG_DURATION": 0.2,
}

pyautogui.PAUSE = DEFAULT_SPEED_PROFILE["PAUSE"]

from actions.clipboard_utils import copy_text


def click(x, y, clicks=1, button="left", duration=None):
    """指定された座標に移動しながらクリックする"""
    if duration is None:
        duration = DEFAULT_SPEED_PROFILE["CLICK_DURATION"]
    try:
        pyautogui.click(x=x, y=y, clicks=clicks, button=button,
                        duration=duration, tween=pyautogui.easeInOutQuad)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": f"Failed to click: {str(e)}"}


def type_text(text):
    """テキストを入力する（クリップボード経由で日本語対応）"""
    copy_result = copy_text(text)
    if copy_result["status"] != "success":
        return {"status": "error", "message": copy_result["message"]}

    try:
        time.sleep(0.1)
        pyautogui.keyDown('command')
        pyautogui.press('v')
        pyautogui.keyUp('command')
        time.sleep(0.2)
        return {"status": "success", "method": copy_result["method"]}
    except Exception as e:
        return {"status": "error", "message": f"Failed to type text: {str(e)}"}


def press_key(key):
    """特定のキーを押す"""
    try:
        if not isinstance(key, str):
            return {"status": "error", "message": f"Invalid key type: {type(key)}"}
        if not key.isascii():
            return {"status": "error", "message": f"Non-ASCII key detected: {key}. Only ASCII keys are supported."}
        pyautogui.press(key)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": f"Failed to press key: {str(e)}"}


def hotkey(keys):
    """ホットキーを実行する"""
    try:
        for key in keys:
            if not isinstance(key, str):
                return {"status": "error", "message": f"Invalid key type: {type(key)}"}
            if not key.isascii():
                return {"status": "error", "message": f"Non-ASCII key detected: {key}. Only ASCII keys are supported."}
        pyautogui.hotkey(*keys)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": f"Failed to execute hotkey: {str(e)}"}


def mouse_move(x, y, duration=None):
    """指定された座標に移動する"""
    if duration is None:
        duration = DEFAULT_SPEED_PROFILE["MOUSE_MOVE_DURATION"]
    try:
        pyautogui.moveTo(x, y, duration=duration, tween=pyautogui.easeInOutQuad)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": f"Failed to move mouse: {str(e)}"}


def scroll(amount):
    """スクロールする"""
    pyautogui.scroll(amount)
    return {"status": "success"}


def drag(from_x, from_y, to_x, to_y, duration=None, button="left"):
    """ドラッグアンドドロップを実行する"""
    if duration is None:
        duration = DEFAULT_SPEED_PROFILE["DRAG_DURATION"]
    try:
        move_duration = DEFAULT_SPEED_PROFILE["MOUSE_MOVE_DURATION"]
        pyautogui.moveTo(from_x, from_y, duration=move_duration,
                         tween=pyautogui.easeInOutQuad)
        pyautogui.dragTo(to_x, to_y, duration=duration,
                         button=button, tween=pyautogui.easeInOutQuad)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


_cursor_hidden = False


def set_cursor_visibility(visible):
    """マウスカーソルの表示・非表示を切り替える"""
    global _cursor_hidden
    try:
        if visible:
            if _cursor_hidden:
                AppKit.NSCursor.unhide()
                _cursor_hidden = False
        else:
            if not _cursor_hidden:
                AppKit.NSCursor.hide()
                _cursor_hidden = True
        return {"status": "success", "visible": visible}
    except Exception as e:
        return {"status": "error", "message": f"Failed to set cursor visibility: {str(e)}"}
