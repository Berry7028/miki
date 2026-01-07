import * as fs from "node:fs";
import { EventEmitter } from "node:events";
import type { Action, ActionBase, UIElement, UIElementsResponse } from "./types";
import * as path from "node:path";
import { PythonBridge } from "./python-bridge";
import { ActionExecutor } from "./action-executor";
import { LLMClient } from "./llm-client";
import { HISTORY_CONFIG, PERFORMANCE_CONFIG, SYSTEM_PROMPT, THINKING_PHASE_LABELS } from "./constants";

type GeminiContent = { role: "user" | "model"; parts: any[] };
type GeminiFunctionCall = { name: string; args?: any };

export class MacOSAgent extends EventEmitter {
  private pythonBridge: PythonBridge;
  private actionExecutor: ActionExecutor;
  private llmClient: LLMClient;
  private screenSize: { width: number; height: number } = { width: 0, height: 0 };
  private defaultBrowser: string = "Safari";
  private userPromptQueue: string[] = [];
  private currentStep = 0;
  private stopRequested = false;
  private debugMode: boolean = false;
  private screenshotDir: string = "";
  private lastCachedStep = -1; // キャッシュ済みの最後のステップ

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
      console.error(
        `[Agent] Debug mode enabled. Screenshots will be saved to: ${this.screenshotDir}`,
      );
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
    this.llmClient = new LLMClient(apiKey, this.screenSize, this.debugMode, (type, message) =>
      this.log(type as "info" | "success" | "error" | "hint" | "action", message),
    );
  }

  async init() {
    const res = await this.pythonBridge.call("size");
    this.screenSize = { width: res.width || 0, height: res.height || 0 };
    this.actionExecutor.updateScreenSize(this.screenSize.width, this.screenSize.height);
    this.llmClient.updateScreenSize(this.screenSize.width, this.screenSize.height);
    this.log("info", `画面サイズ: ${this.screenSize.width}x${this.screenSize.height}`);

    // デフォルトブラウザの取得
    try {
      const browserRes = await this.pythonBridge.call("browser");
      if (browserRes.status === "success" && browserRes.browser) {
        this.defaultBrowser = browserRes.browser;
        this.log("info", `デフォルトブラウザ: ${this.defaultBrowser}`);
      }
    } catch (e) {
      console.error("Failed to get default browser:", e);
    }
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

  private truncateText(value: string, maxChars: number): string {
    if (value.length <= maxChars) return value;
    return `${value.slice(0, maxChars)}... (truncated, ${value.length} chars)`;
  }

  private summarizeValue(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === "string") {
      return this.truncateText(value, HISTORY_CONFIG.MAX_TEXT_CHARS);
    }
    if (typeof value === "number" || typeof value === "boolean") return value;
    try {
      return this.truncateText(JSON.stringify(value), HISTORY_CONFIG.MAX_TEXT_CHARS);
    } catch (e) {
      return "[unserializable]";
    }
  }

  private summarizeUiElement(
    element: UIElement,
    depth: number,
    state: { remaining: number; total: number; truncated: boolean },
  ): Record<string, any> | null {
    if (state.remaining <= 0) {
      state.truncated = true;
      return null;
    }

    state.remaining -= 1;
    state.total += 1;

    const summary: Record<string, any> = {
      role: element.role,
      name: this.truncateText(element.name || "", HISTORY_CONFIG.MAX_TEXT_CHARS),
    };

    if (element.subrole) {
      summary.subrole = this.truncateText(element.subrole, HISTORY_CONFIG.MAX_TEXT_CHARS);
    }
    if (element.value !== undefined) {
      summary.value = this.summarizeValue(element.value);
    }
    if (element.position) summary.position = element.position;
    if (element.size) summary.size = element.size;
    if (element.enabled !== undefined) summary.enabled = element.enabled;
    if (element.focused !== undefined) summary.focused = element.focused;
    if (element.selected !== undefined) summary.selected = element.selected;
    if (element.actions && element.actions.length > 0) {
      summary.actions = element.actions.slice(0, HISTORY_CONFIG.MAX_ACTIONS);
      if (element.actions.length > HISTORY_CONFIG.MAX_ACTIONS) {
        summary.actions_truncated = element.actions.length - HISTORY_CONFIG.MAX_ACTIONS;
      }
    }

    const children = element.children || [];
    if (children.length > 0) {
      if (depth >= HISTORY_CONFIG.MAX_UI_DEPTH) {
        summary.children_omitted = children.length;
        state.truncated = true;
        return summary;
      }

      const limit = Math.min(children.length, HISTORY_CONFIG.MAX_UI_CHILDREN);
      const summarizedChildren: Record<string, any>[] = [];
      for (let i = 0; i < limit; i++) {
        const child = children[i];
        if (!child) continue;
        const childSummary = this.summarizeUiElement(child, depth + 1, state);
        if (childSummary) {
          summarizedChildren.push(childSummary);
        } else {
          break;
        }
      }

      if (summarizedChildren.length > 0) {
        summary.children = summarizedChildren;
      }
      if (children.length > summarizedChildren.length) {
        summary.children_omitted = children.length - summarizedChildren.length;
        state.truncated = true;
      }
    }

    return summary;
  }

  private summarizeUiData(uiData: UIElementsResponse): Record<string, any> {
    const state = { remaining: HISTORY_CONFIG.MAX_UI_NODES, total: 0, truncated: false };
    const windows = Array.isArray(uiData?.windows) ? uiData.windows : [];
    const summarizedWindows: Record<string, any>[] = [];

    for (const window of windows) {
      const summary = this.summarizeUiElement(window, 0, state);
      if (summary) {
        summarizedWindows.push(summary);
      }
      if (state.remaining <= 0) break;
    }

    if (windows.length > summarizedWindows.length) {
      state.truncated = true;
    }

    return {
      windows: summarizedWindows,
      truncated: state.truncated,
      total_nodes: state.total,
      depth_limit: HISTORY_CONFIG.MAX_UI_DEPTH,
      node_limit: HISTORY_CONFIG.MAX_UI_NODES,
    };
  }

  private compactFunctionResponsePayload(payload: any): Record<string, any> {
    const compact: Record<string, any> = {
      status: payload?.status,
    };

    if (payload?.message !== undefined) {
      compact.message =
        typeof payload.message === "string"
          ? this.truncateText(payload.message, HISTORY_CONFIG.MAX_TEXT_CHARS)
          : payload.message;
    }

    if (payload?.execution_time_ms !== undefined) {
      compact.execution_time_ms = payload.execution_time_ms;
    }

    if (payload?.mouse_position) {
      compact.mouse_position = payload.mouse_position;
    }

    if (payload?.data !== undefined) {
      if (typeof payload.data === "string") {
        compact.data = this.truncateText(payload.data, HISTORY_CONFIG.MAX_DATA_CHARS);
        if (payload.data.length > HISTORY_CONFIG.MAX_DATA_CHARS) {
          compact.data_truncated = true;
        }
      } else {
        compact.data = payload.data;
      }
    }

    if (payload?.ui_data) {
      compact.ui_data = this.summarizeUiData(payload.ui_data as UIElementsResponse);
    }

    if (Array.isArray(payload?.elements)) {
      const trimmed = payload.elements
        .slice(0, HISTORY_CONFIG.MAX_WEB_ELEMENTS)
        .map((element: any) =>
          typeof element === "string"
            ? this.truncateText(element, HISTORY_CONFIG.MAX_TEXT_CHARS)
            : element,
        );
      compact.elements = trimmed;
      if (payload.elements.length > trimmed.length) {
        compact.elements_truncated = payload.elements.length - trimmed.length;
      }
    }

    if (payload?.screenshot) {
      compact.screenshot_omitted = true;
    }

    return compact;
  }

  private compactFunctionResponse(functionResponse: { name: string; response: any }): {
    name: string;
    response: any;
  } {
    return {
      name: functionResponse.name,
      response: this.compactFunctionResponsePayload(functionResponse.response),
    };
  }

  private pruneHistory(history: GeminiContent[]) {
    // 1. 画像データの削除 (直近3ステップより前)
    // 画像はトークン消費が激しいため、古いターンの画像は削除してテキスト(操作履歴)のみにする
    const STEP_THRESHOLD = 3;
    let messageCount = 0;
    // 後ろから数えて、一定数以上のターンに含まれる画像を削除
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i];
      if (entry && entry.role === "user") {
        messageCount++;
        if (messageCount > STEP_THRESHOLD) {
          entry.parts = entry.parts.filter((part: any) => !part.inlineData);
        }
      }
    }

    // 2. メッセージ数の削減
    if (history.length <= HISTORY_CONFIG.MAX_MESSAGES) return;

    // Manusの方針: 失敗した履歴は「何がダメだったか」を学習するために残す
    // 成功したターンや中間的なUI取得ターンは優先的に削除対象にする
    const first = history[0]; // 目標メッセージ
    const head: GeminiContent[] = first ? [first] : [];

    // 削除候補を選別
    // インデックス 1 から (最後 - 4) までの範囲で削る (直近4メッセージは必ず残す)
    const preserveLastN = 4;
    const candidates = history.slice(1, -preserveLastN);
    const recent = history.slice(-preserveLastN);

    // 失敗した(status: "error")メッセージを特定
    const failedIndices = new Set<number>();
    candidates.forEach((msg, idx) => {
      const hasError = msg.parts.some(
        (p) => p.functionResponse?.response?.status === "error",
      );
      if (hasError) {
        failedIndices.add(idx);
      }
    });

    // 削除しても良いメッセージをフィルタリング
    // 失敗したものは残し、それ以外を古い順に削る
    const maxToKeep = HISTORY_CONFIG.MAX_MESSAGES - head.length - recent.length;
    const filteredCandidates: GeminiContent[] = [];
    
    // まず失敗したメッセージを全部入れる
    for (const idx of Array.from(failedIndices).sort((a, b) => a - b)) {
      const candidate = candidates[idx];
      if (candidate) {
        filteredCandidates.push(candidate);
      }
    }

    // まだ余裕があれば、成功したメッセージも「新しい順」に入れる
    const remainingCount = maxToKeep - filteredCandidates.length;
    if (remainingCount > 0) {
      const successCandidates = candidates.filter((_, idx) => !failedIndices.has(idx));
      // 新しいものを優先して残す
      const toAdd = successCandidates.slice(-remainingCount);
      filteredCandidates.push(...toAdd);
      // インデックス順に並び替え
      filteredCandidates.sort((a, b) => {
        return history.indexOf(a) - history.indexOf(b);
      });
    }

    history.splice(0, history.length, ...head, ...filteredCandidates, ...recent);
  }

  private appendHistory(history: GeminiContent[], entry: GeminiContent) {
    // ここでは inlineData (画像) も含めて一旦追加する
    // pruneHistory の方で古い画像のパージを行う
    history.push(entry);
    this.pruneHistory(history);
  }

  public addHint(hint: string) {
    this.userPromptQueue.push(hint);
    this.log("hint", `ヒントを追加: ${hint}`);
  }

  public async reset() {
    this.userPromptQueue = [];
    this.stopRequested = true; // 実行中なら停止させる
    this.lastCachedStep = -1;
    try {
      await this.llmClient.getCacheManager().clearAllCaches();
      this.log("info", "コンテキストキャッシュをすべて削除しました。");
    } catch (e) {
      console.error("Failed to clear caches:", e);
    }
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
      const formattedPrompt = SYSTEM_PROMPT.replace(
        "{SCREEN_WIDTH}",
        this.screenSize.width.toString(),
      )
        .replace("{SCREEN_HEIGHT}", this.screenSize.height.toString())
        .replace(/{DEFAULT_BROWSER}/g, this.defaultBrowser);

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
            { text: "初期スクリーンショットは取得済みです。この画面から操作を開始してください。" },
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
            this.appendHistory(history, {
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
        this.emit("action_update", { phase: "thinking", message: "Thinking..." });

        // 定期的に履歴をキャッシュ (例: 3ステップごと)
        // KVキャッシュを更新することで、次回以降のTTFTとコストを抑える
        if (this.currentStep > 0 && this.currentStep % 3 === 0 && this.currentStep !== this.lastCachedStep) {
          // 直近1ターンを除いた履歴をキャッシュ
          const historyToCache = history.slice(0, -2);
          if (historyToCache.length > 0) {
            await this.llmClient.cacheHistory(historyToCache);
            this.lastCachedStep = this.currentStep;
          }
        }

        const { actions, calls } = await this.llmClient.getActions(
          history,
          screenshot,
          mousePosition,
          this.currentStep,
        );
        this.emitStatus("running");
        
        actions.forEach((action) => {
          if (action.action === "think") return;
          this.log("action", `アクション: ${JSON.stringify(action)}`);
        });

        if (actions.length !== calls.length) {
          const mismatchMsg = `functionCall配列とアクション配列の長さが一致しません (calls=${calls.length}, actions=${actions.length})`;
          this.log("error", mismatchMsg);
          throw new Error(mismatchMsg);
        }

        for (let i = 0; i < actions.length; i++) {
          const action = actions[i];
          const call = calls[i];

          if (!action || !call) continue;

          this.emit("action_update", { 
            phase: "running", 
            action: action.action, 
            params: "params" in action ? (action as any).params : undefined 
          });

          this.appendHistory(history, { role: "model", parts: [{ functionCall: call }] });

          if (action.action === "done") {
            this.log("success", `完了: ${action.params.message}`);
            this.appendHistory(history, {
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

          if (action.action === "think") {
            const phaseLabel = THINKING_PHASE_LABELS[action.params.phase] || action.params.phase;
            this.log("info", `[思考: ${phaseLabel}] ${action.params.thought}`);
            this.emit("thinking", {
              phase: action.params.phase,
              thought: action.params.thought,
              message: `[${phaseLabel}] ${action.params.thought}`,
            });
            this.appendHistory(history, {
              role: "user",
              parts: [
                {
                  functionResponse: {
                    name: call.name,
                    response: {
                      status: "success",
                      phase: action.params.phase,
                      thought: action.params.thought,
                      acknowledged: true,
                    },
                  },
                },
              ],
            });
            continue;
          }

          if (action.action === "wait") {
            this.log("info", `${action.params.seconds}秒待機中...`);
            await new Promise((r) => setTimeout(r, action.params.seconds * 1000));
            this.appendHistory(history, {
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
            this.appendHistory(history, {
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
              batchResults.push(this.compactFunctionResponse(functionResponse));
              await new Promise((r) => setTimeout(r, PERFORMANCE_CONFIG.BATCH_ACTION_DELAY_MS));
            }
            this.appendHistory(history, {
              role: "user",
              parts: [
                {
                  functionResponse: {
                    name: call.name,
                    response: { status: "success", results: batchResults },
                  },
                },
              ],
            });
            continue;
          }

          const { result, functionResponse } = await this.actionExecutor.execute(
            action as ActionBase,
          );
          const compactFunctionResponse = this.compactFunctionResponse(functionResponse);

          // UI要素のキャッシュ (Phase 2)
          if (action.action === "elementsJson" && result.status === "success" && result.ui_data) {
            await this.llmClient.cacheUIElements((action as any).params.app_name, result.ui_data);
          }

          if (result.execution_time_ms !== undefined) {
            this.log("info", `  アクション ${action.action}: ${result.execution_time_ms}ms`);
          }

          this.appendHistory(history, {
            role: "user",
            parts: [{ functionResponse: compactFunctionResponse }],
          });
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
