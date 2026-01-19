export interface SetupStatus {
  setupCompleted: boolean;
  hasApiKey: boolean;
  hasAccessibility: boolean;
  hasScreenRecording: boolean;
  needsSetup: boolean;
}

export interface BackendEvent {
  event: "status" | "step" | "log" | "completed" | "error" | "thinking" | "tool" | "token_usage";
  state?: "idle" | "running" | "stopping";
  goal?: string;
  step?: number;
  type?: "info" | "success" | "error" | "hint" | "action" | "thinking" | "tool";
  message?: string;
  timestamp?: number;
  result?: string;
  toolName?: string;
  toolInput?: any;
  toolOutput?: any;
  thought?: string;
  phase?: "planning" | "verification" | "reflection";
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
}

export interface MikiAPI {
  appName: string;
  getStyleNonce: () => Promise<string>;
  setOverlayMousePassthrough: (ignore: boolean) => Promise<boolean>;
  start: (goal: string) => Promise<void>;
  hint: (text: string) => Promise<void>;
  stop: () => Promise<void>;
  reset: () => Promise<void>;
  getApiKey: () => Promise<string>;
  setApiKey: (apiKey: string) => Promise<boolean>;
  getLocale: () => Promise<string>;
  setLocale: (locale: string) => Promise<string>;
  getSetupStatus: () => Promise<SetupStatus>;
  markSetupCompleted: () => Promise<boolean>;
  openSystemPreferences: (pane: "accessibility" | "screen-recording") => Promise<boolean>;
  onBackendEvent: (callback: (payload: BackendEvent) => void) => () => void;
  onMousePos: (callback: (pos: { x: number; y: number }) => void) => () => void;
  onFocusInput: (callback: () => void) => () => void;
  onChatVisibility: (callback: (payload: { visible: boolean }) => void) => () => void;
}

declare global {
  interface Window {
    miki: MikiAPI;
  }
}
