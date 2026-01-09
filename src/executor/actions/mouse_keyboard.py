"""マウスとキーボード操作"""
import pyautogui
import time
import AppKit

# パフォーマンスプロファイル設定
# 将来的に設定から切り替えやすくするため定数化
# 環境や用途に応じて調整可能（高速化優先だが、UIが追いつかない場合は値を増やすこと）
DEFAULT_SPEED_PROFILE = {
    "PAUSE": 0.1,               # アクション間の基本待機時間（OSの負荷を考慮）
    "CLICK_DURATION": 0.1,      # クリック時のマウス移動時間（速度優先）
    "MOUSE_MOVE_DURATION": 0.1, # マウス移動時間
    "DRAG_DURATION": 0.2,       # ドラッグ操作時間
}

# アクション間の待機時間を設定（高速化のため最小限に）
# Note: 一部の環境やリモート操作では速すぎてUIが追いつかない可能性があります
# その場合は PAUSE を 0.1 以上に増やすことを推奨
pyautogui.PAUSE = DEFAULT_SPEED_PROFILE["PAUSE"]

from actions.clipboard_utils import copy_text


def click(x, y, clicks=1, button="left", duration=None):
    """指定された座標に移動しながらクリックする"""
    if duration is None:
        duration = DEFAULT_SPEED_PROFILE["CLICK_DURATION"]
    try:
        pyautogui.click(x=x, y=y, clicks=clicks, button=button,duration=duration, tween=pyautogui.easeInOutQuad)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": f"Failed to click: {str(e)}"}


def type_text(text):
    """テキストを入力する（osascript経由で日本語なども忠実にテキスト入力）"""
    import subprocess

    osa_script = f'''
    tell application "System Events"
        keystroke "{text.replace('"', '\\"')}"
    end tell
    '''
    try:
        result = subprocess.run(
            ["osascript", "-e", osa_script],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            return {"status": "success", "method": "osascript"}
        else:
            return {"status": "error", "message": f"osascript error: {result.stderr}"}
    except Exception as e:
        return {"status": "error", "message": f"Failed to type text via osascript: {str(e)}"}

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
    try:
        scroll_amount = int(amount)
    except (TypeError, ValueError):
        return {"status": "error", "message": f"Invalid scroll amount: {amount}"}

    # ツール仕様は「正の値で下方向」だが、pyautoguiは正の値で上方向
    # 仕様と一致させるために符号を反転する
    pyautogui.scroll(-scroll_amount)
    return {"status": "success"}


def drag(from_x, from_y, to_x, to_y, duration=None, button="left"):
    """ドラッグアンドドロップを実行する"""
    if duration is None:
        duration = DEFAULT_SPEED_PROFILE["DRAG_DURATION"]
    try:
        move_duration = DEFAULT_SPEED_PROFILE["MOUSE_MOVE_DURATION"]
        pyautogui.moveTo(from_x, from_y, duration=move_duration,tween=pyautogui.easeInOutQuad)
        pyautogui.dragTo(to_x, to_y, duration=duration,button=button, tween=pyautogui.easeInOutQuad)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# カーソル表示状態の管理フラグ
_cursor_hidden = False


def set_cursor_visibility(visible):
    """マウスカーソルの表示・非表示を切り替える (AppKitを使用)"""
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
