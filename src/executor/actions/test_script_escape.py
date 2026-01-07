"""
Tests for script_escape module
これらのテストは、AppleScript/JXAの文字列エスケープが正しく機能することを確認します。
"""

import sys
import os

# モジュールパスを追加
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from script_escape import escape_applescript_string, escape_jxa_string


def test_escape_applescript_string():
    """AppleScript文字列エスケープのテスト"""
    
    # 基本的な文字列（エスケープ不要）
    assert escape_applescript_string("Hello") == "Hello"
    assert escape_applescript_string("こんにちは") == "こんにちは"
    
    # ダブルクォートのエスケープ
    assert escape_applescript_string('He said "Hello"') == 'He said \\"Hello\\"'
    assert escape_applescript_string('"quoted"') == '\\"quoted\\"'
    
    # バックスラッシュのエスケープ
    assert escape_applescript_string("Path\\to\\file") == "Path\\\\to\\\\file"
    assert escape_applescript_string("C:\\Users\\test") == "C:\\\\Users\\\\test"
    
    # 複合ケース（バックスラッシュとダブルクォート）
    assert escape_applescript_string('Path\\to\\"file"') == 'Path\\\\to\\\\\\"file\\"'
    
    # None と空文字列
    assert escape_applescript_string(None) == ""
    assert escape_applescript_string("") == ""
    
    # 攻撃的な入力パターン
    # AppleScriptコマンドインジェクション試行
    malicious_input = '" then return "INJECTED'
    escaped = escape_applescript_string(malicious_input)
    assert '"' not in escaped or '\\"' in escaped
    assert escaped == '\\" then return \\"INJECTED'
    
    print("✅ All AppleScript escape tests passed!")


def test_escape_jxa_string():
    """JXA (JavaScript) 文字列エスケープのテスト"""
    
    # 基本的な文字列（エスケープ不要）
    assert escape_jxa_string("Hello") == "Hello"
    assert escape_jxa_string("こんにちは") == "こんにちは"
    
    # ダブルクォートのエスケープ
    assert escape_jxa_string('He said "Hello"') == 'He said \\"Hello\\"'
    assert escape_jxa_string('"quoted"') == '\\"quoted\\"'
    
    # バックスラッシュのエスケープ
    assert escape_jxa_string("Path\\to\\file") == "Path\\\\to\\\\file"
    
    # 改行のエスケープ
    assert escape_jxa_string("Line 1\nLine 2") == "Line 1\\nLine 2"
    assert escape_jxa_string("CR\rLF") == "CR\\rLF"
    
    # タブのエスケープ
    assert escape_jxa_string("Tab\there") == "Tab\\there"
    
    # バックスペースとフォームフィード
    assert escape_jxa_string("Back\bspace") == "Back\\bspace"
    assert escape_jxa_string("Form\ffeed") == "Form\\ffeed"
    
    # 複合ケース
    assert escape_jxa_string('Line 1\n"quoted"\\path') == 'Line 1\\n\\"quoted\\"\\\\path'
    
    # None と空文字列
    assert escape_jxa_string(None) == ""
    assert escape_jxa_string("") == ""
    
    # 攻撃的な入力パターン
    # JavaScriptコードインジェクション試行
    malicious_input = '"; alert("XSS"); //'
    escaped = escape_jxa_string(malicious_input)
    assert escaped == '\\"; alert(\\"XSS\\"); //'
    
    # 複数行インジェクション試行
    malicious_multiline = 'test"\nJSON.stringify({hacked: true})\n//'
    escaped = escape_jxa_string(malicious_multiline)
    assert escaped == 'test\\"\\nJSON.stringify({hacked: true})\\n//'
    
    print("✅ All JXA escape tests passed!")


def test_real_world_scenarios():
    """実際のユースケースでのテスト"""
    
    # アプリケーション名に特殊文字が含まれる場合
    app_names = [
        "Google Chrome",
        'App "with quotes"',
        "Path\\with\\backslash",
        "Multi\nLine\nApp",
    ]
    
    for app_name in app_names:
        escaped_as = escape_applescript_string(app_name)
        escaped_jxa = escape_jxa_string(app_name)
        
        # エスケープされた文字列に危険な未エスケープ文字が含まれないことを確認
        assert '"\n' not in escaped_as, f"Unescaped newline in AppleScript: {app_name}"
        assert '"\n' not in escaped_jxa, f"Unescaped newline in JXA: {app_name}"
    
    # UI要素のroleとname
    ui_elements = [
        ("AXButton", "Click \"me\""),
        ("AXTextField", "Enter\ntext\nhere"),
        ("AXWindow", "Path: C:\\Users\\test"),
    ]
    
    for role, name in ui_elements:
        escaped_role = escape_jxa_string(role)
        escaped_name = escape_jxa_string(name)
        
        # エスケープ後も文字列として有効であることを確認
        assert escaped_role is not None
        assert escaped_name is not None
    
    print("✅ All real-world scenario tests passed!")


def run_all_tests():
    """すべてのテストを実行"""
    print("Starting script_escape tests...")
    print("-" * 50)
    
    try:
        test_escape_applescript_string()
        test_escape_jxa_string()
        test_real_world_scenarios()
        
        print("-" * 50)
        print("🎉 All tests passed successfully!")
        return True
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
