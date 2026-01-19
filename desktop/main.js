const { app, BrowserWindow, ipcMain, shell, systemPreferences, globalShortcut, screen, Tray, Menu, nativeImage, safeStorage, session} = require("electron");
const { spawn, execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const crypto = require("node:crypto");

let mainWindow;
let chatWindow;
let overlayWindow;
let tray;
let controllerProcess;
let controllerReader;
let isQuitting = false;
let chatHideTimeout = null; // Track chat hide timeout
const localeDir = path.join(__dirname, "renderer", "locales");
const supportedLocales = ["en", "ja"];
const defaultLocale = "en";
let currentLocale = defaultLocale;
let localeStrings = {};
let fallbackLocaleStrings = {};

// Generate nonces for CSP
let styleNonces = new Map(); // Map to store nonces per webContents ID

function generateNonce() {
  return crypto.randomBytes(16).toString("base64");
}

// Generate and store nonce for a window
function setNonceForWindow(webContents) {
  const nonce = generateNonce();
  styleNonces.set(webContents.id, nonce);
  return nonce;
}

// Get existing nonce for a webContents
function getNonceForWindow(webContentsId) {
  return styleNonces.get(webContentsId) || "";
}

function normalizeLocale(locale) {
  if (locale && supportedLocales.includes(locale)) {
    return locale;
  }
  return defaultLocale;
}

function getLocaleValue(localeData, key) {
  return key.split(".").reduce((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return acc[part];
    }
    return undefined;
  }, localeData);
}

function loadLocaleStrings(locale) {
  const normalized = normalizeLocale(locale);
  const localePath = path.join(localeDir, `${normalized}.json`);
  try {
    return JSON.parse(fs.readFileSync(localePath, "utf-8"));
  } catch (error) {
    console.warn("Failed to load locale strings:", error);
    return {};
  }
}

function tMain(key) {
  const value = getLocaleValue(localeStrings, key) ?? getLocaleValue(fallbackLocaleStrings, key);
  return typeof value === "string" ? value : key;
}

function localeFilePath() {
  return path.join(ensureEnvDir(), ".locale");
}

function readLocale() {
  try {
    const localePath = localeFilePath();
    if (fs.existsSync(localePath)) {
      const value = fs.readFileSync(localePath, "utf-8").trim();
      return normalizeLocale(value);
    }
  } catch (error) {
    console.warn("Failed to read locale:", error);
  }
  return defaultLocale;
}

function writeLocale(locale) {
  const normalized = normalizeLocale(locale);
  fs.writeFileSync(localeFilePath(), normalized, "utf-8");
  return normalized;
}

fallbackLocaleStrings = loadLocaleStrings(defaultLocale);
currentLocale = readLocale();
localeStrings = loadLocaleStrings(currentLocale);

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: tMain("tray.settings"),
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          mainWindow = createWindow();
        }
      }
    },
    { type: "separator" },
    {
      label: tMain("tray.quit"),
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
}

function updateTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu());
}

// Set CSP headers with nonce support
function setupCSPHeaders() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // Skip if no webContents available
    if (!details.webContents) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    
    // Get or create nonce for this webContents (one nonce per window/page load)
    if (details.webContents.isDestroyed()) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    let nonce = styleNonces.get(details.webContents.id);
    if (!nonce) {
      nonce = generateNonce();
      styleNonces.set(details.webContents.id, nonce);
    }
    
    // Define CSP based on the URL (checking for filename only, so path changes don't affect this)
    let csp;
    if (details.url.includes('dashboard') || details.url.includes('index.html')) {
      csp = `default-src 'self'; script-src 'self'; style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self';`;
    } else if (details.url.includes('chat')) {
      csp = `default-src 'self'; script-src 'self'; style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self';`;
    } else if (details.url.includes('overlay')) {
      csp = `default-src 'self'; script-src 'self'; style-src 'self' 'nonce-${nonce}'; font-src 'self' data:; img-src 'self' data:; connect-src 'self';`;
    } else {
      // Default strict CSP - only set for HTML files to avoid setting CSP on every resource
      if (details.url.includes('.html') || details.resourceType === 'mainFrame') {
        csp = `default-src 'self'; script-src 'self'; style-src 'self' 'nonce-${nonce}'; font-src 'self'; img-src 'self' data:;`;
      } else {
        // For non-HTML resources, don't set CSP headers
        callback({ responseHeaders: details.responseHeaders });
        return;
      }
    }

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    });
  });
}


