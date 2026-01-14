# コンテキスト管理システム

Miki のコンテキスト管理システムは、Anthropic の Manus プロジェクトに触発された、効率的なLLMコンテキストウィンドウ管理を実現します。

## 概要

LLMエージェントの実行中、会話履歴が増大するとトークン数が制限を超えたり、応答速度が低下したりします。このシステムは以下を実現します：

1. **重要度ベースの履歴保持** - 重要なメッセージを優先的に保持
2. **UI データの自動圧縮** - elementsJson や webElements の結果を圧縮
3. **スライディングウィンドウ** - 最新のメッセージと重要な古いメッセージを保持
4. **コンテキストスナップショット** - タスクの進捗状況をコンパクトに保持

## アーキテクチャ

### コンポーネント

```
┌─────────────────────────────────────┐
│   MacOSAgentOrchestrator            │
│   ┌───────────────────────────┐     │
│   │   ContextManager          │     │
│   └───────────────────────────┘     │
│   ┌───────────────────────────┐     │
│   │ ContextManagementPlugin   │     │
│   └───────────────────────────┘     │
└─────────────────────────────────────┘
           ↓
    Google ADK Runner
           ↓
      Gemini LLM API
```

### ContextManager (`src/core/context-manager.ts`)

会話履歴とコンテキストスナップショットを管理します。

**主な機能:**

- `addMessage(message)` - メッセージを追加し、重要度を自動計算
- `getMessages()` - LLM に送信するメッセージリストを取得
- `updateSnapshot(snapshot)` - タスクの進捗情報を更新
- `compressUIData(message)` - UI データを圧縮してトークン数を削減
- `getStats()` - コンテキストの統計情報を取得

**重要度計算ロジック:**

```typescript
基本スコア: 0.5

加算要因:
- エラーメッセージ: +0.3
- 完了メッセージ (done): +0.3
- 計画フェーズの think: +0.2
- スクリーンショット: +0.1

減算要因:
- elementsJson/webElements: -0.1 (再取得可能なため)
```

**メッセージ保持戦略:**

1. 最新メッセージの40%を常に保持
2. 古いメッセージから重要度の高いものを選択
3. 時系列順に再構成

### ContextManagementPlugin (`src/adk/plugins/context-plugin.ts`)

Google ADK のプラグインとして動作し、LLM リクエスト/レスポンスを監視します。

**フック:**

- `beforeModelRequest` - リクエスト送信前に UI データを圧縮
- `afterModelResponse` - レスポンス受信後にメッセージを記録
- `afterFunctionExecution` - ツール実行結果を記録

### 統合 (`src/adk/orchestrator.ts`)

オーケストレーターに統合され、タスク実行中のコンテキストを追跡します。

```typescript
// 初期化
this.contextManager = new ContextManager();

// タスク開始時
this.contextManager.updateSnapshot({
  goal: "ユーザーの目標",
  completedActions: [],
  currentPhase: "planning",
  keyObservations: [],
});

// アクション実行時
completedActions.push(call.name);
this.contextManager.updateSnapshot({ completedActions });

// デバッグモードでは統計を出力
const stats = this.contextManager.getStats();
this.log("info", `Context stats: ${stats.messageCount} messages, ~${stats.estimatedTokens} tokens`);
```

## 設定

`src/core/constants.ts` で調整可能:

```typescript
export const HISTORY_CONFIG = {
  MAX_MESSAGES: 24,          // 最大メッセージ数
  MAX_TEXT_CHARS: 1000,      // テキストの最大文字数
  MAX_DATA_CHARS: 2000,      // データの最大文字数
  MAX_UI_NODES: 200,         // UI 要素の最大ノード数
  MAX_UI_DEPTH: 2,           // UI ツリーの最大深さ
  MAX_UI_CHILDREN: 20,       // 子要素の最大数
  MAX_WEB_ELEMENTS: 200,     // Web 要素の最大数
  MAX_ACTIONS: 8,            // アクションの最大数
};
```

## UI データ圧縮の仕組み

### 圧縮対象

- `elementsJson` の結果（アクセシビリティツリー）
- `webElements` の結果（ブラウザ DOM 要素）

### 圧縮手法

