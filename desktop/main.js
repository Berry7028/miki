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
let restartControllerOnExit = false;
let isQuitting = false;
let chatHideTimeout = null; // Track chat hide timeout

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

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Settings",
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
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
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
  const executorBinaryName = process.platform === "win32" ? "miki-executor.exe" : "miki-executor";
  const executorOnedirBinary = path.join(executorOnedir, executorBinaryName);
  const executorBinary = fs.existsSync(executorOnedirBinary)
    ? executorOnedirBinary
    : null;
  const devPython = process.platform === "win32"
    ? path.join(__dirname, "..", "venv", "Scripts", "python.exe")
    : path.join(__dirname, "..", "venv", "bin", "python");
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

  const customLlm = readCustomLlmSettings();
  if (customLlm.enabled) {
    env.MIKI_CUSTOM_LLM_ENABLED = "1";
    if (customLlm.provider) {
      env.MIKI_CUSTOM_LLM_PROVIDER = customLlm.provider;
    }
    if (customLlm.apiKey) {
      env.MIKI_CUSTOM_LLM_API_KEY = customLlm.apiKey;
    }
    if (customLlm.baseUrl) {
      env.MIKI_CUSTOM_LLM_BASE_URL = customLlm.baseUrl;
    }
    if (customLlm.model) {
      env.MIKI_CUSTOM_LLM_MODEL = customLlm.model;
    }
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
    if (restartControllerOnExit) {
      restartControllerOnExit = false;
      ensureController();
    }
  });
}