// デバッグモードフラグ (コマンドライン引数 --debug で有効化)
const debugMode = process.argv.includes("--debug");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#0e0f12",
    titleBarStyle: "hiddenInset",
    alwaysOnTop: true,
    contentProtection: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, "screen-saver");

  win.loadFile(path.join(__dirname, "renderer", "pages", "dashboard", "index.html"));

  // macOSでのスクリーンショット/画面共有対策 (setContentProtection)
  // NSWindowのsharingTypeをNSWindowSharingNoneに設定します。
  // 注意: macOS 15以降のScreenCaptureKitを使用するキャプチャ等、一部の環境では
  // OSの制限により完全に防げない場合があります。
  if (process.platform === "darwin") {
    win.setContentProtection(true);
  }

  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  // Clean up nonce when window is destroyed
  const webContentsId = win.webContents.id;
  win.on("closed", () => {
    styleNonces.delete(webContentsId);
  });

  return win;
}

function createTray() {
  const iconPath = path.join(__dirname, "renderer", "icon.png");
  let icon;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    icon.setTemplateImage(true);
    tray = new Tray(icon);
  } else {
    icon = nativeImage.createEmpty();
    tray = new Tray(icon);
    tray.setTitle("miki");
  }

  tray.setToolTip("miki");
  updateTrayMenu();
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
    contentProtection: true,
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

  // Note: overlay is click-through by default; renderer toggles when hovering Stop Agent.
  win.setIgnoreMouseEvents(true);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, "screen-saver");

  win.loadFile(path.join(__dirname, "renderer", "pages", "overlay", "index.html"));
  // マウス位置の同期を開始
  const positionTimer = setInterval(() => {
    if (win.isDestroyed()) {
      clearInterval(positionTimer);
      return;
    }
    const point = screen.getCursorScreenPoint();
    win.webContents.send("miki:mouse-pos", point);
  }, 16); // ~60fps

  const webContentsId = win.webContents.id;
  win.on("closed", () => {
    clearInterval(positionTimer);
    styleNonces.delete(webContentsId);
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
    contentProtection: true,
    vibrancy: "under-window",
    visualEffectState: "active",
    roundedCorners: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, "screen-saver");

  win.loadFile(path.join(__dirname, "renderer", "pages", "chat", "index.html"));

  // macOSでのスクリーンショット/画面共有対策 (Chat Widget)
  if (process.platform === "darwin") {
    if (debugMode) {  
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
    styleNonces.delete(webContentsId);
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
      chatWindow.webContents.send("miki:focus-input");
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
    DOTENV_CONFIG_QUIET: "true"
  };

  // Pass API key directly to controller instead of using .env file
  const apiKey = readApiKey();
  if (apiKey) {
    env.GEMINI_API_KEY = apiKey;
  }

  // デバッグモードの環境変数を設定
  if (debugMode) {
    env.MIKI_DEBUG = "1";
    console.log("[DEBUG MODE ENABLED]");
  }

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
        if (payload.state === "running" || payload.state === "thinking") {
          // Clear any pending chat hide timeout
          if (chatHideTimeout) {
            clearTimeout(chatHideTimeout);
            chatHideTimeout = null;
          }

          if (!overlayWindow || overlayWindow.isDestroyed()) {
            console.log("Creating overlay window...");
            overlayWindow = createOverlayWindow();
            overlayWindow.webContents.on("did-finish-load", () => {
              console.log("Overlay window finished load, sending current status...");
              overlayWindow.webContents.send("miki:backend", payload);
            });
          } else {
            overlayWindow.webContents.send("miki:backend", payload);
            if (!overlayWindow.isVisible()) {
              overlayWindow.showInactive();
            }
          }
          // チャットウィンドウを非表示に
          if (chatWindow && !chatWindow.isDestroyed() && chatWindow.isVisible()) {
            chatWindow.webContents.send("miki:chat-visibility", { visible: false });
            // アニメーション完了後にウィンドウを非表示
            chatHideTimeout = setTimeout(() => {
              if (chatWindow && !chatWindow.isDestroyed()) {
                chatWindow.hide();
              }
              chatHideTimeout = null;
            }, 350); // アニメーション時間 + buffer
          }
        } else if (payload.state === "idle") {
          // Clear any pending chat hide timeout
          if (chatHideTimeout) {
            clearTimeout(chatHideTimeout);
            chatHideTimeout = null;
          }

          if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send("miki:backend", { event: "fadeout" });
            // フェードアウトアニメーション完了後にウィンドウを破棄
            const windowToDestroy = overlayWindow;
            setTimeout(() => {
              if (windowToDestroy && !windowToDestroy.isDestroyed()) {
                console.log("Destroying overlay window after idle...");
                windowToDestroy.destroy();
                if (overlayWindow === windowToDestroy) {
                  overlayWindow = null;
                }
              }
            }, 600); // overlay transition time (0.5s) + buffer
          }
          // チャットウィンドウを再表示
          if (chatWindow && !chatWindow.isDestroyed()) {
            chatWindow.show();
            chatWindow.webContents.send("miki:chat-visibility", { visible: true });
            chatWindow.webContents.send("miki:focus-input");
          }
        }
      } else if (payload.event === "completed") {
        // Clear any pending chat hide timeout
        if (chatHideTimeout) {
          clearTimeout(chatHideTimeout);
          chatHideTimeout = null;
        }

        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send("miki:backend", { event: "fadeout" });
          // フェードアウトアニメーション完了後にウィンドウを破棄
          const windowToDestroy = overlayWindow;
          setTimeout(() => {
            if (windowToDestroy && !windowToDestroy.isDestroyed()) {
              console.log("Destroying overlay window after completion...");
              windowToDestroy.destroy();
              if (overlayWindow === windowToDestroy) {
                overlayWindow = null;
              }
            }
          }, 600); // overlay transition time (0.5s) + buffer
        }
        // チャットウィンドウを再表示
        if (chatWindow && !chatWindow.isDestroyed()) {
          chatWindow.show();
          chatWindow.webContents.send("miki:chat-visibility", { visible: true });
          chatWindow.webContents.send("miki:focus-input");
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

function secureKeyPath() {
  return path.join(ensureEnvDir(), ".api_key.enc");
}

function readApiKey() {
  // Try to read from secure storage first
  const securePath = secureKeyPath();
  if (fs.existsSync(securePath)) {
    try {
      const encryptedData = fs.readFileSync(securePath);
      if (!safeStorage.isEncryptionAvailable()) {
        console.error("Encryption not available but encrypted key exists. Cannot decrypt.");
        return "";
      }
      const decrypted = safeStorage.decryptString(encryptedData);
      return decrypted.trim();
    } catch (err) {
      console.error("Failed to decrypt API key:", err);
      return "";
    }
  }

  // Fallback: migrate from old plain text .env file
  const envPath = envFilePath();
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/^GEMINI_API_KEY=(.*)$/m);
      if (match) {
        const apiKey = match[1].trim();
        // Migrate to secure storage
        if (apiKey && safeStorage.isEncryptionAvailable()) {
          const encrypted = safeStorage.encryptString(apiKey);
          fs.writeFileSync(securePath, encrypted);
          
          // Verify the encrypted file can be read back before deleting plain text
          try {
            const verifyData = fs.readFileSync(securePath);
            const verifyDecrypted = safeStorage.decryptString(verifyData);
            if (verifyDecrypted.trim() === apiKey) {
              // Migration successful, delete old plain text file
              fs.unlinkSync(envPath);
            } else {
              console.error("Migration verification failed: decrypted value doesn't match");
            }
          } catch (verifyErr) {
            console.error("Migration verification failed:", verifyErr);
            // Don't delete the plain text file if verification fails
          }
        }
        return apiKey;
      }
    } catch (err) {
      console.error("Failed to migrate API key:", err);
    }
  }

  return "";
}

