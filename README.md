# miki desktop

macOS向けの自動操作エージェント（デスクトップアプリ）です。
Electron で最前面の操作パネルを提供し、Python Executor と連携してOS操作を実行します。

## クイックスタート（推奨）

### 統合CLI `dev.sh`

`dev.sh` はセットアップ・起動・ビルド・配布までをまとめた統合CLIです。状態パネル（Bun / node_modules / venv / ビルド成果物など）を表示し、色分けされたメニューから安全に操作できます。

```bash
# 対話型メニュー（状態表示つき）
./dev.sh

# 状態チェックと次にやるべきことの提案
./dev.sh doctor
```

数字選択と同じ機能をサブコマンドでも利用できます。慣れている場合は直接叩いてください。

```bash
./dev.sh install         # Node 依存インストール
./dev.sh setup-python    # Python 仮想環境の作成/再生成
./dev.sh build-all       # レンダラー・バックエンド・エグゼキュータを一括ビルド
./dev.sh start --debug   # デバッグモードで起動
./dev.sh dist            # 配布ビルド
```

**初回セットアップ手順** (すべて dev.sh から実行できます):
```bash
# 1. 状態確認（警告が出たら指示に従う）
./dev.sh doctor

# 2. Node 依存関係をインストール
./dev.sh install

# 3. Python 仮想環境をセットアップ（壊れている場合は再生成）
./dev.sh setup-python

# 4. バックエンド/エグゼキュータを含めてビルド
./dev.sh build-all

# 5. アプリを起動
./dev.sh start
```

### 開発スクリプトのコマンド一覧

- `start` / `start --debug` - アプリを起動（開発/デバッグ）
- `start-fresh` - セットアップフラグをリセットして起動
- `build-all` - レンダラー・バックエンド・エグゼキュータを一括ビルド
- `build-renderer` - フロントエンド（レンダラー）をビルド
- `build-backend` / `build` - バックエンドをビルド
- `build-executor` - Pythonエグゼキュータをビルド（venv 必須）
- `dist` - 配布用パッケージをビルド
- `install` - Node 依存関係をインストール
- `setup-python` - Python仮想環境をセットアップ/再生成
- `doctor` / `status` - 状態チェックと推奨アクション表示
- `clean` - ビルド成果物を削除（確認付き）
- `reset-setup` - セットアップフラグをリセット
- `logs` - アプリのログディレクトリを開く
- `help` / `menu` - ヘルプまたは対話型メニューを表示

### dev.sh に機能を追加するには

`dev.sh` は小さなタスクを登録していく構造になっています。

1. `MENU_ITEMS` に `key|ラベル|実行関数|kind` を1行追加する  
   - `kind` は `safe` / `slow` / `info` / `danger` のいずれか（色分けとアイコンに使用）
2. 追加した関数本体を同ファイルに定義する（環境前提がある場合は `preflight_node` / `preflight_python` を呼び出す）
3. サブコマンドからも呼び出したい場合は最下部の `case` に `key)` を追加する

最小限の編集で新しいタスクを組み込めるので、プロジェクト固有の処理も dev.sh に寄せてください。

### デバッグモード

エージェントの動作を詳しく確認したい場合は、`--debug` フラグを使用してください：

```bash
./dev.sh start --debug
# または
bun run dev -- --debug
```

デバッグモードでは以下の情報が出力されます：
- エージェントが呼び出すツール（`elementsJson`, `webElements` など）の詳細
- ツールの実行結果
- AIに送信する内容（プロンプト、履歴、スクリーンショット）
- AIからの応答
- 各ステップのスクリーンショットを `.screenshot/` に保存

詳細は [DEBUG.md](DEBUG.md) を参照してください。

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