1. **配列の切り詰め**
   - ノード数が `MAX_UI_NODES` を超える場合、先頭のみ保持
   - 子要素が `MAX_UI_CHILDREN` を超える場合、先頭のみ保持

2. **深さ制限**
   - `MAX_UI_DEPTH` を超える階層は `"[truncated]"` に置き換え

3. **冗長フィールドの削除**
   - `description`, `help` などのフィールドを削除

4. **文字列の切り詰め**
   - `MAX_TEXT_CHARS` を超える文字列は切り詰めて `"...[truncated]"` を追加

### 圧縮例

**圧縮前:**
```json
{
  "elements": [
    {
      "role": "AXButton",
      "title": "Submit",
      "description": "Click this button to submit the form",
      "help": "Press enter to activate",
      "position": {"x": 100, "y": 200},
      "children": [ /* 50 children */ ]
    },
    /* ... 300 more elements ... */
  ]
}
```

**圧縮後:**
```json
{
  "elements": [
    {
      "role": "AXButton",
      "title": "Submit",
      "position": {"x": 100, "y": 200},
      "children": [ /* first 20 children */ ]
    },
    /* ... first 200 elements ... */
  ]
}
```

## コンテキストスナップショット

タスクの進捗状況をコンパクトに保持するための構造:

```typescript
interface ContextSnapshot {
  goal: string;                    // ユーザーの目標
  completedActions: string[];      // 完了したアクション
  currentPhase: string;            // 現在のフェーズ
  keyObservations: string[];       // 重要な観察事項
}
```

### 使用例

```typescript
// タスク開始時
contextManager.updateSnapshot({
  goal: "Safari を開いて Google を検索",
  completedActions: [],
  currentPhase: "planning",
  keyObservations: [],
});

// アクション実行時
contextManager.updateSnapshot({
  completedActions: ["osa", "click", "type"],
  currentPhase: "executing",
});

// 完了時
contextManager.updateSnapshot({
  currentPhase: "completed",
  keyObservations: ["Safari を開き、Google を表示しました"],
});
```

## デバッグとモニタリング

### コンテキスト統計の表示

デバッグモード (`--debug`) で 5 ステップごとに統計を出力:

```
Context stats: 18 messages, ~4500 tokens
```

### 統計情報の取得

```typescript
const stats = orchestrator.getContextStats();
console.log(stats);
// {
//   messageCount: 18,
//   estimatedTokens: 4500,
//   hasSnapshot: true
// }
```

### スナップショットの取得

```typescript
const snapshot = orchestrator.getContextSnapshot();
console.log(snapshot);
// {
//   goal: "Safari を開いて Google を検索",
//   completedActions: ["osa", "click", "type"],
//   currentPhase: "completed",
//   keyObservations: ["Safari を開き、Google を表示しました"]
// }
```

## トークン推定

トークン数は以下の式で推定:

```
推定トークン数 = 総文字数 / 4
```

- テキストパーツ: 文字数をカウント
- Function call/response: JSON 文字列化してカウント
- 画像: 固定で 100 トークンと推定

## ベストプラクティス

### 1. 適切な MAX_MESSAGES の設定

- **短いタスク**: 12-16 メッセージ
- **通常のタスク**: 20-24 メッセージ（デフォルト）
- **複雑なタスク**: 30-40 メッセージ

### 2. UI データの取得頻度

- スクリーンショットで判断可能な場合は `elementsJson` を呼ばない
- 3 回連続失敗した場合のみ `elementsJson` にフォールバック

### 3. 重要な情報の保持

- エラーメッセージは自動的に高優先度
- 完了メッセージも高優先度
- 計画フェーズの think は保持

### 4. コンテキストのリセット

新しいタスクを開始する際は必ずリセット:

```typescript
await orchestrator.reset();
```

## まとめ

このコンテキスト管理システムにより、Miki は以下を実現します:

1. **効率的なトークン使用** - 不要なデータを圧縮・削除
2. **重要な情報の保持** - エラーや完了メッセージを優先
3. **長時間タスクの対応** - スライディングウィンドウで古い履歴を管理
4. **透明性** - デバッグモードで統計を可視化

これにより、ユーザーは複雑で長時間のタスクでも、安定した AI エージェントの動作を体験できます。
