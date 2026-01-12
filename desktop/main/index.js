// Main Entry Point
// Electronアプリのエントリーポイント

const { app, globalShortcut } = require("electron");

const { CSPManager } = require("./csp-manager");
const { WindowManager } = require("./window-manager");
const { ControllerManager } = require("./controller-manager");
const { SecurityManager } = require("./security-manager");
const { TrayManager } = require("./tray-manager");
const { setupIPCHandlers } = require("./ipc-handlers");

// デバッグモードフラグ (コマンドライン引数 --debug で有効化)
const debugMode = process.argv.includes("--debug");

// マネージャーの初期化
const cspManager = new CSPManager();
const securityManager = new SecurityManager();
const windowManager = new WindowManager(cspManager, debugMode);
const controllerManager = new ControllerManager(securityManager, windowManager);

// トレイマネージャーはonQuitコールバックが必要
const trayManager = new TrayManager(windowManager, () => {
  windowManager.setQuitting(true);
  app.quit();
});

// IPCハンドラーの設定
setupIPCHandlers(controllerManager, securityManager, cspManager);

// アプリケーションのライフサイクル
app.whenReady().then(() => {
  cspManager.setupHeaders();

  if (process.platform === "darwin") {
    app.dock.hide();
  }

  trayManager.createTray();
  windowManager.createMainWindow();
  controllerManager.ensureController();

  // グローバルショートカット登録
  // Note: macOSで左右のCommandキーを区別するのは困難なため、
  // Command+Shift+Spaceを使用（カスタマイズ可能）
  const shortcutRegistered = globalShortcut.register("CommandOrControl+Shift+Space", () => {
    windowManager.toggleChatWindow();
  });

  if (!shortcutRegistered) {
    console.error("グローバルショートカットの登録に失敗しました");
  }

  app.on("activate", () => {
    if (windowManager.getMainWindow() === null) {
      windowManager.createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // メニューバーアプリとして動作させるため、ウィンドウが閉じても終了しない
});

app.on("before-quit", () => {
  controllerManager.destroy();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
