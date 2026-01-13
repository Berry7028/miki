"""Web要素の取得と操作（ブラウザ内）"""
from typing import Dict, Any, List, Optional
import subprocess
import json
import os

from utils.sanitizer import sanitize_for_jxa_string, sanitize_applescript_string
from utils.jxa_helpers import (
    build_web_elements_template,
    build_web_click_template,
)


def get_web_elements(app_name: str) -> Dict[str, Any]:
    """
    ブラウザ内のWeb要素を取得（AXWebArea配下）
    """
    # アプリ名をサニタイズ（インジェクション対策）
    safe_app_name = sanitize_for_jxa_string(app_name, is_app_name=True)

    # 共通テンプレートを使用（コード重複の削減）
    jxa_script = build_web_elements_template(safe_app_name)

    try:
        result = subprocess.run(
            ['osascript', '-l', 'JavaScript', '-e', jxa_script],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            data = json.loads(result.stdout.strip())
            return {"status": "success", "ui_data": data}
        else:
            return {"status": "error", "message": result.stderr.strip()}
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "Web要素取得がタイムアウトしました（10秒以上）"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def get_default_browser() -> Dict[str, Any]:
    """
    macOSのデフォルトブラウザ名を取得する
    """
    try:
        raw = subprocess.check_output(
            ["defaults", "read", "com.apple.LaunchServices/com.apple.launchservices.secure", "LSHandlers"],
            text=True
        )
        json_text = subprocess.check_output(
            ["plutil", "-convert", "json", "-o", "-", "-"],
            input=raw,
            text=True
        )
        handlers = json.loads(json_text)

        def pick_bundle_id(scheme):
            for entry in handlers if isinstance(handlers, list) else []:
                if entry.get("LSHandlerURLScheme") == scheme:
                    for key in ("LSHandlerRoleAll", "LSHandlerRoleViewer", "LSHandlerRoleEditor"):
                        value = entry.get(key)
                        if value and value != "-":
                            return value
            return None

        bundle_id = pick_bundle_id("https") or pick_bundle_id("http")
    except Exception:
        # デフォルト設定が見つからない場合はSafariとみなす
        bundle_id = "com.apple.Safari"

    if not bundle_id:
        bundle_id = "com.apple.Safari"

    if bundle_id == "com.apple.safari":
        bundle_id = "com.apple.Safari"

    browser_name = None

    # Bundle IDからアプリ名を取得（Finder経由）
    # bundle_id をサニタイズ（インジェクション対策）
    safe_bundle_id = sanitize_applescript_string(bundle_id)
    osa_cmd = f'tell application "Finder" to get name of (application file id "{safe_bundle_id}")'
    try:
        browser_name = subprocess.check_output(
            ['osascript', '-e', osa_cmd], text=True).strip()
    except Exception:
        browser_name = None

    # Finderで解決できない場合はSpotlightで検索
    if not browser_name:
        try:
            # bundle_id は安全な値（事前定義または検証済み）だが念のためエスケープ
            safe_bundle_id_for_mdfind = bundle_id.replace("'", "'\\''")
            app_paths = subprocess.check_output(
                ["mdfind", f"kMDItemCFBundleIdentifier == '{safe_bundle_id_for_mdfind}'"],
                text=True
            ).splitlines()
            if app_paths:
                app_path = app_paths[0]
                display_name = subprocess.check_output(
                    ["mdls", "-name", "kMDItemDisplayName", "-raw", app_path],
                    text=True
                ).strip()
                if display_name:
                    browser_name = display_name
                else:
                    browser_name = os.path.basename(app_path)
        except Exception:
            browser_name = None

    # .app 拡張子が含まれる場合があるので除く
    if browser_name and browser_name.endswith(".app"):
        browser_name = browser_name[:-4]

    if not browser_name:
        # 取得に失敗した場合は一般的な名称を返す
        if "chrome" in bundle_id.lower():
            browser_name = "Google Chrome"
        elif "firefox" in bundle_id.lower():
            browser_name = "Firefox"
        elif "edge" in bundle_id.lower():
            browser_name = "Microsoft Edge"
        else:
            browser_name = "Safari"

    return {
        "status": "success",
        "browser": browser_name,
        "bundle_id": bundle_id
    }


def click_web_element(app_name: str, role: str, name: str) -> Dict[str, Any]:
    """
    ブラウザ内のWeb要素をクリック
    """
    # パラメータをサニタイズ（インジェクション対策）
    safe_app_name = sanitize_for_jxa_string(app_name, is_app_name=True)
    safe_role = sanitize_for_jxa_string(role)
    safe_name = sanitize_for_jxa_string(name)

    # 共通テンプレートを使用（コード重複の削減）
    jxa_script = build_web_click_template(safe_app_name, safe_role, safe_name)

    try:
        import pyautogui
        
        result = subprocess.run(
            ['osascript', '-l', 'JavaScript', '-e', jxa_script],
            capture_output=True,
            text=True,
            timeout=5
        )
        output = result.stdout.strip()
        
        if output.startswith("{"):
            data = json.loads(output)
            if data.get("status") == "success":
                pyautogui.click(x=data["x"], y=data["y"], duration=0.5,
                                tween=pyautogui.easeInOutQuad)
                return {"status": "success"}
        
        if output == "success":
            return {"status": "success"}
        else:
            return {"status": "error", "message": output}
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "Web要素クリックがタイムアウトしました（5秒以上）"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