function restartController() {
  if (controllerProcess) {
    restartControllerOnExit = true;
    try {
      sendToController({ type: "stop" });
    } catch (err) {
      console.error("Failed to send stop to controller:", err);
    }
    controllerProcess.kill();
    return;
  }
  ensureController();
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

function secureKeyPath(name) {
  return path.join(ensureEnvDir(), name);
}

function readSecureValue(name, legacyEnvKey) {
  const securePath = secureKeyPath(name);
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

  if (!legacyEnvKey) {
    return "";
  }

  const envPath = envFilePath();
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(new RegExp(`^${legacyEnvKey}=(.*)$`, "m"));
      if (match) {
        const apiKey = match[1].trim();
        if (apiKey && safeStorage.isEncryptionAvailable()) {
          const encrypted = safeStorage.encryptString(apiKey);
          fs.writeFileSync(securePath, encrypted);
          try {
            const verifyData = fs.readFileSync(securePath);
            const verifyDecrypted = safeStorage.decryptString(verifyData);
            if (verifyDecrypted.trim() === apiKey) {
              fs.unlinkSync(envPath);
            } else {
              console.error("Migration verification failed: decrypted value doesn't match");
            }
          } catch (verifyErr) {
            console.error("Migration verification failed:", verifyErr);
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

function writeSecureValue(name, value) {
  const trimmedValue = (value || "").trim();

  if (!safeStorage.isEncryptionAvailable()) {
    console.error("Encryption not available, cannot store API key securely");
    return;
  }

  const securePath = secureKeyPath(name);
  const envPath = envFilePath();

  if (!trimmedValue) {
    if (fs.existsSync(securePath)) {
      fs.unlinkSync(securePath);
    }
    if (fs.existsSync(envPath)) {
      fs.unlinkSync(envPath);
    }
    return;
  }

  const encrypted = safeStorage.encryptString(trimmedValue);
  fs.writeFileSync(securePath, encrypted);

  if (fs.existsSync(envPath)) {
    fs.unlinkSync(envPath);
  }
}

function readApiKey() {
  return readSecureValue(".api_key.enc", "GEMINI_API_KEY");
}

function writeApiKey(apiKey) {
  writeSecureValue(".api_key.enc", apiKey);
}

const CUSTOM_LLM_PROVIDERS = new Set(["openai", "openrouter", "anthropic"]);

function normalizeCustomLlmProvider(provider) {
  if (!provider || typeof provider !== "string") {
    return "";
  }
  return CUSTOM_LLM_PROVIDERS.has(provider) ? provider : "";
}

function customLlmProviderKey(provider, key) {
  return `.custom_llm_${key}_${provider}.enc`;
}

function migrateLegacyCustomLlmSettings(provider) {
  const normalizedProvider = normalizeCustomLlmProvider(provider);
  if (!normalizedProvider) {
    return;
  }

  const legacyApiKey = readSecureValue(".custom_llm_api_key.enc");
  const legacyBaseUrl = readSecureValue(".custom_llm_base_url.enc");
  const legacyModel = readSecureValue(".custom_llm_model.enc");

  if (!legacyApiKey && !legacyBaseUrl && !legacyModel) {
    return;
  }

  const providerApiKey = readSecureValue(customLlmProviderKey(normalizedProvider, "api_key"));
  const providerBaseUrl = readSecureValue(customLlmProviderKey(normalizedProvider, "base_url"));
  const providerModel = readSecureValue(customLlmProviderKey(normalizedProvider, "model"));

  if (legacyApiKey && !providerApiKey) {
    writeSecureValue(customLlmProviderKey(normalizedProvider, "api_key"), legacyApiKey);
  }
  if (legacyBaseUrl && !providerBaseUrl) {
    writeSecureValue(customLlmProviderKey(normalizedProvider, "base_url"), legacyBaseUrl);
  }
  if (legacyModel && !providerModel) {
    writeSecureValue(customLlmProviderKey(normalizedProvider, "model"), legacyModel);
  }

  writeSecureValue(".custom_llm_api_key.enc", "");
  writeSecureValue(".custom_llm_base_url.enc", "");
  writeSecureValue(".custom_llm_model.enc", "");
}

function readCustomLlmProviderSettings(provider) {
  const normalizedProvider = normalizeCustomLlmProvider(provider);
  if (!normalizedProvider) {
    return {
      apiKey: "",
      baseUrl: "",
      model: ""
    };
  }

  migrateLegacyCustomLlmSettings(normalizedProvider);

  return {
    apiKey: readSecureValue(customLlmProviderKey(normalizedProvider, "api_key")),
    baseUrl: readSecureValue(customLlmProviderKey(normalizedProvider, "base_url")),
    model: readSecureValue(customLlmProviderKey(normalizedProvider, "model"))
  };
}

function writeCustomLlmProviderSettings(provider, settings) {
  const normalizedProvider = normalizeCustomLlmProvider(provider);
  if (!normalizedProvider) {
    return;
  }

  writeSecureValue(customLlmProviderKey(normalizedProvider, "api_key"), settings.apiKey || "");
  writeSecureValue(customLlmProviderKey(normalizedProvider, "base_url"), settings.baseUrl || "");
  writeSecureValue(customLlmProviderKey(normalizedProvider, "model"), settings.model || "");
}

function readCustomLlmSettings() {
  const enabled = readSecureValue(".custom_llm_enabled.enc");
  const provider = normalizeCustomLlmProvider(readSecureValue(".custom_llm_provider.enc"));
  const providerSettings = provider ? readCustomLlmProviderSettings(provider) : {
    apiKey: "",
    baseUrl: "",
    model: ""
  };

  return {
    enabled: enabled === "1",
    provider,
    apiKey: providerSettings.apiKey,
    baseUrl: providerSettings.baseUrl,
    model: providerSettings.model,
  };
}

function writeCustomLlmSettings(settings) {
  const enabled = Boolean(settings.enabled);
  const provider = normalizeCustomLlmProvider(settings.provider);
  writeSecureValue(".custom_llm_enabled.enc", enabled ? "1" : "");
  writeSecureValue(".custom_llm_provider.enc", provider || "");
  if (!provider) {
    return;
  }

  writeCustomLlmProviderSettings(provider, settings || {});
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
  const customLlm = readCustomLlmSettings();
  const baseUrlRequired = Boolean(customLlm.provider && customLlm.provider === "openrouter");
  const customConfigured = customLlm.enabled
    ? Boolean(customLlm.apiKey && customLlm.provider && customLlm.model && (!baseUrlRequired || customLlm.baseUrl))
    : true;
  const hasApiKey = !!apiKey;
  const hasAccessibility = checkAccessibilityPermission();
  const hasScreenRecording = checkScreenRecordingPermission();
  const setupCompleted = isSetupCompleted();

  return {
    setupCompleted,
    hasApiKey,
    hasCustomLlmConfig: customConfigured,
    hasAccessibility,
    hasScreenRecording,
    needsSetup: !setupCompleted || !hasApiKey || !customConfigured || !hasAccessibility || !hasScreenRecording
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
  restartController();
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

ipcMain.handle("miki:getCustomLlmSettings", () => readCustomLlmSettings());

ipcMain.handle("miki:getCustomLlmProviderSettings", (_event, provider) => {
  return readCustomLlmProviderSettings(provider);
});

ipcMain.handle("miki:setCustomLlmSettings", (_event, settings) => {
  writeCustomLlmSettings(settings || {});
  restartController();
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
