# miki desktop

macOS向けElectronアプリの最小構成スターターです。

## セットアップ

```sh
npm install
```

## 起動

```sh
npm run dev
```

## バックエンドのビルド

Controller は Node 向けにバンドルし、Executor は PyInstaller で同梱します。

```sh
npm run build:backend
```

Python Executor の例（親リポジトリで実行）:

```sh
source venv/bin/activate
pyinstaller --name miki-executor --onedir src/executor/main.py --distpath desktop/backend/executor
```

生成物は `backend/executor/miki-executor/` 配下に作成されます。

## 配布ビルド

```sh
npm run dist
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
