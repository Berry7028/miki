const { app, BrowserWindow, ipcMain, shell, systemPreferences, globalShortcut, screen } = require("electron");
const { spawn, execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

let mainWindow;
let chatWindow;
let overlayWindow;
let controllerProcess;
let controllerReader;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#0e0f12",
    titleBarStyle: "hiddenInset",
    alwaysOnTop: true,
    visibleOnAllWorkspaces: true,
    contentProtection: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  return win;
}

function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
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
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    enableLargerThanScreen: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.setIgnoreMouseEvents(true);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, "screen-saver");

  win.loadFile(path.join(__dirname, "renderer", "overlay.html"));

  // マウス位置の同期を開始
  const positionTimer = setInterval(() => {
    if (win.isDestroyed()) {
      clearInterval(positionTimer);
      return;
    }
    const point = screen.getCursorScreenPoint();
    win.webContents.send("miki:mouse-pos", point);
  }, 16); // ~60fps

  win.on("closed", () => {
    clearInterval(positionTimer);
    overlayWindow = null;
  });

  return win;
}

function createChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.show();
    chatWindow.focus();
    return chatWindow;
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
    vibrancy: "under-window",
    visualEffectState: "active",
    roundedCorners: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "renderer", "chat.html"));

  win.on("closed", () => {
    chatWindow = null;
  });

  return win;
}

function toggleChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) {
    if (chatWindow.isVisible()) {
      chatWindow.hide();
    } else {
      chatWindow.show();
      chatWindow.focus();
    }
  } else {
    chatWindow = createChatWindow();
  }
}

function getBackendPaths() {
  const backendRoot = app.isPackaged
    ? path.join(process.resourcesPath, "backend")
    : path.join(__dirname, "backend");
  const controllerEntry = path.join(backendRoot, "controller", "index.js");
  const executorOnedir = path.join(backendRoot, "executor", "miki-executor");
  const executorOnedirBinary = path.join(executorOnedir, "miki-executor");
  const executorBinary = fs.existsSync(executorOnedirBinary)
    ? executorOnedirBinary
    : null;
  const devPython = path.join(__dirname, "..", "venv", "bin", "python");
  const devExecutor = path.join(__dirname, "..", "src", "executor", "main.py");

  return {
    backendRoot,
    controllerEntry,
    executorBinary,
    devPython,
    devExecutor
  };
}

function ensureController() {
  if (controllerProcess) {
    return;
  }

  const { backendRoot, controllerEntry, executorBinary, devPython, devExecutor } =
    getBackendPaths();

  if (!fs.existsSync(controllerEntry)) {
    console.error("Controller entry not found. Run bun run build:backend.");
    return;
  }

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    MIKI_ENV_PATH: path.join(app.getPath("userData"), ".env"),
    DOTENV_CONFIG_QUIET: "true"
  };

  if (app.isPackaged) {
    if (!executorBinary) {
      console.error("Executor binary not found. Run bun run build:backend.");
      return;
    }
    env.MIKI_EXECUTOR_BINARY = executorBinary;
  } else {
    env.MIKI_PYTHON_PATH = devPython;
    env.MIKI_EXECUTOR_PATH = devExecutor;
  }

  controllerProcess = spawn(process.execPath, [controllerEntry], {
    cwd: backendRoot,
    env,
    stdio: ["pipe", "pipe", "pipe"]
  });

  controllerReader = readline.createInterface({
    input: controllerProcess.stdout,
    terminal: false
  });

  controllerReader.on("line", (line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;
    
    // JSONでない可能性が高い行（ログなど）はスキップ
    if (!trimmedLine.startsWith("{") && !trimmedLine.startsWith("[")) {
      console.log(`Controller info: ${trimmedLine}`);
      return;
    }

    try {
      const payload = JSON.parse(trimmedLine);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("miki:backend", payload);
      }
      if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.webContents.send("miki:backend", payload);
      }
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send("miki:backend", payload);
      }

      // オーバーレイの表示・非表示制御
      if (payload.event === "status") {
        console.log("Status event received:", payload.state);
        if (payload.state === "running") {
          if (!overlayWindow || overlayWindow.isDestroyed()) {
            console.log("Creating overlay window...");
            overlayWindow = createOverlayWindow();
            overlayWindow.webContents.on("did-finish-load", () => {
              console.log("Overlay window finished load, sending status...");
              overlayWindow.webContents.send("miki:backend", payload);
            });
          } else {
            overlayWindow.webContents.send("miki:backend", payload);
          }
          overlayWindow.showInactive();
        } else if (payload.state === "idle") {
          if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send("miki:backend", { event: "fadeout" });
          }
        }
      } else if (payload.event === "completed") {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send("miki:backend", { event: "fadeout" });
        }
      }
    } catch (error) {
      console.error("Failed to parse controller output:", line);
    }
  });

  controllerProcess.stderr.on("data", (data) => {
    console.error(`Controller error: ${data}`);
  });

  controllerProcess.on("exit", () => {
    controllerReader?.close();
    controllerReader = undefined;
    controllerProcess = undefined;
  });
}

