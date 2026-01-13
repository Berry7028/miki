"""Clipboard utilities for macOS."""
from typing import Dict, Any, Optional
import subprocess


def copy_text(text: str) -> Dict[str, Any]:
    """
    Copy text to clipboard.
    Prefer pbcopy (handles UTF-8 reliably), fall back to pyperclip if needed.
    """
    try:
        subprocess.run(["pbcopy"], input=text, text=True, check=True)
        return {"status": "success", "method": "pbcopy"}
    except Exception:
        try:
            import pyperclip
            pyperclip.copy(text)
            return {"status": "success", "method": "pyperclip"}
        except Exception as e:
            return {"status": "error", "message": f"Failed to copy text: {str(e)}"}


def clear_clipboard() -> Dict[str, Any]:
    """
    Clear the clipboard by copying an empty string.
    """
    try:
        subprocess.run(["pbcopy"], input="", text=True, check=True)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": f"Failed to clear clipboard: {str(e)}"}


def copy_and_clear(text: str, delay: float = 0.0) -> Dict[str, Any]:
    """
    Copy text to clipboard, wait for specified delay, then clear.

    This is useful when copying sensitive data that shouldn't remain in clipboard.

    Args:
        text: Text to copy to clipboard
        delay: Delay in seconds before clearing (default: 0.0)

    Returns:
        Result dict with status and method used
    """
    try:
        import time

        # Copy text
        subprocess.run(["pbcopy"], input=text, text=True, check=True)

        # Wait if delay is specified
        if delay > 0:
            time.sleep(delay)

        # Clear clipboard
        subprocess.run(["pbcopy"], input="", text=True, check=True)

        return {"status": "success", "method": "pbcopy_with_clear"}
    except Exception as e:
        return {"status": "error", "message": f"Failed to copy and clear: {str(e)}"}
