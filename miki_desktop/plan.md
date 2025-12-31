j# Desktop 版 miki エージェント作成プラン

## 目的
既存の CLI 版 miki（親ディレクトリ）を参考に、Electron ベースの macOS デスクトップアプリとして操作体験を提供する。CLI の「Controller（TypeScript/Bun）」と「Executor（Python）」の分離構成を維持しつつ、UI から安全に実行・停止・ログ閲覧できる形にする。

## 前提
- 親ディレクトリ `/Users/kouta/Desktop/miki` に CLI 実装が存在する。
- Desktop 版は現ディレクトリ `/Users/kouta/Desktop/miki/miki_desktop` で構築する。
- macOS 権限（アクセシビリティ、画面収録）をユーザーが付与できる前提。

## スコープ
- UI: 最前面常駐オーバーレイでプロンプト入力、実行/停止、状況/ログ表示、スクリーンショット閲覧。
- ウィンドウ: `alwaysOnTop` + `visibleOnAllWorkspaces`、一般的な画面キャプチャに映らない設定（`contentProtection`）。
- 実行エンジン: 既存 Controller/Executor をプロセスとして起動し IPC で連携。
- 設定: `.env` 取り込み、API キー管理（初期は手動入力/読み込み）。
- 配布: ビルド時に backend（Node 対応 Controller + Python Executor）を同梱。

## 進め方
1. **既存 CLI 実装の読み込み**
   - `src/controller` と `src/executor` の I/O 仕様（stdin/stdout JSON）を整理。
   - 依存関係（Bun/Python/venv）と起動コマンドを確認。
2. **Electron 側の実行基盤**
   - `main.js` から Controller/Executor を spawn。
   - IPC（main <-> renderer）でログ/ステータス/結果を転送。
3. **最前面オーバーレイ UI 設計**
   - 入力欄（ゴール、ヒント）、状態表示（ステップ数、現在のアクション）。
   - 実行中ログとスクリーンショットのタイムライン表示。
   - ウィンドウ設定: `alwaysOnTop` / `visibleOnAllWorkspaces` / `contentProtection` を適用。
4. **権限・安全対策**
   - failsafe/緊急停止の UI ボタン。
   - 権限不足時の案内（アクセシビリティ/画面収録）。
5. **設定/配布準備**
   - `.env` 読み込み方式（ローカル保存 or 設定画面）。
   - バックエンド同梱は `electron-builder` の `extraResources` で配布。
   - Controller は Node 実行前提に移行（Bun 依存を外し JS バンドル化）。
   - Executor は PyInstaller の onedir でバイナリ化して同梱。

## 成果物
- Desktop UI（最前面オーバーレイ）を通じて CLI と同等の操作を実行できること。
- 実行ログとスクリーンショットが UI で確認できること。
- 一般的な画面キャプチャで UI が映りにくいこと（`contentProtection`）。
- 権限や設定の不足時に明確な案内が出ること。
 - ビルド成果物に backend が同梱されること。

## 不明点 / 要確認
- CLI 側の起動コマンドと必要引数（goal/hint/flags）。
- スクリーンショットの受け渡し方式（ファイル or base64）。
- LLM モデルの切替要件（Gemini 固定か可変か）。
- backend の配布形式（Python: PyInstaller onedir / Controller: Node 実行）。
