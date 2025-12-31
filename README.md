# miki desktop

macOS向けの自動操作エージェント（デスクトップアプリ）です。
Electron で最前面の操作パネルを提供し、Python Executor と連携してOS操作を実行します。

## セットアップ

```bash
npm --prefix desktop install
```

## 起動

```bash
npm --prefix desktop run dev
```

## バックエンドのビルド

Controller は Node 向けにバンドルし、Executor は PyInstaller で同梱します。

```bash
npm --prefix desktop run build:backend
```

Python Executor の例:

```bash
source venv/bin/activate
pyinstaller --name miki-executor --onedir src/executor/main.py --distpath desktop/backend/executor
```

## 配布ビルド

```bash
npm --prefix desktop run dist
```

## 構成

- `desktop/`: Electron アプリ本体
- `src/controller/`: LLM 制御ロジック
- `src/executor/`: MacOS 操作 (Python)
- `venv/`: Python 仮想環境
