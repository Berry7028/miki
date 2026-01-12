// Execution Service
// 責務: エージェントの実行ループとイベント処理

import { Runner, InMemorySessionService, isFinalResponse, getFunctionCalls } from "@google/adk";
import { PythonBridge } from "../../core/python-bridge";
import { PERFORMANCE_CONFIG } from "../../core/constants";

export interface ExecutionEventHandlers {
  onLog: (type: "info" | "success" | "error" | "hint" | "action", message: string) => void;
  onStatus: (state: "idle" | "running" | "thinking" | "stopping") => void;
  onThinking: (phase: string, thought: string, message: string) => void;
  onCompleted: (message: string) => void;
  onActionUpdate: (action: string, params: any) => void;
  onStep: (stepCount: number) => void;
  onRunCompleted: () => void;
}

export class ExecutionService {
  private stopRequested = false;

  constructor(
    private runner: Runner,
    private sessionService: InMemorySessionService,
    private pythonBridge: PythonBridge
  ) {}

  async execute(
    goal: string,
    screenSize: { width: number; height: number },
    defaultBrowser: string,
    defaultBrowserId: string,
    handlers: ExecutionEventHandlers
  ): Promise<void> {
    this.stopRequested = false;
    handlers.onStatus("running");

    const sessionId = Date.now().toString();

    try {
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
        session.state["screen_size"] = screenSize;
        session.state["default_browser"] = defaultBrowser;
        session.state["default_browser_id"] = defaultBrowserId;
        session.state["current_app"] = "Finder";
      }

      await this.pythonBridge.setCursorVisibility(false);

      const stream = this.runner.runAsync({
        userId: "default_user",
        sessionId: sessionId,
        newMessage: {
          role: "user",
          parts: [{ text: goal }]
        }
      });

      await this.processStream(stream, handlers);
      handlers.onRunCompleted();
    } catch (error) {
      handlers.onLog("error", `実行エラー: ${error}`);
      throw error;
    } finally {
      await this.pythonBridge.setCursorVisibility(true);
      handlers.onStatus("idle");
    }
  }

  private async processStream(stream: AsyncIterable<any>, handlers: ExecutionEventHandlers): Promise<void> {
    let stepCount = 0;

    for await (const event of stream) {
      if (this.stopRequested) {
        handlers.onLog("info", "停止要求により中断しました。");
        break;
      }

      const functionCalls = getFunctionCalls(event);
      if (functionCalls.length > 0) {
        for (const call of functionCalls) {
          if (call.name === "think") {
            const args = call.args as any;
            const phaseLabel = {
              planning: "計画",
              executing: "実行",
              verification: "検証",
              reflection: "振り返り"
            }[args.phase] || args.phase;
            handlers.onLog("info", `[${phaseLabel}] ${args.thought}`);
            handlers.onThinking(args.phase, args.thought, `[${phaseLabel}] ${args.thought}`);
          } else if (call.name === "done") {
            const args = call.args as any;
            handlers.onLog("success", `完了: ${args.message}`);
            handlers.onCompleted(args.message);
          } else {
            handlers.onLog("action", `アクション: ${call.name} ${JSON.stringify(call.args)}`);
            handlers.onActionUpdate(call.name, call.args);
          }
        }
      }

      if (isFinalResponse(event)) {
        handlers.onLog("info", "タスク実行が完了しました（最終レスポンスを受信）。");
        break;
      }

      stepCount++;
      handlers.onStep(stepCount);

      if (stepCount >= PERFORMANCE_CONFIG.MAX_STEPS) {
        handlers.onLog("error", "最大ステップ数に達しました。");
        break;
      }
    }
  }

  stop(): void {
    this.stopRequested = true;
  }

  reset(): void {
    this.stopRequested = true;
  }
}
