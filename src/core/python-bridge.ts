import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as fs from "node:fs";
import * as readline from "node:readline";
import * as path from "node:path";
import type { PythonResponse } from "./types";

export class PythonBridge {
  private pythonProcess!: ChildProcessWithoutNullStreams;
  private pythonReader!: readline.Interface;
  private pendingResolvers: Array<{
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = [];
  private isRestarting = false;
  private onError: (message: string) => void;
  private onReady: () => void;
  private defaultTimeout = 30000;
  private maxRetries = 3;
  private debugMode: boolean;

  constructor(
    onError: (message: string) => void,
    onReady: () => void = () => {},
    debugMode: boolean = false
  ) {
    this.onError = onError;
    this.onReady = onReady;
    this.debugMode = debugMode;
    this.startPythonProcess();
  }

  private startPythonProcess() {
    const executorBinary = process.env.MIKI_EXECUTOR_BINARY;
    const pythonPath =
      process.env.MIKI_PYTHON_PATH || path.join(process.cwd(), "venv", "bin", "python");
    const executorPath =
      process.env.MIKI_EXECUTOR_PATH || path.join(process.cwd(), "src/executor/main.py");

    if (this.debugMode) {
      console.error("[PythonBridge] Starting Python process...");
      if (executorBinary && fs.existsSync(executorBinary)) {
        console.error(`[PythonBridge] Using executor binary: ${executorBinary}`);
      } else {
        console.error(`[PythonBridge] Using Python: ${pythonPath}`);
        console.error(`[PythonBridge] Executor path: ${executorPath}`);
      }
    }

    if (executorBinary && fs.existsSync(executorBinary)) {
      this.pythonProcess = spawn(executorBinary, [], {
        env: process.env
      });
    } else {
      this.pythonProcess = spawn(pythonPath, [executorPath], {
        env: process.env
      });
    }

    this.pythonReader = readline.createInterface({
      input: this.pythonProcess.stdout,
      terminal: false,
    });

    this.pythonReader.on("line", (line) => {
      // 空行やJSONでない行（警告・ログなど）をスキップ
      if (!line.trim()) {
        return;
      }

      // JSON形式の行のみを処理
      try {
        const parsed = JSON.parse(line);
        if (this.debugMode) {
          console.error(`[PythonBridge] Received response: ${JSON.stringify(parsed).substring(0, 200)}...`);
        }
        const resolver = this.pendingResolvers.shift();
        if (resolver) {
          resolver.resolve(parsed);
        }
      } catch (e) {
        // JSONパースエラー: 非JSON行（警告・デバッグ出力など）を無視
        // resolverをshiftせず、次の有効なJSON行を待つ
        console.warn(`Non-JSON output from Python (ignored): ${line}`);
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

    // pending中の全てのpromiseをreject
    const error = new Error("Python process crashed");
    while (this.pendingResolvers.length > 0) {
      const resolver = this.pendingResolvers.shift();
      if (resolver) {
        resolver.reject(error);
      }
    }

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

  async call(
    action: string,
    params: any = {},
    options: { timeout?: number; retries?: number } = {},
  ): Promise<PythonResponse> {
    const timeout = options.timeout ?? this.defaultTimeout;
    const maxRetries = options.retries ?? this.maxRetries;
    let lastError: Error | null = null;

    if (this.debugMode) {
      const paramsPreview = JSON.stringify(params).substring(0, 200);
      console.error(`[PythonBridge] Calling action: ${action}, params: ${paramsPreview}...`);
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeCall(action, params, timeout);
        if (this.debugMode && result.execution_time_ms) {
          console.error(`[PythonBridge] Action ${action} completed in ${result.execution_time_ms}ms`);
        }
        return result;
      } catch (e: any) {
        lastError = e;
        console.error(
          `PythonBridge call failed (attempt ${attempt + 1}/${maxRetries + 1}): ${e.message}`,
        );

        // プロセスクラッシュやタイムアウトの場合にリトライを検討
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          if (this.debugMode) {
            console.error(`[PythonBridge] Retrying in ${delay}ms...`);
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
          // プロセスが死んでいる場合は自動的にhandleProcessCrashで再起動されるはずだが、
          // ここで明示的にチェックが必要な場合もある
          continue;
        }
      }
    }

    throw lastError || new Error(`Failed to call Python action: ${action}`);
  }

  private async executeCall(action: string, params: any, timeoutMs: number): Promise<PythonResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.pendingResolvers.findIndex((r) => r.resolve === resolve);
        if (index !== -1) {
          this.pendingResolvers.splice(index, 1);
          reject(new Error(`PythonBridge timeout after ${timeoutMs}ms for action: ${action}`));
        }
      }, timeoutMs);

      this.pendingResolvers.push({
        resolve: (val) => {
          clearTimeout(timeout);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });

      try {
        this.pythonProcess.stdin.write(JSON.stringify({ action, params }) + "\n");
      } catch (e) {
        clearTimeout(timeout);
        const index = this.pendingResolvers.findIndex((r) => r.resolve === resolve);
        if (index !== -1) {
          this.pendingResolvers.splice(index, 1);
        }
        reject(e);
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
    this.pythonProcess.kill();
    this.pythonReader.close();
  }
}
