import { EventEmitter } from "node:events";
import { LlmAgent, Runner, InMemorySessionService, LoggingPlugin, type ToolContext, isFinalResponse, getFunctionCalls } from "@google/adk";
import "./adk-patches";
import { PythonBridge } from "../core/python-bridge";
import { MacOSToolSuite } from "./tools/macos-tool-suite";
import { MainAgentFactory } from "./agents/main-agent";
import { MacOSErrorHandlerPlugin } from "./errors/error-handler";
import { PERFORMANCE_CONFIG } from "../core/constants";
import { ContextManager } from "../core/context-manager";
import { ContextManagementPlugin } from "./plugins/context-plugin";

export class MacOSAgentOrchestrator extends EventEmitter {
  private pythonBridge: PythonBridge;
  private toolSuite!: MacOSToolSuite;
  private rootAgent!: LlmAgent;
  private runner!: Runner;
  private sessionService: InMemorySessionService;
  private contextManager: ContextManager;
  private screenSize: { width: number; height: number } = { width: 0, height: 0 };
  private defaultBrowser: string = "Safari";
  private defaultBrowserId: string = "";
  private debugMode: boolean;
  private stopRequested = false;
  private apiKey: string;
  private isInitialized = false;

  constructor(apiKey: string, debugMode: boolean = false) {
    super();
    this.apiKey = apiKey;
    this.debugMode = debugMode;
    this.sessionService = new InMemorySessionService();
    this.contextManager = new ContextManager();

    // PythonBridgeの初期化
    this.pythonBridge = new PythonBridge(
      (message) => this.emit("error", message),
      () => {
        this.init().catch(err => {
          this.log("error", `Background initialization error: ${err}`);
        });
      }
    );
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.log("info", "Orchestratorを初期化しています...");
      // 画面サイズの取得
      const res = await this.pythonBridge.call("size");
      this.screenSize = { width: res.width || 0, height: res.height || 0 };
      
      // デフォルトブラウザの取得 (タイムアウト付き)
      try {
        const browserRes = await this.pythonBridge.call("browser", {}, { timeout: 5000 });
        if (browserRes.status === "success" && browserRes.browser) {
          this.defaultBrowser = browserRes.browser;
          this.defaultBrowserId = browserRes.bundle_id || "";
          this.log("info", `デフォルトブラウザ: ${this.defaultBrowser}`);
        }
      } catch (e) {
        this.log("error", `ブラウザ取得エラー: ${e}。Safariを使用します。`);
      }

      this.log("info", `画面サイズ: ${this.screenSize.width}x${this.screenSize.height}`);

      // ツールスイートの構築
      this.toolSuite = new MacOSToolSuite(this.pythonBridge, this.screenSize);

      this.rootAgent = MainAgentFactory.create(
        this.toolSuite,
        this.apiKey,
        this.defaultBrowser,
        this.defaultBrowserId
      );

      // プラグインの設定
      const plugins = [
        new MacOSErrorHandlerPlugin(),
        new ContextManagementPlugin(this.contextManager)
      ];

      if (this.debugMode) {
        plugins.push(new LoggingPlugin());
      }

      // ランナーの初期化
      this.runner = new Runner({
        agent: this.rootAgent,
        appName: "miki-desktop",
        sessionService: this.sessionService,
        plugins: plugins
      });

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

    this.log("info", `タスク開始 - ゴール: ${goal}`);
    this.stopRequested = false;
    this.emitStatus("running");

    // Initialize context tracking
    this.contextManager.clear();
    this.contextManager.updateSnapshot({
      goal,
      completedActions: [],
      currentPhase: "planning",
      keyObservations: [],
    });

    if (!this.apiKey) {
      const errorMsg = "APIキーが設定されていません。設定画面でAPIキーを保存してください。";
      this.log("error", errorMsg);
      this.emit("error", errorMsg);
      return;
    }

    const sessionId = Date.now().toString();

    try {
      this.log("info", `セッションを作成しています (ID: ${sessionId})...`);
      // セッションの作成と初期状態の設定
      await this.sessionService.createSession({
        appName: "miki-desktop",
        userId: "default_user",
        sessionId: sessionId,
      });

      const session = await this.sessionService.getSession({
        appName: "miki-desktop",
        userId: "default_user",
        sessionId: sessionId,
      });

      if (session) {
        session.state["screen_size"] = this.screenSize;
        session.state["default_browser"] = this.defaultBrowser;
        session.state["default_browser_id"] = this.defaultBrowserId;
        session.state["current_app"] = "Finder";
      }

      this.log("info", "エージェントの実行を開始します...");
      await this.pythonBridge.setCursorVisibility(false);

      const stream = this.runner.runAsync({
        userId: "default_user",
        sessionId: sessionId,
        newMessage: {
          role: "user",
          parts: [{ text: goal }]
        }
      });

      let stepCount = 0;
      const completedActions: string[] = [];

      for await (const event of stream) {
        this.log("info", `イベントを受信しました: ${event.id || "no-id"}`);
        if (this.stopRequested) {
          this.log("info", "停止要求により中断しました。");
          break;
        }

        const functionCalls = getFunctionCalls(event);
        if (functionCalls.length > 0) {
          this.log("info", `${functionCalls.length} 個の関数呼び出しを処理します`);
          for (const call of functionCalls) {
            if (call.name === "think") {
              const args = call.args as any;
              const phaseLabel = {
                planning: "計画",
                executing: "実行",
                verification: "検証",
                reflection: "振り返り"
              }[args.phase] || args.phase;
              this.log("info", `[${phaseLabel}] ${args.thought}`);
              this.emit("thinking", {
                phase: args.phase,
                thought: args.thought,
                message: `[${phaseLabel}] ${args.thought}`
              });
              
              // Update context snapshot with current phase
              this.contextManager.updateSnapshot({
                currentPhase: args.phase,
              });
            } else if (call.name === "done") {
              const args = call.args as any;
              this.log("success", `完了: ${args.message}`);
              this.emit("completed", args.message);
              
              // Update context snapshot on completion
              this.contextManager.updateSnapshot({
                currentPhase: "completed",
                keyObservations: [args.message],
              });
            } else {
              this.log("action", `アクション: ${call.name} ${JSON.stringify(call.args)}`);
              this.emit("action_update", {
                phase: "running",
                action: call.name,
                params: call.args
              });
              
              // Track completed actions
              completedActions.push(call.name);
              this.contextManager.updateSnapshot({
                completedActions,
              });
            }
          }
        }

        // Emit context stats for monitoring
        if (this.debugMode && stepCount % 5 === 0) {
          const stats = this.contextManager.getStats();
          this.log("info", `Context stats: ${stats.messageCount} messages, ~${stats.estimatedTokens} tokens`);
        }

        if (isFinalResponse(event)) {
          this.log("info", "タスク実行が完了しました（最終レスポンスを受信）。");
          if (event.content && event.content.parts && event.content.parts[0] && event.content.parts[0].text) {
            this.log("info", `エージェントの最終回答: ${event.content.parts[0].text}`);
          }
          break;
        }

        stepCount++;
        this.emit("step", stepCount);
        
        if (stepCount >= PERFORMANCE_CONFIG.MAX_STEPS) {
          this.log("error", "最大ステップ数に達しました。");
          break;
        }
      }

      this.log("info", "実行ループが終了しました。");
      this.emit("runCompleted");
    } catch (error) {
      this.log("error", `実行エラー: ${error}`);
      console.error("Execution error detail:", error);
      this.emit("error", `実行エラー: ${error}`);
    } finally {
      await this.pythonBridge.setCursorVisibility(true);
      this.emitStatus("idle");
    }
  }

  stop(): void {
    this.stopRequested = true;
    this.log("info", "停止要求を受け付けました。");
  }

  async reset(): Promise<void> {
    this.stopRequested = true;
    this.contextManager.clear();
    this.emit("reset");
    this.log("info", "リセットしました。");
  }

  addHint(text: string): void {
    this.log("hint", `ヒントを追加: ${text}`);
  }

  getContextStats() {
    return this.contextManager.getStats();
  }

  getContextSnapshot() {
    return this.contextManager.getSnapshot();
  }

  destroy(): void {
    this.pythonBridge.destroy();
    this.contextManager.clear();
    this.removeAllListeners();
  }
}
