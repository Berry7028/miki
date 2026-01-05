"""AppleScript / OSA スクリプト実行"""
import subprocess
import re


# 危険なコマンドのブロックリスト（より包括的に）
DANGEROUS_PATTERNS = [
    r'rm\s+-[rf]+',
    r'rm\s+.*/',
    r'shutdown',
    r'reboot',
    r'halt',
    r'poweroff',
    r'killall',
    r'kill\s+-9',
    r'mkfs',
    r'dd\s+if=',
    r'>\s*/dev/',
    r'chmod\s+000',
    r'chown\s+-[Rr]',
    r':\(\)\{.*\|\:.*\&\}\;\:',  # Fork bomb
    r'format',
    r'del\s+/f',
    r'rmdir\s+/s',
    r'do\s+shell\s+script',  # AppleScriptから任意のシェルコマンド実行を防ぐ
    r'system\s+attribute',
    r'sudo',
    r'eval\s*\(',
]


def validate_script(script):
    """スクリプトに危険なコマンドが含まれていないか検証"""
    if not isinstance(script, str):
        raise ValueError("スクリプトは文字列である必要があります")
    
    # 長さチェック（異常に長いスクリプトを防ぐ）
    if len(script) > 10000:
        raise ValueError("スクリプトが長すぎます（最大10000文字）")
    
    # 空チェック
    if not script.strip():
        raise ValueError("スクリプトが空です")
    
    script_lower = script.lower()
    
    # 正規表現パターンマッチングで危険なコマンドを検出
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, script_lower, re.IGNORECASE):
            raise ValueError(f"危険なコマンドパターンが検出されました: {pattern}")
    
    # 制御文字のチェック（null byteなど）
    if '\x00' in script:
        raise ValueError("不正な制御文字が含まれています")


def run_osa(script):
    """AppleScript (OSA) を実行する"""
    try:
        # スクリプトの検証
        validate_script(script)

        # タイムアウトを設定して実行（10秒）
        result = subprocess.run(
            ['osascript', '-e', script],
            capture_output=True,
            text=True,
            timeout=10,
            check=False)
        if result.returncode == 0:
            # 出力を制限（最大5000文字）
            output = result.stdout.strip()
            if len(output) > 5000:
                output = output[:5000] + "... (truncated)"
            return {"status": "success", "output": output}
        else:
            error_msg = result.stderr.strip()
            if len(error_msg) > 1000:
                error_msg = error_msg[:1000] + "... (truncated)"
            return {"status": "error", "message": error_msg}
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "スクリプトの実行がタイムアウトしました"}
    except ValueError as e:
        return {"status": "error", "message": str(e)}
    except Exception as e:
        return {"status": "error", "message": f"実行エラー: {str(e)}"}
