"""AppleScript / OSA スクリプト実行

セキュリティ上の注意:
このモジュールは基本的な保護機能を提供しますが、完全な安全性を保証するものではありません。
AppleScript は高度な柔軟性を持つため、悪意のあるコードを完全に防ぐことは困難です。

主な保護機能:
1. do shell script の禁止 - 任意のシェルコマンド実行を防ぐ
2. 危険なシェルコマンドパターンの検出
3. 難読化された do shell script の検出

制限事項:
- 高度な文字列操作や動的コード生成による回避は検出できない可能性があります
- 信頼できるソースからのスクリプトのみを実行してください
"""
import subprocess
import re


# 危険なシェルコマンドパターン（do shell script が検出された場合の二次防御）
DANGEROUS_SHELL_PATTERNS = [
    r'rm\s+-rf',
    r'rm\s+-r\s+/',
    r'shutdown',
    r'reboot',
    r'halt',
    r'poweroff',
    r'killall',
    r'kill\s+-9',
    r'mkfs',
    r'dd\s+if=',
    r'>\s*/dev/',  # リダイレクトを /dev/ へ
    r'chmod\s+000',
    r'chown\s+-R',  # -R フラグのみ（-r は存在しない）
    r':\(\)\{:\|:&\};:',  # Fork bomb
    r'format',
    r'del\s+/f',
    r'rmdir\s+/s',
]


def validate_script(script):
    """スクリプトに危険なコマンドが含まれていないか検証
    
    セキュリティチェック:
    1. do shell script の使用を完全に禁止（任意のシェルコマンド実行を防ぐ）
    2. 難読化パターンの検出（スペース、引用符、改行などによる回避を検出）
    3. 危険なシェルコマンドパターンの検出
    
    Args:
        script: 検証するAppleScriptの文字列
        
    Raises:
        ValueError: 危険なパターンが検出された場合
    
    Note:
        セキュリティチェックのみに正規化を適用し、実行時は元のスクリプトを使用します。
    """
    # セキュリティチェック用に正規化（連続する空白を単一スペースに変換）
    # 注: 実行時のスクリプトには影響しない
    normalized = re.sub(r'\s+', ' ', script.strip())
    script_lower = normalized.lower()
    
    # 1. do shell script の検出（最も危険な攻撃ベクター）
    # 様々な難読化パターンに対応:
    # - "do shell script", 'do shell script'
    # - do  shell  script (複数空白)
    # - do\nshell\nscript (改行)
    if re.search(r'do\s+shell\s+script', script_lower):
        raise ValueError(
            "do shell script の使用は禁止されています。"
            "任意のシェルコマンドを実行できるため、セキュリティリスクとなります。"
        )
    
    # 2. 危険なシェルコマンドパターンの検出
    # （万が一 do shell script 検出を回避された場合の二次防御）
    for pattern in DANGEROUS_SHELL_PATTERNS:
        if re.search(pattern, script_lower, re.IGNORECASE):
            raise ValueError(f"危険なコマンドパターンが検出されました: {pattern}")


def run_osa(script):
    """AppleScript (OSA) を実行する
    
    セキュリティ制限:
    - do shell script の使用は完全に禁止されています
    - 危険なシェルコマンドパターンは拒否されます
    - 信頼できるソースからのスクリプトのみを実行してください
    
    Args:
        script: 実行するAppleScriptの文字列
        
    Returns:
        dict: 実行結果 {"status": "success"/"error", "output"/"message": str}
    """
    try:
        # スクリプトの検証
        validate_script(script)

        result = subprocess.run(
            ['osascript', '-e', script],
            capture_output=True,
            text=True,
            timeout=30)  # タイムアウトを追加してハングを防ぐ
        if result.returncode == 0:
            return {"status": "success", "output": result.stdout.strip()}
        else:
            return {"status": "error", "message": result.stderr.strip()}
    except ValueError as e:
        return {"status": "error", "message": str(e)}
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "スクリプトの実行がタイムアウトしました"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