function sendToController(payload) {
  if (!controllerProcess || !controllerProcess.stdin.writable) {
    ensureController();
  }
  if (!controllerProcess || !controllerProcess.stdin.writable) {
    return;
  }
  controllerProcess.stdin.write(`${JSON.stringify(payload)}\n`);
}

function ensureEnvDir() {
  const dir = app.getPath("userData");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function envFilePath() {
  return path.join(ensureEnvDir(), ".env");
}

function readApiKey() {
  const envPath = envFilePath();
  if (!fs.existsSync(envPath)) return "";
  const content = fs.readFileSync(envPath, "utf-8");
  const match = content.match(/^GEMINI_API_KEY=(.*)$/m);
  return match ? match[1].trim() : "";
}

function writeApiKey(apiKey) {
  const envPath = envFilePath();
  const value = (apiKey || "").trim();
  fs.writeFileSync(envPath, `GEMINI_API_KEY=${value}\n`, "utf-8");
}

function setupFlagPath() {
  return path.join(ensureEnvDir(), ".setup_completed");
}

function isSetupCompleted() {
  return fs.existsSync(setupFlagPath());
}

function markSetupCompleted() {
  fs.writeFileSync(setupFlagPath(), String(Date.now()), "utf-8");
}

function checkAccessibilityPermission() {
  if (process.platform !== "darwin") {
    return true;
  }
  try {
    const trusted = systemPreferences.isTrustedAccessibilityClient(false);
    return trusted;
  } catch (error) {
    console.error("Failed to check accessibility permission:", error);
    return false;
  }
}

function checkScreenRecordingPermission() {
  if (process.platform !== "darwin") {
    return true;
  }
  try {
    const status = systemPreferences.getMediaAccessStatus("screen");
    return status === "granted";
  } catch (error) {
    console.error("Failed to check screen recording permission:", error);
    return false;
  }
}

function openSystemPreferences(pane) {
  if (process.platform !== "darwin") {
    return;
  }
  if (pane === "accessibility") {
    shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility");
  } else if (pane === "screen-recording") {
    shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
  }
}

function getSetupStatus() {
  const apiKey = readApiKey();
  const hasApiKey = !!apiKey;
  const hasAccessibility = checkAccessibilityPermission();
  const hasScreenRecording = checkScreenRecordingPermission();
  const setupCompleted = isSetupCompleted();

  return {
    setupCompleted,
    hasApiKey,
    hasAccessibility,
    hasScreenRecording,
    needsSetup: !setupCompleted || !hasApiKey || !hasAccessibility || !hasScreenRecording
  };
}

app.whenReady().then(() => {
  mainWindow = createWindow();
  ensureController();

  // グローバルショートカット登録
  // Note: macOSで左右のCommandキーを区別するのは困難なため、
  // Command+Shift+Spaceを使用（カスタマイズ可能）
  const shortcutRegistered = globalShortcut.register("CommandOrControl+Shift+Space", () => {
    toggleChatWindow();
  });

  if (!shortcutRegistered) {
    console.error("グローバルショートカットの登録に失敗しました");
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  controllerProcess?.kill();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

ipcMain.handle("miki:start", (_event, goal) => {
  sendToController({ type: "start", goal });
});

ipcMain.handle("miki:hint", (_event, text) => {
  sendToController({ type: "hint", text });
});

ipcMain.handle("miki:stop", () => {
  sendToController({ type: "stop" });
});

ipcMain.handle("miki:reset", () => {
  sendToController({ type: "reset" });
});

ipcMain.handle("miki:getApiKey", () => readApiKey());

ipcMain.handle("miki:setApiKey", (_event, apiKey) => {
  writeApiKey(apiKey);
  return true;
});

ipcMain.handle("miki:getSetupStatus", () => getSetupStatus());

ipcMain.handle("miki:markSetupCompleted", () => {
  markSetupCompleted();
  return true;
});

ipcMain.handle("miki:openSystemPreferences", (_event, pane) => {
  openSystemPreferences(pane);
  return true;
});
