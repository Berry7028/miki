import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as fs from "node:fs";
import * as readline from "node:readline";
import { EventEmitter } from "node:events";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ActionSchema, type Action, type ActionBase, type PythonResponse } from "./types";
import * as path from "node:path";

export class MacOSAgent extends EventEmitter {
  private pythonProcess!: ChildProcessWithoutNullStreams;
  private pythonReader!: readline.Interface;
  private genAI: GoogleGenerativeAI;
  private model: any;
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
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
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
    this.emit("reset");
  }

  public stop() {
    this.stopRequested = true;
    this.log("info", "停止要求を受け付けました。");
  }

  public destroy() {
    this.pythonProcess.kill();
    this.pythonReader.close();
    this.removeAllListeners();
  }

  private async getActionFromLLM(
    history: any[],
    screenshotBase64: string,
    mousePosition: { x: number; y: number },
  ): Promise<Action> {
    const normX = Math.round((mousePosition.x / (this.screenSize.width || 1)) * 1000);
    const normY = Math.round((mousePosition.y / (this.screenSize.height || 1)) * 1000);

    const systemPrompt = `あなたはMacOS自動化エージェントです。あなたの目標は、コンピュータを操作してユーザーを助けることです。
現在の画面のスクリーンショットと、これまでに行ったアクションの履歴を受け取ります。
あなたの回答は、必ず指定されたJSON形式に従ってください。

### 重要: Google検索の活用
あなたはGoogle検索ツールにアクセスできます。操作手順が不明な場合、アプリケーションの使い方を知りたい場合、エラーの解決方法を探したい場合など、実行前に「どうすればいいか」を確認するために、自律的にGoogle検索を行って情報を収集してください。
検索結果に基づき、より正確で効率的なアクションを選択してください。

### 重要: OSAスクリプトの自律的な活用
あなたはAppleScript (OSA)を自由に実行できます。以下のような場合、独自のOSAスクリプトを考えて実行してください：
- アプリケーションの起動・終了が必要な場合
- ウィンドウのサイズ・位置を変更したい場合
- ファイルシステム操作が必要な場合
- 既存のアクション（click, type等）では実現困難な複雑な操作
- システム通知やダイアログを表示したい場合
最初にアプリケーションが起動しているか確認して、対象のアプリケーションが起動していなかったら起動するようなOSAスクリプトを実行してください。


### 重要ルール:
1. 回答は必ず {"action": "...", "params": {...}} の形式のJSONにしてください。
2. "action" フィールドには、以下のいずれかの値を正確に指定してください: "click", "type", "press", "hotkey", "move", "scroll", "drag", "osa", "elements", "wait", "search", "done", "batch"。
3. 余計な解説や、JSON以外のテキストを含めないでください。
4. **検索について**: あなたは思考プロセスの中でGoogle検索を自由に行えます。明示的な "search" アクションは、検索結果をユーザーに報告したり、特定のクエリで再度情報を集めたい場合に使用してください。

### 効率化（バッチ実行）:
- 関連する一連の操作（例: 検索バーをクリックして、テキストを入力し、エンターキーを押す）を行う場合は、\`batch\` アクションを使用して一括で実行してください。
- これにより、1ステップずつ確認を待つ必要がなくなり、実行速度が向上し、トークン消費も抑えられます。
- 例: {"action": "batch", "params": {"actions": [{"action": "click", "params": {"x": 500, "y": 20}}, {"action": "type", "params": {"text": "hello"}}, {"action": "press", "params": {"key": "enter"}}]}}

### UI要素ベースの操作（最優先・最も堅牢）:
- **新機能**: \`elementsJson\` アクションでUI要素の詳細情報（role, name, position, actions等）をJSON形式で取得できます。
- **推奨フロー**:
  1. 新しいアプリを開いたら、まず \`elementsJson\` でUI構造を把握
  2. 取得した要素のroleとnameを使って \`clickElement\` や \`typeToElement\` で操作
  3. 要素ベースの操作が失敗したら、座標ベース（\`click\`）にフォールバック

### UI要素の取得（従来版も利用可能）:
- **確実に操作するために**: 新しいアプリを開いた直後や、操作対象の正確な位置が不明な場合は、まず \`elements\` または \`elementsJson\` アクションを使用してGUI要素一覧を取得してください。
- \`elements\` で取得できる \`役割|名前|座標|サイズ\` の情報は、スクリーンショットのみに頼るよりも遥かに正確です。
- 取得した座標（絶対座標）を正規化座標（0-1000）に変換して使用することで、誤クリックを劇的に減らすことができます。
- アプリケーション（Cometブラウザ等）の操作を開始する際は、まず \`elements\` または \`elementsJson\` を実行することを強く推奨します。

### 正規化座標系:
- XとYの両方で0から1000までの座標を使用してください。
- (0, 0)が画面の最も左上です。
- 実際の画面解像度: ${this.screenSize.width}x${this.screenSize.height}。

### 自己認識と精度:
- あなたは現在のマウスカーソルの位置を把握しています。
- **入力のヒント**: \`type\` アクションを実行する前に、必ず入力対象（テキストボックス等）を \`click\` してフォーカスを当ててください。
- **効率的な移動と操作と決断**: 必要に応じて\`move\`を挟んでも良いですが、あまり何度も\`move\`を繰り返し過ぎないようにしてください。あなたはやや優柔不断な傾向がありますが、決めるべきときは迷わず\`click\`や\`type\`などのアクションを速やかに実行してください。優柔のは中にも決断力を強化して動作してください。
- **慎重な操作**: ターゲットが非常に小さい場合や、要素が密集していて誤クリックのリスクがある場合のみ、\`move\` で位置を合わせてから確認するステップを踏んでください。
- アプリケーションを起動するときは、OSAスクリプトを使用してください。使用するブラウザは、Cometを使用します。

command+lは使用しないでください。

### 利用可能なアクションの詳細:

**基本操作（座標ベース）**:
- { "action": "click", "params": { "x": number, "y": number } }
- { "action": "type", "params": { "text": string } }
- { "action": "press", "params": { "key": string } }
- { "action": "hotkey", "params": { "keys": ["command", "c"] } }
- { "action": "move", "params": { "x": number, "y": number } }
- { "action": "scroll", "params": { "amount": number } }
- { "action": "drag", "params": { "from_x": number, "from_y": number, "to_x": number, "to_y": number } }
  → ドラッグアンドドロップを実行（from座標からto座標へドラッグ）
  → ファイルの移動、ウィンドウのリサイズ、範囲選択などに使用
  → 座標は正規化座標系（0-1000）を使用してください

**UI要素ベースの操作（推奨）**:
- { "action": "elementsJson", "params": { "app_name": "Comet", "max_depth": 3 } }
  → UI要素ツリーをJSON形式で取得（最大3階層）
- { "action": "clickElement", "params": { "app_name": "Comet", "role": "AXButton", "name": "検索" } }
  → roleとnameで要素を特定してクリック（座標ではなく意味ベースで操作）
- { "action": "typeToElement", "params": { "app_name": "Comet", "role": "AXTextField", "name": "検索フィールド", "text": "猫" } }
  → テキストフィールドにフォーカスして入力
- { "action": "focusElement", "params": { "app_name": "Comet", "role": "AXTextField", "name": "検索フィールド" } }
  → 要素にフォーカスを当てる

**ブラウザ操作の特別対応**:
- { "action": "webElements", "params": { "app_name": "Comet" } }
  → ブラウザのページ内要素（リンク、ボタン、フォーム等）を取得
- { "action": "clickWebElement", "params": { "app_name": "Comet", "role": "AXLink", "name": "ログイン" } }
  → ページ内のリンクやボタンをクリック

**OSAスクリプト実行（自律的なスクリプト生成を推奨）**:
- { "action": "osa", "params": { "script": string } }
  → AppleScript (OSA)を自由に実行できます
  → **重要**: あなたは状況に応じて独自のOSAスクリプトを考えて実行してください
  → 主な用途:
    * アプリケーションの起動・終了:
      'tell application "Safari" to activate'
      'tell application "Safari" to quit'
    * ウィンドウ操作:
      'tell application "System Events" to tell process "Safari" to set position of window 1 to {0, 0}'
      'tell application "System Events" to tell process "Safari" to set size of window 1 to {1200, 800}'
    * ファイル・フォルダ操作:
      'do shell script "mkdir -p ~/Documents/test"'
      'do shell script "open ~/Downloads"'
    * システム通知:
      'display notification "完了しました" with title "タスク完了"'
    * ダイアログ表示:
      'display dialog "確認してください" buttons {"OK"} default button 1'
    * 複雑なUI操作の補完（GUI Scripting）:
      'tell application "System Events" to tell process "Safari" to click button "閉じる" of window 1'
    * 複数アプリの連携操作
  → 既存のアクションで実現困難な操作や、複雑な条件分岐が必要な場合は、OSAスクリプトを自作して実行してください
  → スクリプトエラーが発生した場合、エラーメッセージを確認して修正版を再実行できます
  → JXA (JavaScript for Automation) も使用可能（高度な操作に有効）

**その他**:
- { "action": "elements", "params": { "app_name": string } }
- { "action": "wait", "params": { "seconds": number } }
- { "action": "search", "params": { "query": string } }
- { "action": "done", "params": { "message": string } }

### ハイブリッド戦略:
- UI要素が取得できる場合 → 要素ベースの操作を優先（レイアウト変化に強い）
- UI要素が取得できない/操作が失敗する場合 → 座標ベースの操作にフォールバック
- 例: \`clickElement\` が "ERROR: Element not found" を返したら、\`click\` で座標クリックを試す

小さく正確な、かつ効率的なステップに集中してください。`;

    let retryCount = 0;
    const maxRetries = 3;
    let errorMessage = "";

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

      const resultStream = await this.model.generateContentStream([
        { text: systemPrompt },
        ...geminiHistory.flatMap((h: any) => h.parts),
        { text: promptText },
        {
          inlineData: {
            data: screenshotBase64,
            mimeType: "image/png",
          },
        },
      ]);

      let fullContent = "";
      let thoughtProcess = "";
      const thoughtId = `thought-${this.currentStep}-${retryCount}`;

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
        const parsed = JSON.parse(content);
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
