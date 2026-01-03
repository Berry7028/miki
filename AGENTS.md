# リポジトリガイドライン

## プロジェクト構造およびモジュールの整理
- `desktop/`: Electron デスクトップアプリ。
  - `desktop/main.js`: メインプロセス（ウィンドウ＋バックエンド起動）。
  - `desktop/preload.js`: `contextBridge` によるセキュアブリッジ。
  - `desktop/renderer/`: UI（`index.html`, `renderer.js`）。Tailwind CDN 使用。
  - `desktop/backend-src/`: デスクトップビルド用 Node コントローラーエントリ。
  - `desktop/backend/`: バンドル済みコントローラー／エグゼキューター出力（gitignore 済み）。
- `src/controller/`: LLM 制御ロジック（デスクトップバックエンドビルドと共通）。
- `src/executor/`: macOS オートメーションエグゼキューター（Python）。
- `venv/`: Python 仮想環境。

## ビルド・テスト・開発コマンド
- `npm --prefix desktop install`：デスクトップ依存パッケージインストール。
- `npm --prefix desktop run dev`：Electron アプリ起動。
- `npm --prefix desktop run build:backend`：デスクトップコントローラーバンドル。
- `npm --prefix desktop run dist`：デスクトップ配布ビルド。

## コーディング規約・命名規則
- JSON/HTML は 2 スペースインデント。JS は既存のダブルクォートスタイルを踏襲。
- ファイル名は小文字＆説明的（例：`desktop/renderer/renderer.js`）。
- メインプロセスでは簡潔で分かりやすい関数名（`createWindow`, `ensureController` など）を使用。
- TypeScript/Python は既存ツール（`prettier`, `autopep8` など）で整形。

## テストガイドライン
自動テストは未導入。テストを追加する場合は以下の方針で：
- 対象階層の `desktop/package.json` に `test` スクリプトを追加。
- `desktop/renderer/__tests__/` など明確な場所に配置。
- ファイル名は `*.test.js` のように命名。

## コミット＆プルリクエストガイドライン
直近のコミット履歴では慣習的プレフィックス（例：`feat:`）と短い要約が混在。
このパターンを踏襲：
- タイプ（`feat:`, `fix:`）付きまたは短い現在形要約を先頭行に。
- 1 行目は約 72 文字以内を目安に。

プルリクエストには以下を含めること：
- 振る舞いの簡潔な記述。
- `desktop/renderer/` の UI 変更にはスクリーンショット添付。
- 関連する Issue リンク。

## セキュリティ＆設定のポイント
- `desktop/main.js` では `nodeIntegration: false` と `contextIsolation: true` を維持。
- 新しい外部アセットが必要なら `desktop/renderer/index.html` の CSP を更新。
