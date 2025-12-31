"""AppleScript / OSA スクリプト実行"""
import subprocess


# 危険なコマンドのブロックリスト
DANGEROUS_COMMANDS = [
    'rm -rf',
    'rm -r /',
    'shutdown',
    'reboot',
    'halt',
    'poweroff',
    'killall',
    'kill -9',
    'mkfs',
    'dd if=',
    ' > /dev/',
    'chmod 000',
    'chown -R',
    ':(){:|:&};:',  # Fork bomb
    'format',
    'del /f',
    'rmdir /s',
]


def validate_script(script):
    """スクリプトに危険なコマンドが含まれていないか検証"""
    script_lower = script.lower()
    for dangerous in DANGEROUS_COMMANDS:
        if dangerous in script_lower:
            raise ValueError(f"危険なコマンドが検出されました: {dangerous}")


def run_osa(script):
    """AppleScript (OSA) を実行する"""
    try:
        # スクリプトの検証
        validate_script(script)

        result = subprocess.run(
            ['osascript', '-e', script], capture_output=True, text=True)
        if result.returncode == 0:
            return {"status": "success", "output": result.stdout.strip()}
        else:
            return {"status": "error", "message": result.stderr.strip()}
    except ValueError as e:
        return {"status": "error", "message": str(e)}
    except Exception as e:
        return {"status": "error", "message": str(e)}
