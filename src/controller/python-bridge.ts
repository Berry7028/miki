import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as fs from "node:fs";
import * as readline from "node:readline";
import * as path from "node:path";
import type { PythonResponse } from "./types";

export class PythonBridge {
  private pythonProcess!: ChildProcessWithoutNullStreams;
  private pythonReader!: readline.Interface;
  private pendingResolvers: ((value: any) => void)[] = [];
  private isRestarting = false;
  private onError: (message: string) => void;
  private onReady: () => void;

  constructor(
    onError: (message: string) => void,
    onReady: () => void = () => {},
  ) {
    this.onError = onError;
    this.onReady = onReady;
    this.startPythonProcess();
  }

  private startPythonProcess() {
    const executorBinary = process.env.MIKI_EXECUTOR_BINARY;
    const pythonPath =
      process.env.MIKI_PYTHON_PATH || path.join(process.cwd(), "venv", "bin", "python");
    const executorPath =
      process.env.MIKI_EXECUTOR_PATH || path.join(process.cwd(), "src/executor/main.py");

    if (executorBinary && fs.existsSync(executorBinary)) {
      this.pythonProcess = spawn(executorBinary, []);
    } else {
      this.pythonProcess = spawn(pythonPath, [executorPath]);
    }

    this.pythonReader = readline.createInterface({
      input: this.pythonProcess.stdout,
      terminal: false,
    });

    this.pythonReader.on("line", (line) => {
      const resolver = this.pendingResolvers.shift();
      if (resolver) {
        try {
          resolver(JSON.parse(line));
        } catch (e) {
          this.onError(`Python出力のパース失敗: ${line}`);
        }
      }
    });

    this.pythonProcess.stderr.on("data", (data) => {
      this.onError(`Pythonエラー: ${data}`);
    });

    // プロセスクラッシュの検知と自動再起動
    this.pythonProcess.on("exit", (code, signal) => {
      if (!this.isRestarting) {
        console.error(`Pythonプロセスが終了しました (code: ${code}, signal: ${signal})`);
        this.handleProcessCrash();
      }
    });

    this.pythonProcess.on("error", (error) => {
      console.error(`Pythonプロセスエラー: ${error.message}`);
      if (!this.isRestarting) {
        this.handleProcessCrash();
      }
    });
  }

  private async handleProcessCrash() {
    if (this.isRestarting) return;

    this.isRestarting = true;
    console.error("Pythonプロセスを再起動しています...");

    // 古いプロセスのクリーンアップ
    try {
      this.pythonReader.close();
      this.pythonProcess.kill();
    } catch (e) {
      // 既に終了している場合は無視
    }

    // 待機後に再起動
    await new Promise((resolve) => setTimeout(resolve, 1000));
    this.startPythonProcess();
    this.isRestarting = false;

    console.error("Pythonプロセスを再起動しました");

    // 再初期化のコールバック
    this.onReady();
  }

  async call(action: string, params: any = {}): Promise<PythonResponse> {
    return new Promise((resolve, reject) => {
      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        const index = this.pendingResolvers.indexOf(resolve);
        if (index > -1) {
          this.pendingResolvers.splice(index, 1);
        }
        reject(new Error(`Python call timeout for action: ${action}`));
      }, 30000); // 30 second timeout

      const wrappedResolve = (value: any) => {
        clearTimeout(timeout);
        resolve(value);
      };

      this.pendingResolvers.push(wrappedResolve);
      
      try {
        this.pythonProcess.stdin.write(JSON.stringify({ action, params }) + "\n");
      } catch (e) {
        clearTimeout(timeout);
        const index = this.pendingResolvers.indexOf(wrappedResolve);
        if (index > -1) {
          this.pendingResolvers.splice(index, 1);
        }
        reject(new Error(`Failed to write to Python process: ${e}`));
      }
    });
  }

  async setCursorVisibility(visible: boolean): Promise<void> {
    try {
      await this.call("setCursorVisibility", { visible });
    } catch (e) {
      console.error(`Failed to set cursor visibility: ${e}`);
    }
  }

  destroy() {
    this.isRestarting = true; // Prevent restart on exit
    
    // Reject all pending resolvers
    const error = new Error("PythonBridge is being destroyed");
    while (this.pendingResolvers.length > 0) {
      const resolver = this.pendingResolvers.shift();
      if (resolver) {
        // We can't reject since these are resolve-only, but we can clear them
        // In the improved call() method, we handle this better
      }
    }
    
    try {
      this.pythonReader.close();
    } catch (e) {
      // Ignore errors during cleanup
    }
    
    try {
      this.pythonProcess.kill("SIGTERM");
      
      // Force kill after 2 seconds if still running
      setTimeout(() => {
        try {
          this.pythonProcess.kill("SIGKILL");
        } catch (e) {
          // Process already terminated
        }
      }, 2000);
    } catch (e) {
      // Process already terminated
    }
  }
}
