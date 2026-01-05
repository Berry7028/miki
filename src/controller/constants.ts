// パフォーマンス最適化設定
// Note: 環境に応じて調整可能。高速化優先だが、安定性に問題がある場合は値を増やすこと
export const PERFORMANCE_CONFIG = {
  // 最大ステップ数: 通常タスクは10-20ステップだが、リトライやエラー対応の余裕を見て30に設定
  MAX_STEPS: 30,
  // ステップ間の遅延: 1秒だと体感が重いため、UIが追いつく最低ラインとして500msに設定
  // システムが不安定な場合は1000msに戻すことを推奨
  STEP_DELAY_MS: 500,
  // バッチアクション間の遅延: OSに負荷をかけすぎない程度の100msに設定
  // 一部の環境で安定しない場合は200-300msに増やすこと
  BATCH_ACTION_DELAY_MS: 100,
  // JPEG品質: 85で視覚品質を維持しつつファイルサイズを削減（1-100）
  // AIの認識精度に問題がある場合は90-95に上げることを検討
  SCREENSHOT_QUALITY: 85,
};

// LLM履歴のサイズ制御
export const HISTORY_CONFIG = {
  MAX_MESSAGES: 24,
  MAX_TEXT_CHARS: 1000,
  MAX_DATA_CHARS: 2000,
  MAX_UI_NODES: 200,
  MAX_UI_DEPTH: 2,
  MAX_UI_CHILDREN: 20,
  MAX_WEB_ELEMENTS: 200,
  MAX_ACTIONS: 8,
};

// デバッグログ用定数
export const DEBUG_TEXT_TRUNCATE_LENGTH = 200;
export const DEBUG_SCREENSHOT_PREVIEW_LENGTH = 50;

export const SYSTEM_PROMPT = `
あなたはMacOSを精密に操作する自動化エージェントです。
提供された「関数ツール」（functionCall）だけを使い、現在のスクリーンショット、マウス位置、履歴を踏まえて目標達成のための次の一手を決定してください。

### 利用可能なアクション
- 用意された関数ツール (click, type, press, hotkey, move, scroll, drag, elementsJson, clickElement, typeToElement, focusElement, webElements, clickWebElement, osa, wait, search, done) のみを使用してください。
- 必要に応じて複数の functionCall を一度に返して構いません（依存する順序に注意してください）。

### 座標系
- **正規化座標**: X, Yともに **0から1000** の範囲を使用してください。
- (0,0)は左上、(1000,1000)は右下です。
- 実際の画面解像度: {SCREEN_WIDTH}x{SCREEN_HEIGHT}。

### 回答ルール
- JSONテキストを返さないでください。必ずfunctionCallとしてツールを呼び出してください。
- 状態が不明なときは elementsJson / webElements などでUI構造を先に取得してください。
- ウィンドウが非アクティブな場合は、まずフォーカスを与えてから操作してください。

### 成功のための戦略
- **アクティブなアプリの確認**: 現在アクティブなアプリケーションの名前は、画面左上のリンゴマークのすぐ右隣にあるメニューバーに表示されます。操作対象のアプリがアクティブかどうかを判断する際の参考にしてください。
- **macOSのウィンドウ操作**: 非アクティブなウィンドウ（タイトルバーの色が薄い、背後にある等）を操作する場合、最初のクリックはウィンドウを前面に出す（フォーカスする）ために使われ、要素はクリックされません。
  - **確認の徹底**: 各アクションの後、スクリーンショットを見て意図した通りに動いたか（メニューが開いたか、入力されたか等）を確認してください。変化がない場合はウィンドウが非アクティブだった可能性が高いです。
- **ブラウザ操作**: ブラウザを起動する場合は osa アプリ名は Comet を使用します。
- **UI把握**: 操作対象の座標が不明確な場合は、まず elementsJson または webElements を実行して位置を確認してください。
- **堅牢性**: 可能な限り clickElement などの要素ベースの操作を優先してください。
`;
