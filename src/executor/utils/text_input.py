"""テキスト入力の共通モジュール

循環依存を回避するため、clipboard_utilsに依存しない実装
"""
import time
import pyautogui


def type_text_via_clipboard(text, clipboard_func=None):
    """
    クリップボード経由でテキストを入力（日本語対応）

    Args:
        text: 入力するテキスト
        clipboard_func: クリップボードにコピーする関数（オプション）
                       指定しない場合はpyautogui.writeを使用

    Returns:
        {"status": "success", "method": str} または {"status": "error", "message": str}
    """
    if clipboard_func:
        try:
            clipboard_func(text)
            time.sleep(0.1)
            pyautogui.hotkey('command', 'v')
            time.sleep(0.2)
            return {"status": "success", "method": "clipboard"}
        except Exception as e:
            return {"status": "error", "message": f"Failed to paste: {str(e)}"}

    try:
        pyautogui.write(text, interval=0.05)
        return {"status": "success", "method": "write"}
    except Exception as e:
        return {"status": "error", "message": f"Failed to type: {str(e)}"}