function writeApiKey(apiKey) {
  const value = (apiKey || "").trim();
  
  if (!safeStorage.isEncryptionAvailable()) {
    console.error("Encryption not available, cannot store API key securely");
    return;
  }

  const securePath = secureKeyPath();
  const envPath = envFilePath();
  
  if (!value) {
    // Delete the secure file if API key is empty
    if (fs.existsSync(securePath)) {
      fs.unlinkSync(securePath);
    }
    // Also delete old .env file if it exists
    if (fs.existsSync(envPath)) {
      fs.unlinkSync(envPath);
    }
    return;
  }

  // Encrypt and store the API key
  const encrypted = safeStorage.encryptString(value);
  fs.writeFileSync(securePath, encrypted);

  // Remove old plain text .env file if it exists
  if (fs.existsSync(envPath)) {
    fs.unlinkSync(envPath);
  }
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
  setupCSPHeaders();
  
  if (process.platform === "darwin") {
    app.dock.hide();
  }
  createTray();
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
  // メニューバーアプリとして動作させるため、ウィンドウが閉じても終了しない
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

ipcMain.handle("miki:getLocale", () => currentLocale);

ipcMain.handle("miki:setLocale", (_event, locale) => {
  currentLocale = writeLocale(locale);
  localeStrings = loadLocaleStrings(currentLocale);
  updateTrayMenu();
  return currentLocale;
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

ipcMain.handle("miki:getStyleNonce", (event) => {
  const webContentsId = event.sender.id;
  return styleNonces.get(webContentsId) || "";
});

ipcMain.handle("miki:setOverlayMousePassthrough", (_event, ignore) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setIgnoreMouseEvents(Boolean(ignore));
  }
  return true;
});
