import * as fs from "node:fs";
import { EventEmitter } from "node:events";
import type { Action, ActionBase } from "./types";
import * as path from "node:path";
import { PythonBridge } from "./python-bridge";
import { ActionExecutor } from "./action-executor";
import { LLMClient } from "./llm-client";
import { PERFORMANCE_CONFIG, SYSTEM_PROMPT } from "./constants";

type GeminiContent = { role: "user" | "model"; parts: any[] };
type GeminiFunctionCall = { name: string; args?: any };

export class MacOSAgent extends EventEmitter {
  private pythonBridge: PythonBridge;
  private actionExecutor: ActionExecutor;
  private llmClient: LLMClient;
  private screenSize: { width: number; height: number } = { width: 0, height: 0 };
  private userPromptQueue: string[] = [];
  private currentStep = 0;
  private stopRequested = false;
  private debugMode: boolean = false;
  private screenshotDir: string = "";

  constructor(debugMode: boolean = false) {
    super();
    this.debugMode = debugMode;

    // デバッグモード時にスクリーンショットディレクトリを設定
    if (this.debugMode) {
      // Note: process.cwd() はコントローラープロセスが起動された作業ディレクトリ（プロジェクトルート）を指す
      // desktop/main.js から spawn されるため、プロジェクトルート/.screenshot に保存される
      this.screenshotDir = path.join(process.cwd(), ".screenshot");
      if (!fs.existsSync(this.screenshotDir)) {
        fs.mkdirSync(this.screenshotDir, { recursive: true });
      }
      console.error(`[Agent] Debug mode enabled. Screenshots will be saved to: ${this.screenshotDir}`);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY環境変数が設定されていません。");
    }
    const nonAsciiIndex = [...apiKey].findIndex((char) => char.codePointAt(0)! > 255);
    if (nonAsciiIndex !== -1) {
      throw new Error(
        `GEMINI_API_KEYに非ASCII文字が含まれています (index ${nonAsciiIndex})。設定画面で正しいAPIキーを保存してください。`,
      );
    }

    // PythonBridge初期化
    this.pythonBridge = new PythonBridge(
      (message) => this.emit("error", message),
      () => this.init(),
    );

    // ActionExecutor初期化
    this.actionExecutor = new ActionExecutor(this.pythonBridge, this.screenSize, this.debugMode);

    // LLMClient初期化
    this.llmClient = new LLMClient(
      apiKey,
      this.screenSize,
      this.debugMode,
      (type, message) => this.log(type as "info" | "success" | "error" | "hint" | "action", message),
    );
  }

  async init() {
    const res = await this.pythonBridge.call("size");
    this.screenSize = { width: res.width || 0, height: res.height || 0 };
    this.actionExecutor.updateScreenSize(this.screenSize.width, this.screenSize.height);
    this.llmClient.updateScreenSize(this.screenSize.width, this.screenSize.height);
    this.log("info", `画面サイズ: ${this.screenSize.width}x${this.screenSize.height}`);
  }

  private log(type: "info" | "success" | "error" | "hint" | "action", message: string) {
    this.emit("log", { type, message, timestamp: new Date() });
  }

  private emitStatus(state: "idle" | "running" | "thinking" | "stopping") {
    this.emit("status", { state, timestamp: new Date() });
  }

