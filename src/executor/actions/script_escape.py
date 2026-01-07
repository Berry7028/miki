"""AppleScript/JXA文字列エスケープユーティリティ

LLM由来の入力をAppleScript/JXAスクリプトに安全に埋め込むためのエスケープ関数を提供します。
"""


def escape_applescript_string(text):
    """
    AppleScript文字列リテラル用のエスケープ処理
    
    AppleScriptでは文字列リテラルはダブルクォートで囲まれ、
    以下の文字をエスケープする必要があります:
    - ダブルクォート (") -> バックスラッシュでエスケープ
    - バックスラッシュ (\) -> 二重にする
    
    Args:
        text: エスケープする文字列
        
    Returns:
        エスケープされた文字列
        
    Example:
        >>> escape_applescript_string('He said "Hello"')
        'He said \\"Hello\\"'
        >>> escape_applescript_string('Path\\to\\file')
        'Path\\\\to\\\\file'
    """
    if text is None:
        return ""
    
    text = str(text)
    # バックスラッシュを先にエスケープ（順序重要）
    text = text.replace("\\", "\\\\")
    # ダブルクォートをエスケープ
    text = text.replace('"', '\\"')
    return text


def escape_jxa_string(text):
    """
    JXA (JavaScript for Automation) 文字列リテラル用のエスケープ処理
    
    JXAはJavaScriptなので、文字列リテラル内で以下の文字をエスケープする必要があります:
    - ダブルクォート (") -> \"
    - バックスラッシュ (\) -> \\
    - 改行 (\n) -> \\n
    - キャリッジリターン (\r) -> \\r
    - タブ (\t) -> \\t
    - バックスペース (\b) -> \\b
    - フォームフィード (\f) -> \\f
    
    Args:
        text: エスケープする文字列
        
    Returns:
        エスケープされた文字列
        
    Example:
        >>> escape_jxa_string('Line 1\\nLine 2')
        'Line 1\\\\nLine 2'
        >>> escape_jxa_string('Say "Hi"')
        'Say \\"Hi\\"'
    """
    if text is None:
        return ""
    
    text = str(text)
    # バックスラッシュを先にエスケープ（順序重要）
    text = text.replace("\\", "\\\\")
    # ダブルクォートをエスケープ
    text = text.replace('"', '\\"')
    # 制御文字をエスケープ
    text = text.replace("\n", "\\n")
    text = text.replace("\r", "\\r")
    text = text.replace("\t", "\\t")
    text = text.replace("\b", "\\b")
    text = text.replace("\f", "\\f")
    return text
