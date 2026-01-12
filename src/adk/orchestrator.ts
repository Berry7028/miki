import { EventEmitter } from "node:events";
import { InMemorySessionService } from "@google/adk";
import "./adk-patches";
import { PythonBridge } from "../core/python-bridge";
import { MacOSToolSuite } from "./tools/macos-tool-suite";
import { InitializationService, InitializationConfig } from "./services/initialization-service";
import { ExecutionService } from "./services/execution-service";
import { PERFORMANCE_CONFIG } from "../core/constants";

export class MacOSAgentOrchestrator extends EventEmitter {
  private pythonBridge: PythonBridge;
  private initializationService: InitializationService;
  private executionService?: ExecutionService;
  private sessionService: InMemorySessionService;
  private config?: InitializationConfig;
  private debugMode: boolean;
  private apiKey: string;
  private isInitialized = false;

  constructor(apiKey: string, debugMode: boolean = false) {
    super();
    this.apiKey = apiKey;
    this.debugMode = debugMode;
    this.sessionService = new InMemorySessionService();

    // PythonBridgeの初期化
    this.pythonBridge = new PythonBridge(
      (message) => this.emit("error", message),
      () => {
        this.init().catch(err => {
          this.log("error", `Background initialization error: ${err}`);
        });
      }
    );

    // サービスの初期化
    this.initializationService = new InitializationService(
      this.pythonBridge,
      this.apiKey,
      this.debugMode
    );
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.log("info", "Orchestratorを初期化しています...");

      // 初期化サービスで設定を取得
      this.config = await this.initializationService.initialize();

      this.log("info", `画面サイズ: ${this.config.screenSize.width}x${this.config.screenSize.height}`);
      this.log("info", `デフォルトブラウザ: ${this.config.defaultBrowser}`);

      // コンポーネントの作成
      const components = this.initializationService.createComponents(this.config);
      this.sessionService = components.sessionService;

      // 実行サービスの初期化
      this.executionService = new ExecutionService(
        components.runner,
        this.sessionService,
        this.pythonBridge
      );

      this.isInitialized = true;
      this.log("info", "Orchestratorの初期化が完了しました。");
      this.emit("ready");
    } catch (error) {
      this.log("error", `初期化エラー: ${error}`);
      this.emit("error", `初期化エラー: ${error}`);
      throw error;
    }
  }

  private log(type: "info" | "success" | "error" | "hint" | "action", message: string) {
    this.emit("log", { type, message, timestamp: new Date() });
  }

  private emitStatus(state: "idle" | "running" | "thinking" | "stopping") {
    this.emit("status", { state, timestamp: new Date() });
  }

  async run(goal: string): Promise<void> {
    if (!this.isInitialized) {
      this.log("info", "Orchestratorが初期化されていないため、初期化を開始します...");
      await this.init();
    }

    if (!this.apiKey) {
      const errorMsg = "APIキーが設定されていません。設定画面でAPIキーを保存してください。";
      this.log("error", errorMsg);
      this.emit("error", errorMsg);
      return;
    }

    if (!this.config || !this.executionService) {
      const errorMsg = "Orchestratorが正しく初期化されていません。";
      this.log("error", errorMsg);
      this.emit("error", errorMsg);
      return;
    }

    this.log("info", `タスク開始 - ゴール: ${goal}`);

    await this.executionService.execute(
      goal,
      this.config.screenSize,
      this.config.defaultBrowser,
      this.config.defaultBrowserId,
      {
        onLog: (type, message) => this.log(type, message),
        onStatus: (state) => this.emitStatus(state),
        onThinking: (phase, thought, message) => {
          this.emit("thinking", { phase, thought, message });
        },
        onCompleted: (message) => {
          this.emit("completed", message);
        },
        onActionUpdate: (action, params) => {
          this.emit("action_update", {
            phase: "running",
            action,
            params
          });
        },
        onStep: (stepCount) => {
          this.emit("step", stepCount);
        },
        onRunCompleted: () => {
          this.emit("runCompleted");
        }
      }
    );
  }

  stop(): void {
    this.executionService?.stop();
    this.log("info", "停止要求を受け付けました。");
  }

  async reset(): Promise<void> {
    this.executionService?.reset();
    this.emit("reset");
    this.log("info", "リセットしました。");
  }

  addHint(text: string): void {
    this.log("hint", `ヒントを追加: ${text}`);
  }

  destroy(): void {
    this.pythonBridge.destroy();
    this.removeAllListeners();
  }
}
