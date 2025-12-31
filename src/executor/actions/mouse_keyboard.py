"""マウスとキーボード操作"""
import pyautogui
import time


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
        pyautogui.drag(to_x - from_x, to_y - from_y,
                       duration=duration, button=button)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
