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

