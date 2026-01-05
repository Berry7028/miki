import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as fs from "node:fs";
import * as readline from "node:readline";
import { EventEmitter } from "node:events";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiCacheManager } from "./cache-manager";
import { ActionSchema, type Action, type ActionBase, type PythonResponse } from "./types";
import * as path from "node:path";
import { ACTION_FUNCTION_DECLARATIONS } from "./function-declarations";

// パフォーマンス最適化設定
// Note: 環境に応じて調整可能。高速化優先だが、安定性に問題がある場合は値を増やすこと
const PERFORMANCE_CONFIG = {
  // 最大ステップ数: 通常タスクは10-20ステップだが、リトライやエラー対応の余裕を見て30に設定
  MAX_STEPS: 30,
  // ステップ間の遅延: 1秒だと体感が重いため、UIが追いつく最低ラインとして500msに設定
  // システムが不安定な場合は1000msに戻すことを推奨
  STEP_DELAY_MS: 500,
  // バッチアクション間の遅延: OSに負荷をかけすぎない程度の100msに設定
  // 一部の環境で安定しない場合は200-300msに増やすこと
  BATCH_ACTION_DELAY_MS: 100,
  // JPEG品質: 85で視覚品質を維持しつつファイルサイズを削減（1-100）
  // AIの認識精度に問題がある場合は90-95に上げることを検討
  SCREENSHOT_QUALITY: 85,
};

// デバッグログ用定数
const DEBUG_TEXT_TRUNCATE_LENGTH = 200;
const DEBUG_SCREENSHOT_PREVIEW_LENGTH = 50;

const SYSTEM_PROMPT = `
あなたはMacOSを精密に操作する自動化エージェントです。
提供された「関数ツール」（functionCall）だけを使い、現在のスクリーンショット、マウス位置、履歴を踏まえて目標達成のための次の一手を決定してください。

### 利用可能なアクション
- 用意された関数ツール (click, type, press, hotkey, move, scroll, drag, elementsJson, clickElement, typeToElement, focusElement, webElements, clickWebElement, osa, wait, search, done) のみを使用してください。
- 必要に応じて複数の functionCall を一度に返して構いません（依存する順序に注意してください）。

### 座標系
- **正規化座標**: X, Yともに **0から1000** の範囲を使用してください。
- (0,0)は左上、(1000,1000)は右下です。
- 実際の画面解像度: {SCREEN_WIDTH}x{SCREEN_HEIGHT}。

### 回答ルール
- JSONテキストを返さないでください。必ずfunctionCallとしてツールを呼び出してください。
- 状態が不明なときは elementsJson / webElements などでUI構造を先に取得してください。
- ウィンドウが非アクティブな場合は、まずフォーカスを与えてから操作してください。

### 成功のための戦略
- **アクティブなアプリの確認**: 現在アクティブなアプリケーションの名前は、画面左上のリンゴマークのすぐ右隣にあるメニューバーに表示されます。操作対象のアプリがアクティブかどうかを判断する際の参考にしてください。
- **macOSのウィンドウ操作**: 非アクティブなウィンドウ（タイトルバーの色が薄い、背後にある等）を操作する場合、最初のクリックはウィンドウを前面に出す（フォーカスする）ために使われ、要素はクリックされません。
  - **確認の徹底**: 各アクションの後、スクリーンショットを見て意図した通りに動いたか（メニューが開いたか、入力されたか等）を確認してください。変化がない場合はウィンドウが非アクティブだった可能性が高いです。
- **ブラウザ操作**: ブラウザを起動する場合は osa アプリ名は Comet を使用します。
- **UI把握**: 操作対象の座標が不明確な場合は、まず elementsJson または webElements を実行して位置を確認してください。
- **堅牢性**: 可能な限り clickElement などの要素ベースの操作を優先してください。
`;

type GeminiContent = { role: "user" | "model"; parts: any[] };
type GeminiFunctionCall = { name: string; args?: any };

