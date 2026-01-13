// Window Manager
// 責務: メインウィンドウ、チャットウィンドウ、オーバーレイウィンドウの管理

const { BrowserWindow, screen } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const { CSPManager } = require("./csp-manager");

class WindowManager {
  constructor(cspManager, debugMode = false) {
    this.cspManager = cspManager;
    this.debugMode = debugMode;
    this.windows = {
      main: null,
      chat: null,
      overlay: null,
    };
    this.isQuitting = false;
  }

  setQuitting(isQuitting) {
    this.isQuitting = isQuitting;
  }

  createMainWindow() {
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      backgroundColor: "#0e0f12",
      titleBarStyle: "hiddenInset",
      alwaysOnTop: true,
      contentProtection: true,
      webPreferences: {
        preload: path.join(__dirname, "../preload.js"),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setAlwaysOnTop(true, "screen-saver");

    win.loadFile(path.join(__dirname, "../renderer/pages/dashboard/index.html"));

    // macOSでのスクリーンショット/画面共有対策 (setContentProtection)
    if (process.platform === "darwin") {
      win.setContentProtection(true);
    }

    win.on("close", (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        win.hide();
      }
    });

    // Clean up nonce when window is destroyed
    const webContentsId = win.webContents.id;
    win.on("closed", () => {
      this.cspManager.deleteNonce(webContentsId);
    });

    this.windows.main = win;
    return win;
  }

  createOverlayWindow() {
    if (this.windows.overlay && !this.windows.overlay.isDestroyed()) {
      return this.windows.overlay;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;

    const win = new BrowserWindow({
      width,
      height,
      x: 0,
      y: 0,
      transparent: true,
      frame: false,
      show: false,
      alwaysOnTop: true,
      contentProtection: true,
      hasShadow: false,
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      enableLargerThanScreen: true,
      backgroundColor: "#00000000",
      webPreferences: {
        preload: path.join(__dirname, "../preload.js"),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    win.setIgnoreMouseEvents(true);
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setAlwaysOnTop(true, "screen-saver");

    win.loadFile(path.join(__dirname, "../renderer/pages/overlay/index.html"));

    // マウス位置の同期を開始
    let positionTimer = null;

    try {
      positionTimer = setInterval(() => {
        if (win.isDestroyed()) {
          if (positionTimer) {
            clearInterval(positionTimer);
            positionTimer = null;
          }
          return;
        }
        const point = screen.getCursorScreenPoint();
        win.webContents.send("miki:mouse-pos", point);
      }, 16); // ~60fps

      const webContentsId = win.webContents.id;

      // エラーハンドリング: ウィンドウエラー時にタイマーをクリーンアップ
      win.on("unresponsive", () => {
        if (positionTimer) {
          clearInterval(positionTimer);
          positionTimer = null;
        }
      });

      win.on("closed", () => {
        if (positionTimer) {
          clearInterval(positionTimer);
          positionTimer = null;
        }
        this.cspManager.deleteNonce(webContentsId);
        this.windows.overlay = null;
      });
    } catch (error) {
      // ウィンドウ作成中にエラーが発生した場合のクリーンアップ
      if (positionTimer) {
        clearInterval(positionTimer);
        positionTimer = null;
      }
      throw error;
    }

    this.windows.overlay = win;
    return win;
  }

  createChatWindow() {
    if (this.windows.chat && !this.windows.chat.isDestroyed()) {
      this.windows.chat.show();
      this.windows.chat.focus();
      return this.windows.chat;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const windowWidth = 480;
    const windowHeight = 600;
    const margin = 20;

    const x = Math.floor((screenWidth - windowWidth) / 2);
    const y = screenHeight - windowHeight - margin;

    const win = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: x,
      y: y,
      backgroundColor: "#1a1f2e",
      titleBarStyle: "hiddenInset",
      alwaysOnTop: true,
      contentProtection: true,
      vibrancy: "under-window",
      visualEffectState: "active",
      roundedCorners: true,
      skipTaskbar: true,
      webPreferences: {
        preload: path.join(__dirname, "../preload.js"),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setAlwaysOnTop(true, "screen-saver");

    win.loadFile(path.join(__dirname, "../renderer/pages/chat/index.html"));

    // macOSでのスクリーンショット/画面共有対策 (Chat Widget)
    if (process.platform === "darwin") {
      if (this.debugMode) {
        win.setContentProtection(false);
      } else {
        win.setContentProtection(true);
      }
    }

    win.webContents.on("did-finish-load", () => {
      win.webContents.send("miki:focus-input");
    });

    const webContentsId = win.webContents.id;
    win.on("closed", () => {
      this.cspManager.deleteNonce(webContentsId);
      this.windows.chat = null;
    });

    this.windows.chat = win;
    return win;
  }

  toggleChatWindow() {
    if (this.windows.chat && !this.windows.chat.isDestroyed()) {
      if (this.windows.chat.isVisible()) {
        this.windows.chat.hide();
      } else {
        this.windows.chat.show();
        this.windows.chat.focus();
        this.windows.chat.webContents.send("miki:focus-input");
      }
    } else {
      this.createChatWindow();
    }
  }

  getMainWindow() {
    return this.windows.main;
  }

  getChatWindow() {
    return this.windows.chat;
  }

  getOverlayWindow() {
    return this.windows.overlay;
  }
}

module.exports = { WindowManager };