  private getScreenshotFilename(step: number): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `step-${String(step).padStart(3, "0")}-${timestamp}.png`;
  }

  public addHint(hint: string) {
    this.userPromptQueue.push(hint);
    this.log("hint", `ヒントを追加: ${hint}`);
  }

  public reset() {
    this.userPromptQueue = [];
    this.stopRequested = false;
    this.llmClient
      .getCacheManager()
      .clearAllCaches()
      .catch((e) => console.error("Failed to clear caches:", e));
    this.emit("reset");
  }

  public stop() {
    this.stopRequested = true;
    this.log("info", "停止要求を受け付けました。");
  }

  private async setCursorVisibility(visible: boolean) {
    await this.pythonBridge.setCursorVisibility(visible);
    this.log("info", `マウスカーソルを${visible ? "表示" : "非表示"}にしました`);
  }

  public destroy() {
    this.pythonBridge.destroy();
    this.llmClient
      .getCacheManager()
      .clearAllCaches()
      .catch((e) => console.error("Failed to clear caches:", e));
    this.removeAllListeners();
  }

  async run(goal: string) {
    this.log("info", `ゴール: ${goal}`);
    this.stopRequested = false;
    this.emitStatus("running");

    // 実行開始時にマウスカーソルを非表示にする
    await this.setCursorVisibility(false);

    try {
      // システムプロンプトをキャッシュ (Phase 1)
      const formattedPrompt = SYSTEM_PROMPT.replace("{SCREEN_WIDTH}", this.screenSize.width.toString()).replace(
        "{SCREEN_HEIGHT}",
        this.screenSize.height.toString(),
      );

      await this.llmClient.createSystemPromptCache(formattedPrompt);

      const initRes = await this.pythonBridge.call("screenshot", {
        quality: PERFORMANCE_CONFIG.SCREENSHOT_QUALITY,
      });
      if (initRes.status !== "success" || !initRes.data || !initRes.mouse_position) {
        this.log("error", `初期観察失敗: ${initRes.message}`);
        return;
      }

      const history: GeminiContent[] = [
        { role: "user", parts: [{ text: `私の目標は次の通りです: ${goal}` }] },
        {
          role: "user",
          parts: [
            { text: "これが現在のデスクトップの初期状態です。この画面から操作を開始してください。" },
            { inlineData: { data: initRes.data, mimeType: "image/jpeg" } },
          ],
        },
      ];
      this.currentStep = 0;
      let completed = false;

      while (this.currentStep < PERFORMANCE_CONFIG.MAX_STEPS) {
        if (this.stopRequested) {
          this.log("info", "停止しました。");
          this.emit("stopped");
          break;
        }
        this.emit("step", this.currentStep + 1);
        this.log("info", `--- ステップ ${this.currentStep + 1} ---`);

        // ユーザーからの追加ヒントがあれば履歴に追加
        while (this.userPromptQueue.length > 0) {
          const hint = this.userPromptQueue.shift();
          if (hint) {
            history.push({
              role: "user",
              parts: [{ text: `[ユーザーからの追加指示/ヒント]: ${hint}` }],
            });
            this.log("hint", `ヒントを履歴に追加: ${hint}`);
          }
        }

        const res = await this.pythonBridge.call("screenshot", {
          quality: PERFORMANCE_CONFIG.SCREENSHOT_QUALITY,
        });
        if (res.status !== "success" || !res.data || !res.mouse_position) {
          this.log("error", `スクリーンショット取得失敗: ${res.message}`);
          break;
        }
        const screenshot = res.data;
        const mousePosition = res.mouse_position;

        // デバッグモード: スクリーンショットを保存
        if (this.debugMode && this.screenshotDir) {
          try {
            const filename = this.getScreenshotFilename(this.currentStep + 1);
            const filepath = path.join(this.screenshotDir, filename);
            fs.writeFileSync(filepath, Buffer.from(screenshot, "base64"));
            if (this.debugMode) {
              console.error(`[DEBUG] Screenshot saved: ${filepath}`);
            }
          } catch (e) {
            if (this.debugMode) {
              console.error(`[DEBUG] Failed to save screenshot: ${e}`);
            }
          }
        }

        this.emitStatus("thinking");
        const { actions, calls } = await this.llmClient.getActions(
          history,
          screenshot,
          mousePosition,
          this.currentStep,
        );
        this.emitStatus("running");
        actions.forEach((action) => this.log("action", `アクション: ${JSON.stringify(action)}`));

        if (actions.length !== calls.length) {
          const mismatchMsg = `functionCall配列とアクション配列の長さが一致しません (calls=${calls.length}, actions=${actions.length})`;
          this.log("error", mismatchMsg);
          throw new Error(mismatchMsg);
        }

        for (let i = 0; i < actions.length; i++) {
          const action = actions[i];
          const call = calls[i];

          if (!action || !call) continue;

          history.push({ role: "model", parts: [{ functionCall: call }] });

          if (action.action === "done") {
            this.log("success", `完了: ${action.params.message}`);
            history.push({
              role: "user",
              parts: [
                {
                  functionResponse: {
                    name: call.name,
                    response: { status: "success", message: action.params.message },
                  },
                },
              ],
            });
            this.emit("completed", action.params.message);
            completed = true;
            break;
          }

          if (action.action === "wait") {
            this.log("info", `${action.params.seconds}秒待機中...`);
            await new Promise((r) => setTimeout(r, action.params.seconds * 1000));
            history.push({
              role: "user",
              parts: [
                {
                  functionResponse: {
                    name: call.name,
                    response: { status: "success", waited_seconds: action.params.seconds },
                  },
                },
              ],
            });
            continue;
          }

          if (action.action === "search") {
            this.log("info", `AI検索実行: ${action.params.query}`);
            history.push({
              role: "user",
              parts: [
                {
                  functionResponse: {
                    name: call.name,
                    response: {
                      status: "success",
                      query: action.params.query,
                      note: "検索は内部知識で処理されました。結果をもとに次の操作を決定してください。",
                    },
                  },
                },
              ],
            });
            continue;
          }

          if (action.action === "batch") {
            this.log("info", `バッチ実行: ${action.params.actions.length}個のアクション`);
            const batchResults: any[] = [];
            for (const subAction of action.params.actions) {
              const { functionResponse } = await this.actionExecutor.execute(subAction);
              batchResults.push(functionResponse);
              await new Promise((r) => setTimeout(r, PERFORMANCE_CONFIG.BATCH_ACTION_DELAY_MS));
            }
            history.push({
              role: "user",
              parts: [
                { functionResponse: { name: call.name, response: { status: "success", results: batchResults } } },
              ],
            });
            continue;
          }

          const { result, functionResponse } = await this.actionExecutor.execute(action as ActionBase);

          // UI要素のキャッシュ (Phase 2)
          if (action.action === "elementsJson" && result.status === "success" && result.ui_data) {
            await this.llmClient.cacheUIElements((action as any).params.app_name, result.ui_data);
          }

          if (result.execution_time_ms !== undefined) {
            this.log("info", `  アクション ${action.action}: ${result.execution_time_ms}ms`);
          }

          history.push({ role: "user", parts: [{ functionResponse }] });
        }

        if (completed) {
          break;
        }

        this.currentStep++;
        await new Promise((r) => setTimeout(r, PERFORMANCE_CONFIG.STEP_DELAY_MS));
      }

      this.emit("runCompleted");
    } finally {
      // 終了時に必ずマウスカーソルを再表示する
      await this.setCursorVisibility(true);
    }
  }
}
