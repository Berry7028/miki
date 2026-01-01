export interface SetupStatus {
  setupCompleted: boolean;
  hasApiKey: boolean;
  hasAccessibility: boolean;
  hasScreenRecording: boolean;
  needsSetup: boolean;
}

export interface BackendEvent {
  event: "status" | "step" | "log" | "completed" | "error";
  state?: "idle" | "running" | "stopping";
  goal?: string;
  step?: number;
  type?: "info" | "success" | "error" | "hint" | "action";
  message?: string;
  timestamp?: number;
  result?: string;
}

export interface MikiAPI {
  appName: string;
  start: (goal: string) => Promise<void>;
  hint: (text: string) => Promise<void>;
  stop: () => Promise<void>;
  reset: () => Promise<void>;
  getApiKey: () => Promise<string>;
  setApiKey: (apiKey: string) => Promise<boolean>;
  getSetupStatus: () => Promise<SetupStatus>;
  markSetupCompleted: () => Promise<boolean>;
  openSystemPreferences: (pane: "accessibility" | "screen-recording") => Promise<boolean>;
  onBackendEvent: (callback: (payload: BackendEvent) => void) => () => void;
}

declare global {
  interface Window {
    miki: MikiAPI;
  }
}