export class MacOSAgent extends EventEmitter {
  private pythonProcess!: ChildProcessWithoutNullStreams;
  private pythonReader!: readline.Interface;
  private genAI: GoogleGenerativeAI;
  private cacheManager: GeminiCacheManager;
  private model: any;
  private modelName: string = "gemini-1.5-flash-001";
  private screenSize: { width: number; height: number } = { width: 0, height: 0 };
  private pendingResolvers: ((value: any) => void)[] = [];
  private userPromptQueue: string[] = [];
  private isRestarting = false;
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
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.cacheManager = new GeminiCacheManager(apiKey);
    this.modelName = "gemini-3-flash-preview";

    this.model = this.genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        // @ts-ignore
        thinkingConfig: {
          thinkingLevel: "minimal",
        },
      },
      tools: {
        functionDeclarations: ACTION_FUNCTION_DECLARATIONS,
      },
    });

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
          this.emit("error", `Python出力のパース失敗: ${line}`);
        }
      }
    });

    this.pythonProcess.stderr.on("data", (data) => {
      this.emit("error", `Pythonエラー: ${data}`);
    });

    // プロセスクラッシュの検知と自動再起動
    this.pythonProcess.on("exit", (code, signal) => {
      if (!this.isRestarting) {
        this.log("error", `Pythonプロセスが終了しました (code: ${code}, signal: ${signal})`);
        this.handleProcessCrash();
      }
    });

    this.pythonProcess.on("error", (error) => {
      this.log("error", `Pythonプロセスエラー: ${error.message}`);
      if (!this.isRestarting) {
        this.handleProcessCrash();
      }
    });
  }

  private async handleProcessCrash() {
    if (this.isRestarting) return;

    this.isRestarting = true;
    this.log("info", "Pythonプロセスを再起動しています...");

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

    this.log("success", "Pythonプロセスを再起動しました");

    // 画面サイズを再初期化
    await this.init();
  }

  private async callPython(action: string, params: any = {}): Promise<PythonResponse> {
    return new Promise((resolve) => {
      this.pendingResolvers.push(resolve);
      this.pythonProcess.stdin.write(JSON.stringify({ action, params }) + "\n");
    });
  }

  async init() {
    const res = await this.callPython("size");
    this.screenSize = { width: res.width || 0, height: res.height || 0 };
    this.log("info", `画面サイズ: ${this.screenSize.width}x${this.screenSize.height}`);
  }

  private log(type: "info" | "success" | "error" | "hint" | "action", message: string) {
    this.emit("log", { type, message, timestamp: new Date() });
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
      if (typeof value === 'string' && value.length > DEBUG_TEXT_TRUNCATE_LENGTH) {
        console.error(`[DEBUG] ${key}: ${value.substring(0, DEBUG_TEXT_TRUNCATE_LENGTH)}... (${value.length} chars)`);
      } else if (typeof value === 'object' && value !== null) {
        console.error(`[DEBUG] ${key}: ${JSON.stringify(value, null, 2)}`);
      } else {
        console.error(`[DEBUG] ${key}: ${value}`);
      }
    }
    console.error(`[DEBUG] ==========================================\n`);
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
    this.cacheManager.clearAllCaches().catch(e => console.error("Failed to clear caches:", e));
    this.emit("reset");
  }

  public stop() {
    this.stopRequested = true;
    this.log("info", "停止要求を受け付けました。");
  }

  private async setCursorVisibility(visible: boolean) {
    try {
      await this.callPython("setCursorVisibility", { visible });
      this.log("info", `マウスカーソルを${visible ? "表示" : "非表示"}にしました`);
    } catch (e) {
      console.error(`Failed to set cursor visibility: ${e}`);
    }
  }

  public destroy() {
    this.pythonProcess.kill();
    this.pythonReader.close();
    this.cacheManager.clearAllCaches().catch(e => console.error("Failed to clear caches:", e));
    this.removeAllListeners();
  }

  private async getActionsFromLLM(
    history: GeminiContent[],
    screenshotBase64: string,
    mousePosition: { x: number; y: number },
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
          tools: {
            functionDeclarations: ACTION_FUNCTION_DECLARATIONS,
          },
        },
        { cachedContent: cacheName }
      );
      this.log("info", `Using prompt cache: ${cacheName}`);
    }

    const formattedPrompt = SYSTEM_PROMPT
      .replace("{SCREEN_WIDTH}", this.screenSize.width.toString())
      .replace("{SCREEN_HEIGHT}", this.screenSize.height.toString());

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
      const historyDescription = contents.map((h, i) => {
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
      }).join("\n[DEBUG]   ");

      this.debugLogSection(`Sending to AI (Step ${this.currentStep})`, {
        "Using cache": cacheName || "No",
        "Prompt text": promptText,
        "History length": `${history.length} messages`,
        "Total contents": contents.length,
        "History details": `\n[DEBUG]   ${historyDescription}`,
        "Screenshot": screenshotBase64.substring(0, DEBUG_SCREENSHOT_PREVIEW_LENGTH)
      });
    }

    try {
      const response = await activeModel.generateContent({ contents });
      const rawFunctionCalls = (response as any).response?.functionCalls;
      const functionCalls: GeminiFunctionCall[] =
        typeof rawFunctionCalls === "function"
          ? rawFunctionCalls()
          : Array.isArray(rawFunctionCalls)
            ? rawFunctionCalls
            : [];

      if (!functionCalls || functionCalls.length === 0) {
        throw new Error("GeminiからfunctionCallが返されませんでした。");
      }

      const actions = functionCalls.map((call) => this.parseFunctionCall(call));

      if (actions.length !== functionCalls.length) {
        this.log(
          "error",
          `functionCallの数とパース済みアクションの数が一致しません (calls=${functionCalls.length}, actions=${actions.length})`,
        );
      }

      if (this.debugMode) {
        this.debugLogSection(`AI functionCalls (Step ${this.currentStep})`, {
          calls: functionCalls,
          actions: actions,
        });
      }

      return { calls: functionCalls, actions };
    } catch (e: any) {
      this.log("error", `Geminiレスポンスの取得に失敗: ${e?.message || e}`);
      throw e;
    }
  }

  private parseFunctionCall(call: GeminiFunctionCall): Action {
    const candidate: any = { action: call.name, params: call.args || {} };
    return ActionSchema.parse(candidate);
  }

  private async executeAction(
    action: ActionBase,
  ): Promise<{ result: PythonResponse; functionResponse: { name: string; response: any } }> {
    let execParams = { ...(action as any).params };
    let highlightPos: { x: number; y: number } | null = null;

    // デバッグログ: アクション実行前
    this.debugLogSection("Executing Action", {
      "Action": action.action,
      "Params (original)": execParams
    });

    // UI要素ベースの操作は座標変換不要
    const elementBasedActions = [
      "clickElement",
      "typeToElement",
      "focusElement",
      "elementsJson",
      "webElements",
      "clickWebElement",
    ];
    const isElementBased = elementBasedActions.includes(action.action);

    if (!isElementBased && execParams.x !== undefined && execParams.y !== undefined) {
      execParams.x = Math.round((execParams.x / 1000) * this.screenSize.width);
      execParams.y = Math.round((execParams.y / 1000) * this.screenSize.height);

      if (action.action === "click" || action.action === "move") {
        highlightPos = { x: execParams.x, y: execParams.y };
      }
    }

    // dragアクションの座標変換
    if (action.action === "drag") {
      execParams.from_x = Math.round((execParams.from_x / 1000) * this.screenSize.width);
      execParams.from_y = Math.round((execParams.from_y / 1000) * this.screenSize.height);
      execParams.to_x = Math.round((execParams.to_x / 1000) * this.screenSize.width);
      execParams.to_y = Math.round((execParams.to_y / 1000) * this.screenSize.height);
      // ドラッグの開始位置をハイライト
      highlightPos = { x: execParams.from_x, y: execParams.from_y };
    }

    if (this.debugMode && !isElementBased) {
      this.debugLog(`[DEBUG] Params (converted): ${JSON.stringify(execParams, null, 2)}`);
    }

    const result = await this.callPython(action.action, execParams);

    // デバッグログ: アクション実行結果
    if (this.debugMode) {
      const debugInfo: Record<string, any> = { "Result": result };
      
      // UI要素取得アクションの場合、詳細な結果を追加
      if (action.action === "elementsJson" && result.ui_data) {
        debugInfo["UI Elements Retrieved"] = result.ui_data;
      }
      if (action.action === "webElements" && result.elements) {
        debugInfo["Web Elements Retrieved"] = result.elements;
      }
      
      this.debugLogSection("Action Result", debugInfo);
    }

    // UI要素のキャッシュ (Phase 2)
    if (action.action === "elementsJson" && result.status === "success" && result.ui_data) {
      await this.cacheManager.cacheUIElements((action as any).params.app_name, result.ui_data, this.modelName);
    }

    if (result.execution_time_ms !== undefined) {
      this.log("info", `  アクション ${action.action}: ${result.execution_time_ms}ms`);
    }

    let screenshotBase64: string | undefined;
    if (highlightPos) {
      const hRes = await this.callPython("screenshot", { 
        highlight_pos: highlightPos,
        quality: PERFORMANCE_CONFIG.SCREENSHOT_QUALITY 
      });
      if (hRes.status === "success" && hRes.data) {
        screenshotBase64 = hRes.data;
      }
    }

    const responsePayload: any = {
      status: result.status,
      message: result.message,
      execution_time_ms: result.execution_time_ms,
      data: result.data,
      ui_data: result.ui_data,
      elements: result.elements,
      mouse_position: result.mouse_position,
    };

    if (screenshotBase64) {
      responsePayload.screenshot = screenshotBase64;
    }

    return { result, functionResponse: { name: action.action, response: responsePayload } };
  }

  async run(goal: string) {
    this.log("info", `ゴール: ${goal}`);
    this.stopRequested = false;
    this.emitStatus("running");

    // 実行開始時にマウスカーソルを非表示にする
    await this.setCursorVisibility(false);

    try {
      // システムプロンプトをキャッシュ (Phase 1)
      const formattedPrompt = SYSTEM_PROMPT
      .replace("{SCREEN_WIDTH}", this.screenSize.width.toString())
      .replace("{SCREEN_HEIGHT}", this.screenSize.height.toString());
    
    // トークン数をチェック（Geminiのキャッシュには最低1024トークン必要）
    try {
      const { totalTokens } = await this.model.countTokens(formattedPrompt);
      if (totalTokens >= 1024) {
        await this.cacheManager.createSystemPromptCache(formattedPrompt, this.modelName);
      } else {
        this.log("info", `システムプロンプトが小さいためキャッシュをスキップします (${totalTokens} tokens)`);
      }
    } catch (e) {
      console.error("Token count failed, attempting cache anyway:", e);
      await this.cacheManager.createSystemPromptCache(formattedPrompt, this.modelName);
    }

    const initRes = await this.callPython("screenshot", { 
      quality: PERFORMANCE_CONFIG.SCREENSHOT_QUALITY 
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

      const res = await this.callPython("screenshot", { 
        quality: PERFORMANCE_CONFIG.SCREENSHOT_QUALITY 
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
          this.debugLog(`[DEBUG] Screenshot saved: ${filepath}`);
        } catch (e) {
          this.debugLog(`[DEBUG] Failed to save screenshot: ${e}`);
        }
      }

      this.emitStatus("thinking");
      const { actions, calls } = await this.getActionsFromLLM(history, screenshot, mousePosition);
      this.emitStatus("running");
      actions.forEach((action) => this.log("action", `アクション: ${JSON.stringify(action)}`));

      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        const call = calls[i] ?? { name: action.action, args: (action as any).params };

        history.push({ role: "model", parts: [{ functionCall: call }] });

        if (action.action === "done") {
          this.log("success", `完了: ${action.params.message}`);
          history.push({
            role: "user",
            parts: [{ functionResponse: { name: call.name, response: { status: "success", message: action.params.message } } }],
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
            parts: [{ functionResponse: { name: call.name, response: { status: "success", waited_seconds: action.params.seconds } } }],
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
            const { functionResponse } = await this.executeAction(subAction);
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

        const { functionResponse } = await this.executeAction(action as ActionBase);
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
