import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiCacheManager } from "./cache-manager";
import { ACTION_FUNCTION_DECLARATIONS } from "./function-declarations";
import type { Action } from "./types";
import { ActionSchema } from "./types";
import { SYSTEM_PROMPT, DEBUG_SCREENSHOT_PREVIEW_LENGTH } from "./constants";

type GeminiContent = { role: "user" | "model"; parts: any[] };
type GeminiFunctionCall = { name: string; args?: any };
type GeminiResponse = {
  response?: { functionCalls?: GeminiFunctionCall[] | (() => GeminiFunctionCall[]) };
};

export class LLMClient {
  private genAI: GoogleGenerativeAI;
  private cacheManager: GeminiCacheManager;
  private model: any;
  private modelName: string;
  private screenSize: { width: number; height: number };
  private debugMode: boolean;
  private onLog: (type: string, message: string) => void;

  constructor(
    apiKey: string,
    screenSize: { width: number; height: number },
    debugMode: boolean = false,
    onLog: (type: string, message: string) => void = () => {},
  ) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.cacheManager = new GeminiCacheManager(apiKey);
    this.modelName = "gemini-3-flash-preview";
    this.screenSize = screenSize;
    this.debugMode = debugMode;
    this.onLog = onLog;

    this.model = this.genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        // @ts-ignore
        thinkingConfig: {
          thinkingLevel: "minimal",
        },
      },
      tools: [
        {
          functionDeclarations: ACTION_FUNCTION_DECLARATIONS,
        },
      ],
    });
  }

  getCacheManager(): GeminiCacheManager {
    return this.cacheManager;
  }

  updateScreenSize(width: number, height: number) {
    this.screenSize = { width, height };
  }

  private debugLog(message: string) {
    if (this.debugMode) {
      console.error(message);
    }
  }

  private debugLogSection(title: string, content: Record<string, any>) {
    if (!this.debugMode) return;
    console.error(`\n[DEBUG] ========== ${title} ==========`);
    for (const [key, value] of Object.entries(content)) {
      if (typeof value === "string") {
        console.error(`[DEBUG] ${key}: ${value}`);
      } else if (typeof value === "object" && value !== null) {
        console.error(`[DEBUG] ${key}: ${JSON.stringify(value, null, 2)}`);
      } else {
        console.error(`[DEBUG] ${key}: ${value}`);
      }
    }
    console.error(`[DEBUG] ==========================================\n`);
  }

  async getActions(
    history: GeminiContent[],
    screenshotBase64: string,
    mousePosition: { x: number; y: number },
    currentStep: number,
  ): Promise<{ calls: GeminiFunctionCall[]; actions: Action[] }> {
    const normX = Math.round((mousePosition.x / (this.screenSize.width || 1)) * 1000);
    const normY = Math.round((mousePosition.y / (this.screenSize.height || 1)) * 1000);

    const cacheName = this.cacheManager.getSystemPromptCacheName();
    let activeModel = this.model;

    if (cacheName) {
      // @ts-ignore
      activeModel = (this.genAI as any).getGenerativeModel(
        {
          model: this.modelName,
          generationConfig: {
            // @ts-ignore
            thinkingConfig: {
              thinkingLevel: "minimal",
            },
          },
          tools: [
            {
              functionDeclarations: ACTION_FUNCTION_DECLARATIONS,
            },
          ],
        },
        { cachedContent: cacheName },
      );
      this.onLog("info", `Using prompt cache: ${cacheName}`);
    }

    const formattedPrompt = SYSTEM_PROMPT.replace("{SCREEN_WIDTH}", this.screenSize.width.toString()).replace(
      "{SCREEN_HEIGHT}",
      this.screenSize.height.toString(),
    );

    const promptText = `現在のマウスカーソル位置: (${normX}, ${normY}) [正規化座標]。スクリーンショットを見て次のアクションをfunctionCallとして提案してください。必要に応じて複数提案して構いません。`;

    const contents: GeminiContent[] = [];
    if (!cacheName) {
      contents.push({ role: "user", parts: [{ text: formattedPrompt }] });
    }
    contents.push(...history);
    contents.push({
      role: "user",
      parts: [
        { text: promptText },
        {
          inlineData: {
            data: screenshotBase64,
            mimeType: "image/jpeg",
          },
        },
      ],
    });

    if (this.debugMode) {
      const historyDescription = contents
        .map((h, i) => {
          const partsDescription = h.parts
            .map((p: any) => {
              if (p.text) return `text(${p.text.substring(0, 100)}...)`;
              if (p.inlineData) return `image(${p.inlineData.mimeType})`;
              if (p.functionCall) return `functionCall(${p.functionCall.name})`;
              if (p.functionResponse) return `functionResponse(${p.functionResponse.name})`;
              return "unknown";
            })
            .join(", ");
          return `History[${i}] (${h.role}): ${partsDescription}`;
        })
        .join("\n[DEBUG]   ");

      this.debugLogSection(`Sending to AI (Step ${currentStep})`, {
        "Using cache": cacheName || "No",
        "Prompt text": promptText,
        "History length": `${history.length} messages`,
        "Total contents": contents.length,
        "History details": `\n[DEBUG]   ${historyDescription}`,
        Screenshot: screenshotBase64.substring(0, DEBUG_SCREENSHOT_PREVIEW_LENGTH),
      });
    }

    try {
      const response = await activeModel.generateContent({ contents });
      const functionCalls = this.extractFunctionCalls(response as GeminiResponse);

      if (!functionCalls || functionCalls.length === 0) {
        throw new Error("GeminiからfunctionCallが返されませんでした。");
      }

      const actions = functionCalls.map((call) => this.parseFunctionCall(call));

      if (actions.length !== functionCalls.length) {
        const mismatchMessage = `functionCallの数とパース済みアクションの数が一致しません (calls=${functionCalls.length}, actions=${actions.length})`;
        this.onLog("error", mismatchMessage);
        throw new Error(mismatchMessage);
      }

      if (this.debugMode) {
        this.debugLogSection(`AI functionCalls (Step ${currentStep})`, {
          calls: functionCalls,
          actions: actions,
        });
      }

      return { calls: functionCalls, actions };
    } catch (e: any) {
      this.onLog("error", `Geminiレスポンスの取得に失敗: ${e?.message || e}`);
      throw e;
    }
  }

  private extractFunctionCalls(response: GeminiResponse): GeminiFunctionCall[] {
    const fnCalls = response?.response?.functionCalls;
    if (Array.isArray(fnCalls)) return fnCalls;

    // Gemini JS SDK (v0.24系) では response.functionCalls() ヘルパーが用意されているため、そのケースも許容する
    if (typeof fnCalls === "function") {
      try {
        const maybe = fnCalls();
        if (Array.isArray(maybe)) return maybe;
      } catch (e) {
        this.debugLog(`[DEBUG] functionCalls extraction failed: ${e}`);
      }
    }

    return [];
  }

  private parseFunctionCall(call: GeminiFunctionCall): Action {
    const candidate: any = { action: call.name, params: call.args || {} };
    return ActionSchema.parse(candidate);
  }

  async createSystemPromptCache(systemPrompt: string): Promise<void> {
    try {
      const { totalTokens } = await this.model.countTokens(systemPrompt);
      if (totalTokens >= 1024) {
        await this.cacheManager.createSystemPromptCache(systemPrompt, this.modelName);
      } else {
        this.onLog(
          "info",
          `システムプロンプトが小さいためキャッシュをスキップします (${totalTokens} tokens)`,
        );
      }
    } catch (e) {
      console.error("Token count failed, attempting cache anyway:", e);
      await this.cacheManager.createSystemPromptCache(systemPrompt, this.modelName);
    }
  }

  async cacheUIElements(appName: string, uiData: any): Promise<void> {
    await this.cacheManager.cacheUIElements(appName, uiData, this.modelName);
  }
}
