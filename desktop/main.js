const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

let mainWindow;
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

function getBackendPaths() {
  const backendRoot = app.isPackaged
    ? path.join(process.resourcesPath, "backend")
    : path.join(__dirname, "backend");
  const controllerEntry = path.join(backendRoot, "controller", "index.js");
  const executorOnedir = path.join(backendRoot, "executor", "miki-executor");
  const executorOnedirBinary = path.join(executorOnedir, "miki-executor");
  const executorBinary = fs.existsSync(executorOnedirBinary)
    ? executorOnedirBinary
    : executorOnedir;
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
    console.error("Controller entry not found. Run npm run build:backend.");
    return;
  }

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    MIKI_ENV_PATH: path.join(app.getPath("userData"), ".env"),
    DOTENV_CONFIG_QUIET: "true"
  };

  if (app.isPackaged && fs.existsSync(executorBinary)) {
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
    if (!line.trim()) return;
    try {
      const payload = JSON.parse(line);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("miki:backend", payload);
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

app.whenReady().then(() => {
  mainWindow = createWindow();
  ensureController();

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
