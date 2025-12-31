# miki desktop

macOS向けの自動操作エージェント（デスクトップアプリ）です。
Electron で最前面の操作パネルを提供し、Python Executor と連携してOS操作を実行します。

## クイックスタート（推奨）

### 対話型メニュー（一番簡単）

開発スクリプトを引数なしで実行すると、対話型メニューが表示されます。


```bash
./dev.sh
```

メニューが表示されるので、数字（0-9）を入力して実行したい操作を選択してください。

### コマンドライン引数での実行

直接コマンドを指定して実行することもできます。

```bash
# ヘルプを表示
./dev.sh help

# 依存関係をインストール（Node.js）
./dev.sh install

# Python環境をセットアップ（重要: 初回実行時に必須）
./dev.sh setup-python

# アプリを起動（開発モード）
./dev.sh start

# セットアップをリセットして起動（初回起動テスト）
./dev.sh start-fresh
```

**初回セットアップ手順**:
```bash
# 1. Node.js依存関係をインストール
./dev.sh install

# 2. Python環境をセットアップ（pyperclip等をインストール）
./dev.sh setup-python

# 3. バックエンドをビルド
./dev.sh build

# 4. アプリを起動
./dev.sh start
```

### 開発スクリプトのコマンド一覧

- `start` - アプリを起動（開発モード）
- `start-fresh` - セットアップをリセットしてアプリを起動
- `build` - バックエンドをビルド
- `dist` - 配布用パッケージをビルド
- `clean` - ビルド成果物を削除
- `reset-setup` - セットアップフラグをリセット
- `install` - 依存関係をインストール
- `setup-python` - Python仮想環境をセットアップ
- `logs` - アプリのログディレクトリを開く

## セットアップ（手動）

```bash
npm --prefix desktop install
```

## 起動（手動）

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

## ショートカットキー

- **Command + Shift + Space**: チャットウィンドウを開く/閉じる

チャットウィンドウから直接AIに依頼を送信できます。

## 構成

- `desktop/`: Electron アプリ本体
  - `renderer/index.html`: メイン操作パネル
  - `renderer/chat.html`: チャットウィンドウ
- `src/controller/`: LLM 制御ロジック
- `src/executor/`: MacOS 操作 (Python)
- `venv/`: Python 仮想環境

## セキュリティメモ

- `desktop/renderer/index.html` と `desktop/renderer/chat.html` は Tailwind CDN を使うため、
  CSP に `style-src 'unsafe-inline'` を含めています。
- 本番配布では Tailwind をビルド時コンパイルに切り替えて `unsafe-inline` を避けるか、
  そのリスクをドキュメント化してください。
