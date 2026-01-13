"""Clipboard utilities for macOS."""
from typing import Dict, Any
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
