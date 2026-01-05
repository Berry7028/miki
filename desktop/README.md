# miki desktop

macOS向けElectronアプリの最小構成スターターです。

## セットアップ

```sh
bun install
```

## 起動

```sh
bun run dev
```

## バックエンドのビルド

Controller は Bun 向けにバンドルし、Executor は PyInstaller で同梱します。

```sh
bun run build:backend
```

Python Executor の例（親リポジトリで実行）:

```sh
source venv/bin/activate
pyinstaller --name miki-executor --onedir src/executor/main.py --distpath desktop/backend/executor
```

生成物は `backend/executor/miki-executor/` 配下に作成されます。

## 配布ビルド

```sh
bun run dist
```

`.env` はアプリのユーザーデータ配下に置きます:

```txt
~/Library/Application Support/miki-desktop/.env
```

## 構成

- `main.js`: メインプロセス
- `preload.js`: セキュアなブリッジ
- `renderer/`: 画面 (Tailwind CDN)
- `backend-src/`: Controller のバンドル元
- `backend/`: 同梱 backend（Controller/Executor）
