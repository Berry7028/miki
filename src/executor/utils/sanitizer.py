"""AppleScript/JXA 用の入力サニタイズユーティリティ

このモジュールは、AppleScript および JXA (JavaScript for Automation) に
文字列を挿入する際のインジェクション攻撃を防ぐためのサニタイズ関数を提供します。
"""

import re
from typing import Optional


# JXA/AppleScript で危険な文字パターン
DANGEROUS_PATTERNS = [
    r'--',           # コメント開始
    r'/\*',          # 複数行コメント開始
    r'\*/',          # 複数行コメント終了
    r';',            # ステートメント区切り
    r'\bnreturn\b',  # return 文
    r'\bfunction\b', # function キーワード
    r'\bconst\b',    # const キーワード
    r'\bvar\b',      # var キーワード
    r'\blet\b',      # let キーワード
    r'\beval\b',     # eval 関数
    r'\bdo\s+shell\b',  # AppleScript の do shell script
    r'\bsystem\b',   # system 関数
    r'\bexec\b',     # exec 関数
]


def _validate_app_name(value: str) -> Optional[str]:
    """アプリケーション名として安全かバリデーション

    アプリケーション名は通常、英数字とスペース、一部の記号のみを含みます。

    Args:
        value: バリデーションする文字列

    Returns:
        安全な場合は None、危険な場合はエラーメッセージ
    """
    # アプリ名の長さチェック（過度に長い名前は拒否）
    if len(value) > 100:
        return "アプリケーション名が長すぎます（最大100文字）"

    # 危険なパターンチェック
    value_lower = value.lower()
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, value_lower):
            return f"アプリケーション名に危険な文字列が含まれています: {pattern}"

    # アプリ名として妥当な文字のみ許可
    # 英数字、スペース、ハイフン、アンダースコア、ピリオド、括弧
    if not re.match(r'^[\w\s\-\.\(\)\[\]]+$', value):
        return "アプリケーション名に無効な文字が含まれています"

    return None


def _validate_ui_identifier(value: str) -> Optional[str]:
    """UI識別子（role, name）として安全かバリデーション

    Args:
        value: バリデーションする文字列

    Returns:
        安全な場合は None、危険な場合はエラーメッセージ
    """
    # 長さチェック
    if len(value) > 500:
        return "UI識別子が長すぎます（最大500文字）"

    # 危険なパターンチェック（より厳格）
    value_lower = value.lower()
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, value_lower):
            return f"UI識別子に危険な文字列が含まれています: {pattern}"

    # 引用符のチェック（ペアになっている必要がある）
    if value.count('"') > 0 or value.count("'") > 0:
        return "UI識別子に引用符を含めることはできません"

    return None


def sanitize_for_jxa_string(value: str, is_app_name: bool = False) -> str:
    """JXA 文字列リテラルに挿入するためのサニタイズ

    JXA の文字列リテラル内で使用される特殊文字をエスケープします。
    また、アプリ名の場合は追加のバリデーションを行います。

    Args:
        value: サニタイズする文字列
        is_app_name: アプリケーション名かどうか（追加のバリデーションを行う）

    Returns:
        サニタイズされた文字列

    Raises:
        ValueError: バリデーションに失敗した場合
    """
    if not isinstance(value, str):
        raise TypeError(f"文字列型である必要があります: {type(value)}")

    # アプリ名の場合は追加のバリデーション
    if is_app_name:
        error = _validate_app_name(value)
        if error:
            raise ValueError(error)
    else:
        # UI識別子のバリデーション
        error = _validate_ui_identifier(value)
        if error:
            raise ValueError(error)

    # バックスラッシュを最初にエスケープ（重要）
    escaped = value.replace('\\', '\\\\')

    # ダブルクォートをエスケープ
    escaped = escaped.replace('"', '\\"')

    # 改行文字をエスケープシーケンスに変換
    escaped = escaped.replace('\n', '\\n')
    escaped = escaped.replace('\r', '\\r')
    escaped = escaped.replace('\t', '\\t')

    # その他の制御文字を除去
    escaped = ''.join(char if ord(char) >= 32 or char in '\n\r\t' else ''
                     for char in escaped)

    return escaped


def sanitize_applescript_string(value: str, is_app_name: bool = False) -> str:
    """AppleScript 文字列リテラルに挿入するためのサニタイズ

    AppleScript の文字列リテラル内で使用される特殊文字をエスケープします。

    Args:
        value: サニタイズする文字列
        is_app_name: アプリケーション名かどうか（追加のバリデーションを行う）

    Returns:
        サニタイズされた文字列

    Raises:
        ValueError: バリデーションに失敗した場合
    """
    if not isinstance(value, str):
        raise TypeError(f"文字列型である必要があります: {type(value)}")

    # アプリ名の場合は追加のバリデーション
    if is_app_name:
        error = _validate_app_name(value)
        if error:
            raise ValueError(error)
    else:
        # UI識別子のバリデーション
        error = _validate_ui_identifier(value)
        if error:
            raise ValueError(error)

    # バックスラッシュを最初にエスケープ
    escaped = value.replace('\\', '\\\\')

    # ダブルクォートをエスケープ
    escaped = escaped.replace('"', '\\"')

    # 改行文字をエスケープ
    escaped = escaped.replace('\n', '\\n')
    escaped = escaped.replace('\r', '\\r')
    escaped = escaped.replace('\t', '\\t')

    # その他の制御文字を除去
    escaped = ''.join(char if ord(char) >= 32 or char in '\n\r\t' else ''
                     for char in escaped)

    return escaped


# エイリアス（利便性のため）
sanitize = sanitize_for_jxa_string  # デフォルトは JXA 用
