# テストガイド

このドキュメントでは、miki プロジェクトのテスト基盤とベストプラクティスについて説明します。

## 概要

プロジェクトではテストフレームワークとして [Vitest](https://vitest.dev/) を使用しています。Vitest は TypeScript と親和性が高く、Jest 互換の API を提供する高速でモダンなテストフレームワークです。

## テストの実行

プロジェクトの指示に従い、`npm` の代わりに `bun` を使用してください。

```bash
# すべてのテストを1回実行
bun test

# ウォッチモードで実行（ファイル変更時に自動再実行）
bun run test:watch

# UIモードで実行（ブラウザベースのインターフェースを開く）
bun run test:ui

# カバレッジレポートの生成
bun run test:coverage
```

## テスト構造

### 配置場所
テストファイルは、対象となるソースファイルと同じディレクトリに `.test.ts` 拡張子で配置します。
- `src/core/python-bridge.test.ts` - Python ブリッジ通信のテスト
- `src/adk/tools/macos-tool-suite.test.ts` - macOS ツールスイートのテスト
- `src/adk/orchestrator.test.ts` - エージェントオーケストレータのテスト

### 組織化
各テストファイルは以下の構造に従います。

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('ComponentName', () => {
  describe('機能グループ', () => {
    it('特定の動作を確認する', () => {
      // Arrange (準備)
      const input = setupTestData();
      
      // Act (実行)
      const result = functionUnderTest(input);
      
      // Assert (検証)
      expect(result).toBe(expectedValue);
    });
  });
});
```

## テストカバレッジ

現在のテスト対象と内容は以下の通りです。

### PythonBridge (`src/core/python-bridge.test.ts`)
- ✓ 座標正規化ロジック
- ✓ JSON パースとエラーハンドリング
- ✓ 指数バックオフによるリトライメカニズム
- ✓ タイムアウト計算

### MacOSToolSuite (`src/adk/tools/macos-tool-suite.test.ts`)
- ✓ 異なる画面サイズに対する座標正規化
- ✓ ツールタイプと構造のバリデーション
- ✓ 待機ツール（Wait）の期間計算
- ✓ ツールレスポンスのフォーマット
- ✓ スクリーンショットデータの取り扱い

### MacOSAgentOrchestrator (`src/adk/orchestrator.test.ts`)
- ✓ イベントタイプの構造
- ✓ フェーズラベルのマッピング（日本語）
- ✓ 画面サイズとブラウザ状態の管理
- ✓ セッション状態の管理
- ✓ エラーメッセージのフォーマット
- ✓ ステップカウントと停止リクエストの処理

## テストの書き方

### 基本的なテスト
```typescript
import { describe, it, expect } from 'vitest';

describe('MyFunction', () => {
  it('期待される結果を返すこと', () => {
    const result = myFunction(input);
    expect(result).toBe(expectedOutput);
  });
});
```

### モックを使用したテスト
```typescript
import { describe, it, expect, vi } from 'vitest';

describe('MyComponent', () => {
  it('依存関係が正しい引数で呼び出されること', () => {
    const mockFn = vi.fn();
    myComponent(mockFn);
    
    expect(mockFn).toHaveBeenCalledWith(expectedArgs);
  });
});
```

### 非同期テスト
```typescript
it('非同期操作をハンドルできること', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

## ベストプラクティス

1. **シンプルかつ焦点を絞る**: 各テストは1つの特定の動作のみを検証するようにします。
2. **説明的なテスト名**: 何をテストしているのかが明確にわかる名前を付けます。
3. **Arrange-Act-Assert パターン**: テストコードを「準備」「実行」「検証」のセクションに整理します。
4. **実装の詳細ではなく振る舞いをテストする**: 内部実装ではなく、入力に対する出力や振る舞いに焦点を当てます。
5. **テストの独立性**: 他のテストの実行順序や状態に依存しないようにします。
6. **適切なアサーション**: テスト内容に最も適した特定のアサーションを選択します。

## テストカテゴリ

### ユニットテスト
個々の関数やクラスを独立してテストします。現在のテストの大部分はユニットテストです。

例：`MacOSToolSuite` における座標正規化ロジックのテスト

### 結合テスト
*(未実装)* 複数のコンポーネントがどのように連携するかをテストします。

### エンドツーエンド (E2E) テスト
*(未実装)* アプリケーション全体のフローをテストします。

## 継続的インテグレーション (CI)

テストは以下の場合に自動的に実行されます。
- プルリクエストの作成/更新
- メインブランチへのプッシュ
- 手動ワークフローの実行

## トラブルシューティング

### テストが見つからない
テストファイルが以下の条件を満たしているか確認してください。
- `src/` ディレクトリ配下にある
- `.test.ts` または `.spec.ts` 拡張子を持っている
- 正しくインポートされている

### モックの問題
外部依存関係をモックする場合：
- ファイルの先頭で `vi.mock()` を使用する
- モックファクトリ内でモジュールレベルの変数を使用しない
- 関数モックには `vi.fn()` を使用する

### タイムアウトエラー
テストがタイムアウトする場合：
- 解決されない Promise がないか確認する
- タイムアウト値を増やす： `it('test', async () => {...}, 10000)` (10秒)
- 非同期コードで `await` を適切に使用しているか確認する

## リソース

- [Vitest ドキュメント](https://vitest.dev/)
- [テストのベストプラクティス](https://vitest.dev/guide/features.html)
- [Vitest API リファレンス](https://vitest.dev/api/)
