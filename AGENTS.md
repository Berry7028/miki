# リポジトリガイドライン

## プロジェクト概要
macOS向けのElectronデスクトップアプリです。Controller（TypeScript/Bun）がLLMの対話とアクション制御を行い、Executor（Python）がOS操作を実行します。

## プロジェクト構造
- `desktop/`: Electronアプリ本体
  - `desktop/main.js`: ウィンドウ管理、CSP設定、Controller起動、権限チェック、トレイ制御。
  - `desktop/preload.js`: `contextBridge` による安全なAPI公開（`window.miki`）。
  - `desktop/renderer/`: React UI（TSX + MUI + Emotion + CSS）。
    - `index.html` / `chat.html` / `overlay.html`
    - `index.tsx` / `chat.tsx` / `overlay.tsx` / `theme.ts` / `types.ts`
    - `renderer/dist/`: ビルド成果物（編集しない）
  - `desktop/backend-src/controller/main.ts`: Controllerのデスクトップ用エントリ。
  - `desktop/scripts/build-backend.mjs`: Controllerバンドルスクリプト。
  - `desktop/backend/`: バンドル済みController/Executor（gitignore対象）。
- `src/controller/`: LLM制御ロジック（`agent.ts`, `action-executor.ts`, `python-bridge.ts`, `llm-client.ts` など）。
- `src/executor/`: Python Executor（`main.py`, `actions/`, `utils/`, `requirements.txt`）。
- `venv/`: Python仮想環境。

## 開発・ビルドコマンド
推奨は `dev.sh`。状態チェックやビルドを一括管理できます。

- `./dev.sh`（対話メニュー）
- `./dev.sh doctor`
- `./dev.sh install`
- `./dev.sh setup-python`
- `./dev.sh build-all`
- `./dev.sh start --debug`
- `./dev.sh dist`

> **注意:**  
一部の `dev.sh` コマンドは対話型メニューとなっていますが、自動化やCLIツール環境ではそのまま利用できない場合があります。  
この場合は、スクリプトの引数を指定して実行するか、下記のように直接ターミナルで `bun` コマンドを用いて操作してください（例：`bun run dev` や `bun run build-all` など）。  
また、一時的なビルドや開発作業で仮設用スクリプトを追加することは避け、既存のシンプルな `bun` コマンドを優先して利用してください。


手動で実行する場合:
- `bun --cwd desktop run dev`
- `bun --cwd desktop run build:backend`
- `bun --cwd desktop run dist`
- ルートのショートカット: `bun run dev` / `bun run desktop:install` / `bun run desktop:build:backend` / `bun run desktop:dist`

## コーディング規約・命名規則
- JSON/HTML は2スペースインデント。JSは既存のダブルクォートを踏襲。
- `desktop/` は CommonJS（`require` / `module.exports`）を維持。
- Rendererは MUI + Emotion を使用。スタイルは `desktop/renderer/*.css` と `desktop/renderer/theme.ts` を優先。
- CSP対策で Emotion の style nonce が必須。新規UIでスタイルを注入する場合は `window.miki.getStyleNonce()` を使う（`desktop/renderer/index.tsx` / `desktop/renderer/chat.tsx` を参照）。
- 外部アセットを追加する場合は `desktop/main.js` の CSP を更新する。
- Node/Bun 実行は Bun を優先し、READMEや既存スクリプトで指定がある場合はそちらに従う。
- Python は `src/executor/requirements.txt` と `venv/` を前提にする。

## テストガイドライン
自動テストは未導入。追加する場合は以下を踏襲する：
- `desktop/package.json` に `test` スクリプトを追加。
- `desktop/renderer/__tests__/` など明確な場所に配置。
- ファイル名は `*.test.js` のように命名。

## コミット＆プルリクエストガイドライン
直近のコミット履歴では慣習的プレフィックス（例：`feat:`）と短い要約が混在。
このパターンを踏襲：
- タイプ（`feat:`, `fix:`）付きまたは短い現在形要約を先頭行に。
- 1行目は約72文字以内を目安に。

プルリクエストには以下を含めること：
- 振る舞いの簡潔な記述。
- `desktop/renderer/` のUI変更にはスクリーンショット添付。
- 関連するIssueリンク。

## セキュリティ＆設定のポイント
- `desktop/main.js` では `nodeIntegration: false` と `contextIsolation: true` を維持。
- APIキーは `safeStorage` で暗号化保存される。旧`.env`は `~/Library/Application Support/miki-desktop/.env` に置かれる。
