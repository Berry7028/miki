"""AppleScript / OSA スクリプト実行"""
import subprocess


def run_osa(script):
    """AppleScript (OSA) を実行する"""
    try:
        result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
        if result.returncode == 0:
            return {"status": "success", "output": result.stdout.strip()}
        else:
            return {"status": "error", "message": result.stderr.strip()}
    except Exception as e:
        return {"status": "error", "message": str(e)}
