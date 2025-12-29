# miki - MacOS 自動操作エージェント

Vision LLM (Gemini) と PyAutoGUI を使用した、MacOS 自動操作 CLI エージェントです。
自然言語による指示を受け取り、画面を認識しながら自律的にタスクを完了します。

## 主な機能

- **Vision LLM ベースの自律操作**: Gemini 3 Flash Preview を使用し、画面のスクリーンショットを解析して次のアクションを決定
- **Google 検索統合**: エージェントが自律的にGoogle検索を行い、操作手順やアプリケーションの使い方を調査
- **バッチ実行**: 関連する操作を一括実行することで、効率的かつ高速な動作を実現
- **UI要素解析**: アクセシビリティAPIを活用し、GUI要素の正確な位置を取得
- **OSAスクリプト実行**: AppleScriptを使用したアプリケーション起動や制御
- **リアルタイムヒント入力**: 実行中にユーザーからの追加指示を受け付け

## アーキテクチャ

```
miki/
├── src/
│   ├── controller/     # TypeScript (Bun) - エージェントの思考・制御
│   │   ├── index.ts    # エントリーポイント
│   │   ├── agent.ts    # Agentロジック（LLM統合、ループ制御）
│   │   └── types.ts    # 型定義・スキーマ
│   └── executor/       # Python - MacOSの実際の操作
│       └── main.py     # PyAutoGUI による操作実行
├── venv/               # Python仮想環境
└── package.json
```

- **Controller (TypeScript/Bun)**: ユーザープロンプトの受付、LLMへのリクエスト、Agent Loopの管理
- **Executor (Python)**: マウス・キーボード操作、スクリーンショット取得、GUI要素の解析

## 準備

### 1. 環境変数の設定

`.env` ファイルを作成し、Gemini API キーを設定してください：

```bash
GEMINI_API_KEY=your-api-key-here
```

### 2. 依存関係のインストール

**Python (venv):**

```bash
python3 -m venv venv
source venv/bin/activate
pip install pyautogui pillow pyobjc-core pyobjc-framework-Quartz pyobjc-framework-Cocoa
```

**Bun:**

```bash
bun install
```

### 3. 実行権限の付与

MacOS の「システム設定 > プライバシーとセキュリティ > アクセシビリティ」にて、実行するターミナル（または `python`、`bun`）に許可を与えてください。

## 使い方

### 基本的な実行

デフォルトのゴール（YouTubeで猫を検索）で実行：

```bash
bun run start
```

### カスタムゴールの指定

```bash
bun run start "ブラウザを開いて、今日の天気を確認してください。"
```

### 実行中のヒント入力

エージェント実行中に、標準入力から追加の指示やヒントを与えることができます：

```bash
# エージェント起動中にターミナルに入力すると、次のステップで反映されます
検索ボタンは右上です
```

## 利用可能なアクション

エージェントが実行できる主なアクション：

- `click`: 指定座標をクリック
- `type`: テキスト入力
- `press`: キー押下（Enter, Escapeなど）
- `hotkey`: ショートカットキー実行（command+c など）
- `move`: マウスカーソル移動
- `scroll`: 画面スクロール
- `osa`: AppleScript実行（アプリ起動など）
- `elements`: GUI要素一覧の取得（アクセシビリティAPI）
- `wait`: 指定秒数待機
- `search`: Google検索実行
- `batch`: 複数アクションの一括実行
- `done`: タスク完了

## 注意事項

- **緊急停止**: PyAutoGUIの `FAILSAFE` 機能が有効です。マウスカーソルを画面の四隅（左上、右上、左下、右下）のいずれかに素早く移動させると、操作が強制停止されます
- **解像度**: Retina ディスプレイのスケーリングを考慮した座標変換（0-1000の正規化座標系）を使用していますが、環境により調整が必要な場合があります
- **最大ステップ数**: デフォルトで20ステップまで実行します（`agent.ts:273`で調整可能）
- **使用ブラウザ**: Comet ブラウザを使用する設計になっています

## 技術仕様

- **LLM**: Google Gemini 3 Flash Preview (vision + tool use)
- **実行環境**: Bun (TypeScript)
- **操作ライブラリ**: PyAutoGUI (Python)
- **座標系**: 0-1000の正規化座標を使用し、実行時に実座標へ変換
- **リトライ機能**: LLMレスポンスのパース失敗時、最大3回まで自動リトライ
