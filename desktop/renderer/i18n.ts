export type Language = "en" | "ja";

export const translations = {
  en: {
    appTitle: "MIKI DESKTOP",
    systemReady: "SYSTEM READY",
    dashboard: "Dashboard",
    quickTrigger: "Quick Trigger",
    quickTriggerDesc: "Launch the chat overlay instantly from anywhere.",
    apiConfig: "API Configuration",
    connected: "Connected",
    notConnected: "Not Connected",
    openaiApiKey: "OPENAI API KEY",
    changeKey: "Change Key",
    verifyAndSave: "Verify & Save",
    saved: "Saved",
    systemPermissions: "System Permissions",
    reviewPermissions: "Review system access",
    accessibility: "Accessibility",
    screenRecording: "Screen Recording",
    granted: "Granted",
    actionRequired: "Action Required",
    allow: "Allow",
    executionLog: "Execution Log",
    noLogs: "No logs yet",
    setupWizard: "SETUP WIZARD",
    step: "Step",
    of: "of",
    configureMiki: "Configure MIKI AI",
    enterApiKey: "Enter your OpenAI or Anthropic API key.",
    enableAccessibility: "Enable Accessibility",
    allowControl: "Allow MIKI to control your screen for automation.",
    seeWorkflow: "Let MIKI see your workflow",
    screenRecordingReq: "Screen recording permission is required for context-aware help.",
    findApiKey: "Where do I find my API key?",
    apiKeyPrivacy: "Your key is encrypted and stored locally. It is never shared with our servers.",
    accessibilityGranted: "Accessibility Granted",
    openSystemPreferences: "Open System Preferences",
    screenRecordingGranted: "Screen Recording Granted",
    dataPrivacy: "This data is processed locally and never leaves your device.",
    back: "Back",
    nextStep: "Next Step",
    finishSetup: "Finish Setup",
    clearChat: "Clear Chat",
    thinking: "Thinking",
    askMiki: "Ask Miki to automate a task...",
    inputHint: "Enter to send, Shift+Enter for new line",
    done: "Done",
    errorOccurred: "An error occurred.",
    settings: "Settings",
    language: "Language",
    selectLanguage: "Select Language",
  },
  ja: {
    appTitle: "MIKI DESKTOP",
    systemReady: "システム待機中",
    dashboard: "ダッシュボード",
    quickTrigger: "クイック起動",
    quickTriggerDesc: "どこからでも即座にチャットオーバーレイを起動できます。",
    apiConfig: "API設定",
    connected: "接続済み",
    notConnected: "未接続",
    openaiApiKey: "OPENAI API キー",
    changeKey: "キーを変更",
    verifyAndSave: "保存して検証",
    saved: "保存完了",
    systemPermissions: "システム権限",
    reviewPermissions: "システムへのアクセス権限を確認します",
    accessibility: "アクセシビリティ",
    screenRecording: "画面収録",
    granted: "許可済み",
    actionRequired: "設定が必要",
    allow: "許可する",
    executionLog: "実行ログ",
    noLogs: "ログはありません",
    setupWizard: "セットアップウィザード",
    step: "ステップ",
    of: "/",
    configureMiki: "MIKI AIの設定",
    enterApiKey: "OpenAIまたはAnthropicのAPIキーを入力してください。",
    enableAccessibility: "アクセシビリティの有効化",
    allowControl: "オートメーションのためにMIKIによる操作を許可してください。",
    seeWorkflow: "ワークフローの可視化",
    screenRecordingReq: "コンテキストに応じた支援のために画面収録の権限が必要です。",
    findApiKey: "APIキーはどこで確認できますか？",
    apiKeyPrivacy: "キーは暗号化されローカルに保存されます。サーバーに送信されることはありません。",
    accessibilityGranted: "アクセシビリティ許可済み",
    openSystemPreferences: "システム設定を開く",
    screenRecordingGranted: "画面収録許可済み",
    dataPrivacy: "データはローカルで処理され、デバイスの外に出ることはありません。",
    back: "戻る",
    nextStep: "次へ",
    finishSetup: "セットアップを完了",
    clearChat: "チャットをクリア",
    thinking: "思考中",
    askMiki: "Mikiにタスクを依頼する...",
    inputHint: "Enterで送信、Shift+Enterで改行",
    done: "完了",
    errorOccurred: "エラーが発生しました。",
    settings: "設定",
    language: "言語",
    selectLanguage: "言語を選択",
  },
};

export const getLanguage = (): Language => {
  const lang = localStorage.getItem("miki_language");
  return (lang as Language) || "ja";
};

export const setLanguage = (lang: Language) => {
  localStorage.setItem("miki_language", lang);
  window.dispatchEvent(new Event("miki_language_changed"));
};

export const useI18n = () => {
  const [lang, setLangState] = React.useState<Language>(getLanguage());

  React.useEffect(() => {
    const handleLangChange = () => {
      setLangState(getLanguage());
    };
    window.addEventListener("miki_language_changed", handleLangChange);
    window.addEventListener("storage", (e) => {
      if (e.key === "miki_language") handleLangChange();
    });
    return () => {
      window.removeEventListener("miki_language_changed", handleLangChange);
      window.removeEventListener("storage", (e) => {
        if (e.key === "miki_language") handleLangChange();
      });
    };
  }, []);

  const t = (key: keyof typeof translations.en) => {
    return translations[lang][key] || translations.en[key];
  };

  return { t, lang, setLanguage };
};
