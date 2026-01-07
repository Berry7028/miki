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
      // 空行やJSONでない行（警告・ログなど）をスキップ
      if (!line.trim()) {
        return;
      }

      // JSON形式の行のみを処理
      try {
        const parsed = JSON.parse(line);
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

  async call(action: string, params: any = {}): Promise<PythonResponse> {
    return new Promise((resolve, reject) => {
      this.pendingResolvers.push({ resolve, reject });
      this.pythonProcess.stdin.write(JSON.stringify({ action, params }) + "\n");
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
