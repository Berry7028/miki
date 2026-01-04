# デバッグモード

## 概要

`--debug` フラグを使用すると、エージェントの動作に関する詳細なログ情報が出力されます。これにより、AIがどのようなツールを呼び出し、どのような応答を受け取り、どのような内容をAIに送信しているかを詳しく確認できます。

## 使い方

### 方法1: `bun run dev` から実行

```bash
bun run dev -- --debug
```

### 方法2: `dev.sh` スクリプトから実行

```bash
./dev.sh start --debug
```

または

```bash
./dev.sh start-fresh --debug
```

## デバッグモードで出力される情報

### 1. ツール呼び出しログ

エージェントがツールを呼び出すたびに、以下の情報が出力されます：

```
[DEBUG] ========== Executing Action ==========
[DEBUG] Action: elementsJson
[DEBUG] Params (original): {"app_name": "Finder", "max_depth": 3}
[DEBUG] Result: {"status": "success", "ui_data": [...]}
[DEBUG] UI Elements Retrieved: [詳細なUI要素情報]
[DEBUG] ==========================================
```

特に以下のツールの詳細な結果が表示されます：
- `elementsJson`: UI要素の取得
- `webElements`: Web要素の取得
- その他のすべてのアクション

### 2. AIへの送信内容ログ

AIにリクエストを送信する際、以下の情報が出力されます：

```
[DEBUG] ========== Sending to AI (Step 1, Retry 0) ==========
[DEBUG] Using cache: No
[DEBUG] Prompt text: 現在のマウスカーソル位置: (500, 300) [正規化座標]...
[DEBUG] History length: 2 messages
[DEBUG] Total prompt parts: 5
[DEBUG]   History[0] (user): text(私の目標は次の通りです: ...)
[DEBUG]   History[1] (user): text(これが現在のデスクトップの初期状態です...), image(image/png)
[DEBUG] Screenshot included: iVBORw0KGgoAAAANSUhEUgAAB... (150000 chars)
[DEBUG] ==========================================
```

### 3. AIからの応答ログ

AIからの応答を受け取った際、以下の情報が出力されます：

```
[DEBUG] ========== AI Response (Step 1, Retry 0) ==========
[DEBUG] Raw response: {"action":"click","params":{"x":500,"y":300}}
[DEBUG] Thought process: まずFinderを開いて...
[DEBUG] Parsed action: {
  "action": "click",
  "params": {
    "x": 500,
    "y": 300
  }
}
[DEBUG] ==========================================
```

### 4. スクリーンショット保存

各ステップで取得したスクリーンショットが `.screenshot/` ディレクトリに保存されます：

```
.screenshot/
  ├── step-001-2026-01-04T14-15-30-123Z.png
  ├── step-002-2026-01-04T14-15-35-456Z.png
  └── step-003-2026-01-04T14-15-40-789Z.png
```

ファイル名の形式：`step-{ステップ番号}-{タイムスタンプ}.png`

## ログの確認方法

デバッグログは標準エラー出力（stderr）に出力されるため、通常のElectronコンソールまたはターミナルで確認できます。

### Electronアプリ内で確認

1. 開発者ツールを開く（表示 > 開発者ツールを表示）
2. Console タブを確認
3. `[DEBUG]` で始まるログを検索

### ターミナルで確認

ターミナルから直接起動した場合、そのままターミナルに出力されます：

```bash
./dev.sh start --debug
```

## 注意事項

- デバッグモードでは大量のログが出力されるため、パフォーマンスに若干の影響があります
- スクリーンショットは `.screenshot/` ディレクトリに保存されますが、`.gitignore` に含まれているため Git にはコミットされません
- 本番環境では `--debug` フラグを使用しないでください
- スクリーンショットには機密情報が含まれる可能性があるため、取り扱いに注意してください

## トラブルシューティング

### スクリーンショットが保存されない

- `.screenshot/` ディレクトリが自動的に作成されます
- 書き込み権限を確認してください

### ログが表示されない

- `--debug` フラグが正しく渡されているか確認してください
- Electron の開発者ツールを開いて Console タブを確認してください
