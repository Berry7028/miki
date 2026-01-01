import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as fs from "node:fs";
import * as readline from "node:readline";
import { EventEmitter } from "node:events";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiCacheManager } from "./cache-manager";
import { ActionSchema, type Action, type ActionBase, type PythonResponse } from "./types";
import * as path from "node:path";

const SYSTEM_PROMPT = `あなたはMacOSを精密に操作する自動化エージェントです。
現在のスクリーンショット、マウス位置、履歴に基づき、目標達成のための次の一手を決定してください。

### 🛠 利用可能なアクション (厳守)
以下のアクションとパラメータのみを使用してください。これ以外のツール名や形式はパースエラーとなります。

1. **click**: 特定の座標をクリック
   - {"action": "click", "params": {"x": number, "y": number}}
2. **type**: テキストを入力（事前にclickでフォーカスすること）
   - {"action": "type", "params": {"text": string}}
3. **press**: 単一のキー（Enter, Esc等）を押す
   - {"action": "press", "params": {"key": string}}
4. **hotkey**: 修飾キーを含む組み合わせ（command+t等）
   - {"action": "hotkey", "params": {"keys": ["command", "t"]}}
5. **move**: マウスを移動
   - {"action": "move", "params": {"x": number, "y": number}}
6. **scroll**: 垂直スクロール
   - {"action": "scroll", "params": {"amount": number}}
7. **drag**: 指定座標から指定座標へドラッグ
   - {"action": "drag", "params": {"from_x": number, "from_y": number, "to_x": number, "to_y": number}}
8. **elementsJson**: UI要素構造を取得（新しいアプリで最初に実行を推奨）
   - {"action": "elementsJson", "params": {"app_name": string, "max_depth": 3}}
9. **clickElement**: 名前と役割でUI要素をクリック（座標より堅牢）
   - {"action": "clickElement", "params": {"app_name": string, "role": string, "name": string}}
10. **typeToElement**: 指定要素にテキスト入力
    - {"action": "typeToElement", "params": {"app_name": string, "role": string, "name": string, "text": string}}
11. **webElements**: ブラウザ(Comet)内のWeb要素を取得
    - {"action": "webElements", "params": {"app_name": "Comet"}}
12. **clickWebElement**: ブラウザ内のWeb要素をクリック
    - {"action": "clickWebElement", "params": {"app_name": "Comet", "role": string, "name": string}}
13. **osa**: AppleScriptを実行（アプリ起動やウィンドウ操作に強力）
    - {"action": "osa", "params": {"script": string}}
14. **wait**: 指定秒数待機
    - {"action": "wait", "params": {"seconds": number}}
15. **batch**: 複数アクションを連続実行
    - {"action": "batch", "params": {"actions": [ActionObjects]}}
16. **done**: 全てのタスクが完了
    - {"action": "done", "params": {"message": string}}

### 📐 座標系
- **正規化座標**: X, Yともに **0から1000** の範囲を使用してください。
- (0,0)は左上、(1000,1000)は右下です。
- 実際の画面解像度: {SCREEN_WIDTH}x{SCREEN_HEIGHT}。

### ⚠️ 回答の絶対ルール
- **形式**: 出力は必ず単一のJSONオブジェクトのみにしてください。
- **配列禁止**: [{"action": ...}] のように配列で囲まないでください。
- **独自キー禁止**: "point": [x,y] や "key_tap" などの独自形式は絶対に使用せず、上記定義に従ってください。
- **テキスト禁止**: JSON以外の解説文などは一切含めないでください。

### 💡 成功のための戦略
- **ブラウザ操作**: ブラウザを起動する場合は osa アプリ名は Comet を使用します。
- **UI把握**: 操作対象の座標が不明確な場合は、まず elementsJson または webElements を実行して位置を確認してください。
- **堅牢性**: 可能な限り clickElement などの要素ベースの操作を優先してください。`;

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

  constructor() {
    super();
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
        responseMimeType: "application/json",
      },
      tools: [
        {
          // @ts-ignore
          googleSearch: {},
        },
      ] as any,
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

  public destroy() {
    this.pythonProcess.kill();
    this.pythonReader.close();
    this.cacheManager.clearAllCaches().catch(e => console.error("Failed to clear caches:", e));
    this.removeAllListeners();
  }

  private async getActionFromLLM(
    history: any[],
    screenshotBase64: string,
    mousePosition: { x: number; y: number },
  ): Promise<Action> {
    const normX = Math.round((mousePosition.x / (this.screenSize.width || 1)) * 1000);
    const normY = Math.round((mousePosition.y / (this.screenSize.height || 1)) * 1000);

    let retryCount = 0;
    const maxRetries = 3;
    let errorMessage = "";

    // キャッシュの利用確認 (Phase 1)
    const cacheName = this.cacheManager.getSystemPromptCacheName();
    let activeModel = this.model;

    if (cacheName) {
      // @ts-ignore
      activeModel = (this.genAI as any).getGenerativeModel(
        { 
          model: this.modelName,
          generationConfig: {
            responseMimeType: "application/json",
          },
          tools: [
            {
              // @ts-ignore
              googleSearch: {},
            },
          ] as any,
        },
        { cachedContent: cacheName }
      );
      this.log("info", `Using prompt cache: ${cacheName}`);
    }

    while (retryCount < maxRetries) {
      const geminiHistory = history.map((h) => {
        if (typeof h.content === "string") {
          return { role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.content }] };
        } else if (Array.isArray(h.content)) {
          const parts = h.content.map((c: any) => {
            if (c.type === "text") return { text: c.text };
            if (c.type === "image_url") {
              const base64Data = c.image_url.url.split(",")[1];
              return { inlineData: { data: base64Data, mimeType: "image/png" } };
            }
            return { text: "" };
          });
          return { role: h.role === "assistant" ? "model" : "user", parts };
        }
        return { role: "user", parts: [{ text: "" }] };
      });

      const promptText =
        retryCount === 0
          ? `現在のマウスカーソル位置: (${normX}, ${normY}) [正規化座標]。
目標を達成するための次のアクションは何ですか？スクリーンショットで位置を確認してください。`
          : `前回の回答のパースに失敗しました。
エラー: ${errorMessage}

必ず有効なJSON形式で、指定されたスキーマに従って回答してください。
余計な解説やJSON以外のテキストは一切含めないでください。
現在のマウスカーソル位置: (${normX}, ${normY}) [正規化座標]。`;

      const promptParts: any[] = [];
      
      // キャッシュがない場合のみシステムプロンプトを含める
      if (!cacheName) {
        const formattedPrompt = SYSTEM_PROMPT
          .replace("{SCREEN_WIDTH}", this.screenSize.width.toString())
          .replace("{SCREEN_HEIGHT}", this.screenSize.height.toString());
        promptParts.push({ text: formattedPrompt });
      }

      promptParts.push(...geminiHistory.flatMap((h: any) => h.parts));
      promptParts.push({ text: promptText });
      promptParts.push({
        inlineData: {
          data: screenshotBase64,
          mimeType: "image/png",
        },
      });

      let fullContent = "";
      let thoughtProcess = "";
      const thoughtId = `thought-${this.currentStep}-${retryCount}`;

      try {
        const resultStream = await activeModel.generateContentStream(promptParts);
        for await (const chunk of resultStream.stream) {
          // @ts-ignore
          const parts = chunk.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            // @ts-ignore
            if (part.thought) {
              // @ts-ignore
              thoughtProcess += part.text;
              this.emit("log", {
                id: thoughtId,
                type: "thought",
                message: thoughtProcess,
                timestamp: new Date(),
                isComplete: false,
              });
            } else if (part.text) {
              fullContent += part.text;
            }
          }
        }

        if (thoughtProcess) {
          this.emit("log", {
            id: thoughtId,
            type: "thought",
            message: thoughtProcess,
            timestamp: new Date(),
            isComplete: true,
          });
        }
      } catch (error: any) {
        this.log("error", `Geminiストリーミング失敗: ${error?.message || error}`);
        this.log("info", "非ストリーミングで再試行します。");
        try {
          const response = await activeModel.generateContent(promptParts);
          fullContent = response.response.text();
        } catch (fallbackError: any) {
          this.log(
            "error",
            `Gemini非ストリーミング失敗: ${fallbackError?.message || fallbackError}`,
          );
          throw fallbackError;
        }
      }

      let content = fullContent;
      const rawContent = content;

      const jsonMatch =
        content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        content = jsonMatch[1].trim();
      } else {
        content = content.trim();
      }

      try {
        let parsed = JSON.parse(content);
        
        // 配列で返ってきた場合は最初の要素を取得
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed = parsed[0];
        }

        // Geminiがよく使う 'point' キーや 'params' 欠落を補正
        if (parsed.action === "point") parsed.action = "click";
        if (parsed.action === "key_tap" || parsed.action === "key_combination") {
          parsed.action = "hotkey";
          parsed.params = parsed.params || {};
          if (parsed.key && parsed.modifiers) {
            parsed.params.keys = [...parsed.modifiers, parsed.key];
          } else if (parsed.key_combination) {
            parsed.params.keys = parsed.key_combination.split("+");
          }
        }
        
        if (parsed.point && Array.isArray(parsed.point) && parsed.point.length === 2) {
          parsed.params = parsed.params || {};
          parsed.params.x = parsed.point[0];
          parsed.params.y = parsed.point[1];
          delete parsed.point;
        }

        if (parsed.params && parsed.params.point && Array.isArray(parsed.params.point) && parsed.params.point.length === 2) {
          parsed.params.x = parsed.params.point[0];
          parsed.params.y = parsed.params.point[1];
          delete parsed.params.point;
        }

        // params が欠落しているがトップレベルに座標がある場合
        if (!parsed.params && parsed.x !== undefined && parsed.y !== undefined) {
          parsed.params = { x: parsed.x, y: parsed.y };
          delete parsed.x;
          delete parsed.y;
        }

        return ActionSchema.parse(parsed);
      } catch (e: any) {
        this.log("error", `Geminiレスポンスのパース失敗 (試行 ${retryCount + 1}/${maxRetries})`);
        this.log("error", `生コンテンツ: ${rawContent}`);
        errorMessage = e.message;

        // 失敗した回答を履歴に追加して、次のリトライに活かす
        history.push({ role: "assistant", content: rawContent });
        retryCount++;
      }
    }

    throw new Error(`Failed to get valid action from Gemini after ${maxRetries} retries.`);
  }

  private async executeAction(
    action: ActionBase,
  ): Promise<{ result: PythonResponse; observationContent: any[] }> {
    let execParams = { ...(action as any).params };
    let highlightPos: { x: number; y: number } | null = null;

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

    const result = await this.callPython(action.action, execParams);

    // UI要素のキャッシュ (Phase 2)
    if (action.action === "elementsJson" && result.status === "success" && result.ui_data) {
      await this.cacheManager.cacheUIElements((action as any).params.app_name, result.ui_data, this.modelName);
    }

    if (result.execution_time_ms !== undefined) {
      this.log("info", `  アクション ${action.action}: ${result.execution_time_ms}ms`);
    }

    let observationContent: any[] = [
      {
        type: "text",
        text: `Action ${action.action} performed. Result: ${JSON.stringify(result)}`,
      },
    ];

    if (highlightPos) {
      const hRes = await this.callPython("screenshot", { highlight_pos: highlightPos });
      if (hRes.status === "success" && hRes.data) {
        observationContent.push({
          type: "image_url",
          image_url: { url: `data:image/png;base64,${hRes.data}` },
        });
        observationContent.push({
          type: "text",
          text: "The red dot in the screenshot above shows where the action was performed.",
        });
      }
    }

    return { result, observationContent };
  }

  async run(goal: string) {
    this.log("info", `ゴール: ${goal}`);
    this.stopRequested = false;

    // システムプロンプトをキャッシュ (Phase 1)
    const formattedPrompt = SYSTEM_PROMPT
      .replace("{SCREEN_WIDTH}", this.screenSize.width.toString())
      .replace("{SCREEN_HEIGHT}", this.screenSize.height.toString());
    
    await this.cacheManager.createSystemPromptCache(formattedPrompt, this.modelName);

    const initRes = await this.callPython("screenshot");
    if (initRes.status !== "success" || !initRes.data || !initRes.mouse_position) {
      this.log("error", `初期観察失敗: ${initRes.message}`);
      return;
    }

    const history: any[] = [
      { role: "user", content: `私の目標は次の通りです: ${goal}` },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "これが現在のデスクトップの初期状態です。この画面から操作を開始してください。",
          },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${initRes.data}` },
          },
        ],
      },
    ];
    this.currentStep = 0;

    while (this.currentStep < 20) {
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
            content: `[ユーザーからの追加指示/ヒント]: ${hint}`,
          });
          this.log("hint", `ヒントを履歴に追加: ${hint}`);
        }
      }

      const res = await this.callPython("screenshot");
      if (res.status !== "success" || !res.data || !res.mouse_position) {
        this.log("error", `スクリーンショット取得失敗: ${res.message}`);
        break;
      }
      const screenshot = res.data;
      const mousePosition = res.mouse_position;

      const action = await this.getActionFromLLM(history, screenshot, mousePosition);
      this.log("action", `アクション: ${JSON.stringify(action)}`);

      if (action.action === "done") {
        this.log("success", `完了: ${action.params.message}`);
        this.emit("completed", action.params.message);
        break;
      }

      if (action.action === "wait") {
        this.log("info", `${action.params.seconds}秒待機中...`);
        await new Promise((r) => setTimeout(r, action.params.seconds * 1000));
        history.push({
          role: "assistant",
          content: `I waited for ${action.params.seconds} seconds.`,
        });
        this.currentStep++;
        continue;
      }

      if (action.action === "search") {
        this.log("info", `AI検索実行: ${action.params.query}`);
        history.push({ role: "assistant", content: JSON.stringify(action) });
        history.push({
          role: "user",
          content: `[System]: Google検索「${action.params.query}」の結果、必要な情報はあなたの知識ベースまたは内部ツールを通じて収集されました。得られた知見を元に、次のアクションを実行してください。`,
        });
        this.currentStep++;
        continue;
      }

      let finalObservationContent: any[] = [];

      if (action.action === "batch") {
        this.log("info", `バッチ実行: ${action.params.actions.length}個のアクション`);
        for (const subAction of action.params.actions) {
          const { observationContent } = await this.executeAction(subAction);
          finalObservationContent.push(...observationContent);
          await new Promise((r) => setTimeout(r, 500));
        }
      } else {
        const { observationContent } = await this.executeAction(action as ActionBase);
        finalObservationContent.push(...observationContent);
      }

      history.push({ role: "assistant", content: JSON.stringify(action) });
      history.push({ role: "user", content: finalObservationContent });

      this.currentStep++;
      await new Promise((r) => setTimeout(r, 1000));
    }

    this.emit("runCompleted");
  }
}
