// Controller Manager
// 責務: バックエンドコントローラプロセスのライフサイクル管理

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { app } = require("electron");
const { EventEmitter } = require("events");

class ControllerManager extends EventEmitter {
  constructor(securityManager, windowManager) {
    super();
    this.securityManager = securityManager;
    this.windowManager = windowManager;
    this.process = null;
    this.reader = null;
  }

  getBackendPaths() {
    const backendRoot = app.isPackaged
      ? path.join(process.resourcesPath, "backend")
      : path.join(__dirname, "../../backend");
    const controllerEntry = path.join(backendRoot, "controller", "index.js");
    const executorOnedir = path.join(backendRoot, "executor", "miki-executor");
    const executorOnedirBinary = path.join(executorOnedir, "miki-executor");
    const executorBinary = fs.existsSync(executorOnedirBinary)
      ? executorOnedirBinary
      : null;
    const devPython = path.join(__dirname, "../../../venv/bin/python");
    const devExecutor = path.join(__dirname, "../../../src/executor/main.py");

    return {
      backendRoot,
      controllerEntry,
      executorBinary,
      devPython,
      devExecutor
    };
  }

  ensureController() {
    if (this.process) {
      return;
    }

    const { backendRoot, controllerEntry, executorBinary, devPython, devExecutor } =
      this.getBackendPaths();

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
    const apiKey = this.securityManager.readApiKey();
    if (apiKey) {
      env.GEMINI_API_KEY = apiKey;
    }

    // デバッグモードの環境変数を設定
    const debugMode = process.argv.includes("--debug");
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

    this.process = spawn(process.execPath, [controllerEntry], {
      cwd: backendRoot,
      env,
      stdio: ["pipe", "pipe", "pipe"]
    });

    this.reader = readline.createInterface({
      input: this.process.stdout,
      terminal: false
    });

    this.reader.on("line", (line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // JSONでない可能性が高い行（ログなど）はスキップ
      if (!trimmedLine.startsWith("{") && !trimmedLine.startsWith("[")) {
        console.log(`Controller info: ${trimmedLine}`);
        return;
      }

      try {
        const payload = JSON.parse(trimmedLine);

        // Send to all windows
        const mainWindow = this.windowManager.getMainWindow();
        const chatWindow = this.windowManager.getChatWindow();
        const overlayWindow = this.windowManager.getOverlayWindow();

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("miki:backend", payload);
        }
        if (chatWindow && !chatWindow.isDestroyed()) {
          chatWindow.webContents.send("miki:backend", payload);
        }
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send("miki:backend", payload);
        }

        // Handle overlay window visibility based on status
        this._handleOverlayStatus(payload);

        // Emit event for other potential listeners
        this.emit("payload", payload);
      } catch (error) {
        console.error("Failed to parse controller output:", line);
      }
    });

    this.process.stderr.on("data", (data) => {
      console.error(`Controller error: ${data}`);
    });

    this.process.on("exit", () => {
      this.reader?.close();
      this.reader = undefined;
      this.process = undefined;
    });
  }

  _handleOverlayStatus(payload) {
    const overlayWindow = this.windowManager.getOverlayWindow();

    // オーバーレイの表示・非表示制御
    if (payload.event === "status") {
      console.log("Status event received:", payload.state);
      if (payload.state === "running" || payload.state === "thinking") {
        if (!overlayWindow || overlayWindow.isDestroyed()) {
          console.log("Creating overlay window...");
          const newOverlayWindow = this.windowManager.createOverlayWindow();
          newOverlayWindow.webContents.on("did-finish-load", () => {
            console.log("Overlay window finished load, sending current status...");
            newOverlayWindow.webContents.send("miki:backend", payload);
          });
        } else {
          overlayWindow.webContents.send("miki:backend", payload);
          if (!overlayWindow.isVisible()) {
            overlayWindow.showInactive();
          }
        }
      } else if (payload.state === "idle") {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send("miki:backend", { event: "fadeout" });
          // フェードアウトアニメーション完了後にウィンドウを破棄
          const windowToDestroy = overlayWindow;
          setTimeout(() => {
            if (windowToDestroy && !windowToDestroy.isDestroyed()) {
              console.log("Destroying overlay window after idle...");
              windowToDestroy.destroy();
            }
          }, 600); // overlay transition time (0.5s) + buffer
        }
      }
    } else if (payload.event === "completed") {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send("miki:backend", { event: "fadeout" });
        // フェードアウトアニメーション完了後にウィンドウを破棄
        const windowToDestroy = overlayWindow;
        setTimeout(() => {
          if (windowToDestroy && !windowToDestroy.isDestroyed()) {
            console.log("Destroying overlay window after completion...");
            windowToDestroy.destroy();
          }
        }, 600); // overlay transition time (0.5s) + buffer
      }
    }
  }

  sendToController(payload) {
    if (!this.process || !this.process.stdin.writable) {
      this.ensureController();
    }
    if (!this.process || !this.process.stdin.writable) {
      return;
    }
    this.process.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  destroy() {
    this.process?.kill();
  }
}

module.exports = { ControllerManager };
