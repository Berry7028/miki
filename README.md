# MacOS Automation Agent

Vision LLM (GPT-4o) と PyAutoGUI を使用した、MacOS 自動操作 CLI エージェントです。

## 構成
- **Bun (TypeScript)**: メインの Agent Loop 管理。
- **Python (PyAutoGUI)**: マウス・キーボード操作の実行。

## 準備

1. **APIキーの設定**:
   `OPENAI_API_KEY` を環境変数として設定してください。
   ```bash
   export OPENAI_API_KEY='your-api-key'
   ```

2. **依存関係のインストール**:
   ```bash
   # Python (venv)
   python3 -m venv venv
   source venv/bin/activate
   pip install pyautogui pillow pyobjc-core pyobjc-framework-Quartz pyobjc-framework-Cocoa

   # Bun
   bun install
   ```

3. **実行権限の付与**:
   MacOS の「システム設定 > プライバシーとセキュリティ > アクセシビリティ」にて、実行するターミナル（または `python`, `bun`）に許可を与えてください。

## 使い方

デフォルトのゴール（YouTubeで検索）で実行する場合：
```bash
bun run index.ts
```

特定のゴールを指定する場合：
```bash
bun run index.ts "ブラウザを開いて、今日の天気を確認してください。"
```

## 注意事項
- **緊急停止**: `FAILSAFE` 機能が有効です。マウスカーソルを画面の四隅（左上、右上、左下、右下）のいずれかに素早く移動させると、操作が強制停止されます。
- **解像度**: Retina ディスプレイのスケーリングを考慮した座標変換を行っていますが、環境により調整が必要な場合があります。
