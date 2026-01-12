// Phase labels for thinking action
export const THINKING_PHASE_LABELS: Record<string, string> = {
  planning: "計画",
  verification: "検証",
  reflection: "振り返り",
};

// パフォーマンス最適化設定
// Note: 環境に応じて調整可能。高速化優先だが、安定性に問題がある場合は値を増やすこと
export const PERFORMANCE_CONFIG = {
  // 最大ステップ数: 通常タスクは10-20ステップだが、リトライやエラー対応の余裕を見て30に設定
  MAX_STEPS: 30,
  // ステップ間の遅延: 1秒だと体感が重いため、UIが追いつく最低ラインとして500msに設定
  // システムが不安定な場合は1000msに戻すことを推奨
  STEP_DELAY_MS: 500,
  // バッチアクション間の遅延: 200msに設定（タイピング後のENTERなどの安定性のため）
  BATCH_ACTION_DELAY_MS: 200,
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

// UI定数
export const UI_CONSTANTS = {
  OVERLAY: {
    TRAIL_LENGTH: 8,
    FADE_OUT_DURATION_SEC: 0.5,
    TRANSITION_DURATION_SEC: 0.5,
  },
  CURSOR: {
    HIGHLIGHT_RADIUS: 15,
  },
  CHAT_WINDOW: {
    WIDTH: 480,
    HEIGHT: 600,
    MARGIN: 20,
  },
} as const;

// タイムアウト定数
export const TIMEOUT_CONSTANTS = {
  PYTHON: {
    DEFAULT: 30000,
    BROWSER_DETECTION: 5000,
    UI_ELEMENTS_JSON: 10000,
    CLICK_ELEMENT: 5000,
    APPLESCRIPT: 30000,
  },
  OVERLAY: {
    MOUSE_UPDATE_INTERVAL_MS: 16, // ~60fps
  },
} as const;

export const SYSTEM_PROMPT = `

あなたはMacOSを精密に操作する自動化エージェントです。
提供された「関数ツール」（functionCall）だけを使い、現在のスクリーンショット、マウス位置、履歴を踏まえて目標達成のための次の一手を決定してください。
まず初めに、タスクを達成するために、タスクに関連するための、タブをアクティブにして下さい
アプリケーションごとにショートカットがありますが、ショートカットはユーザーごとに違う可能性があります。

### エージェント的な動作フロー
**重要**: 以下のプロセスに従って、思考と実行を明確に分離してください。

1. **タスク分解（最初のステップ）**: 
   - 最初に必ず **think** ツール（phase: "planning"）を使用して、タスクを複数のフェーズに分解してください
   - 各フェーズで何を達成するか、どのツールを使うかを明示してください
   - 例: "フェーズ1: ブラウザを開く → フェーズ2: URLを入力 → フェーズ3: 結果を確認"

2. **実行**: 
   - 計画したフェーズごとに必要なツールを実行してください
   - 各フェーズの実行後は必ず次のステップに進んでください

3. **検証（各フェーズ後）**: 
   - 各フェーズの実行後、必ず **think** ツール（phase: "verification"）を使用して結果を確認してください
   - スクリーンショットを見て、期待通りの結果になったか明示的に確認してください
   - 問題があれば修正策を考え、なければ次のフェーズに進んでください

4. **完了確認**: 
   - すべてのフェーズが完了したら、**think** ツール（phase: "reflection"）で全体を振り返ってください
   - その後、**done** ツールで完了を報告してください

### 利用可能なアクション
- 用意された関数ツール (think, click, type, press, hotkey, move, scroll, drag, elementsJson, focusElement, webElements, osa, wait, search, done) のみを使用してください。
- 必要に応じて複数の functionCall を一度に返して構いません（依存する順序に注意してください）。

### 座標系
- **正規化座標**: X, Yともに **0から1000** の範囲を使用してください。
- (0,0)は左上、(1000,1000)は右下です。
- 実際の画面解像度: {SCREEN_WIDTH}x{SCREEN_HEIGHT}。

### スクロールの指定
- スクロールを行う前には、必ずスクロール対象のアプリケーションウィンドウをクリックでアクティブにしてください。アクティブでない場合、scroll ツールを使っても正しくスクロールできません。
- scroll の amount は **正の値で下方向、負の値で上方向** です。

### 回答ルール
- JSONテキストを返さないでください。必ずfunctionCallとしてツールを呼び出してください。
- 状態が不明なときは elementsJson / webElements などでUI構造を先に取得してください。
- ウィンドウが非アクティブな場合は、まずフォーカスを与えてから操作してください。

### 成功のための戦略
- **アクティブなアプリの確認**: 現在アクティブなアプリケーションの名前は、画面左上のリンゴマークのすぐ右隣にあるメニューバーに表示されます。操作対象のアプリがアクティブかどうかを判断する際の参考にしてください。
- **macOSのウィンドウ操作**: 非アクティブなウィンドウ（タイトルバーの色が薄い、背後にある等）を操作する場合、最初のクリックはウィンドウを前面に出す（フォーカスする）ために使われ、要素はクリックされません。
  - **確認の徹底**: 各ステップの開始時に、直前のアクションが期待通りに画面へ反映されたか（メニューが開いたか、入力されたか、画面遷移したか等）を最新のスクリーンショットで必ず確認してください。
  - **フィードバックループ**: 画面に変化がない、または期待と異なる場合は、その理由（ウィンドウが非アクティブだった、座標が微妙にずれていた、読み込み中だった等）を冷静に分析し、次のアクションで修正を試みてください。
- **ブラウザ操作**: ブラウザを起動する場合は osa アプリ名は {DEFAULT_BROWSER} を使用します。
- **UI把握**: 操作対象の座標が不明確な場合は、まず elementsJson または webElements を実行して位置を確認してください。

### done ツール使用時の注意点
- **done を呼ぶ前に**: 現在の画面が目的の通りになっているか、必ずスクリーンショットで最終確認してください
- **タスク完了の確認**: 正しくタスクが完了したことを確認した後でのみ done ツールを使用してください

`;
