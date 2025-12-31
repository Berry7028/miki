"""マウスとキーボード操作"""
import pyautogui
import time

from actions.clipboard_utils import copy_text


def click(x, y, clicks=1, button="left"):
    """指定された座標をクリックする"""
    pyautogui.click(x=x, y=y, clicks=clicks, button=button)
    return {"status": "success"}


def type_text(text):
    """テキストを入力する（クリップボード経由で日本語対応）"""
    copy_result = copy_text(text)
    if copy_result["status"] != "success":
        return {"status": "error", "message": copy_result["message"]}

    try:
        time.sleep(0.05)
        # command + v で貼り付け
        pyautogui.keyDown('command')
        pyautogui.press('v')
        pyautogui.keyUp('command')
        time.sleep(0.05)
        return {"status": "success", "method": copy_result["method"]}
    except Exception as e:
        return {"status": "error", "message": f"Failed to type text: {str(e)}"}


def press_key(key):
    """特定のキーを押す"""
    try:
        # ASCII文字のみを受け入れる
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
        # keysが文字列のリストであることを確認し、ASCII文字のみを受け入れる
        for key in keys:
            if not isinstance(key, str):
                return {"status": "error", "message": f"Invalid key type: {type(key)}"}
            # 日本語文字が含まれていないかチェック
            if not key.isascii():
                return {"status": "error", "message": f"Non-ASCII key detected: {key}. Only ASCII keys are supported."}
        pyautogui.hotkey(*keys)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": f"Failed to execute hotkey: {str(e)}"}


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
        pyautogui.drag(to_x - from_x, to_y - from_y,
                       duration=duration, button=button)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
