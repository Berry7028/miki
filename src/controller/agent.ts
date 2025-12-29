import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as readline from "node:readline";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ActionSchema, type Action, type ActionBase, type PythonResponse } from "./types";
import * as path from "node:path";

export class MacOSAgent {
  private pythonProcess: ChildProcessWithoutNullStreams;
  private pythonReader: readline.Interface;
  private genAI: GoogleGenerativeAI;
  private model: any;
  private screenSize: { width: number; height: number } = { width: 0, height: 0 };
  private pendingResolvers: ((value: any) => void)[] = [];

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    // Pythonプロセスの起動 (プロジェクトルートにあるvenvとsrc/executor/main.pyを使用)
    const pythonPath = path.join(process.cwd(), "venv", "bin", "python");
    const executorPath = path.join(process.cwd(), "src", "executor", "main.py");
    
    this.pythonProcess = spawn(pythonPath, [executorPath]);
    
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
          console.error("Failed to parse Python output:", line);
        }
      }
    });

    this.pythonProcess.stderr.on("data", (data) => {
      console.error(`Python Error: ${data}`);
    });
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
    console.log(`Screen Size: ${this.screenSize.width}x${this.screenSize.height}`);
  }

  private async getActionFromLLM(history: any[], screenshotBase64: string, mousePosition: { x: number, y: number }): Promise<Action> {
    const normX = Math.round((mousePosition.x / (this.screenSize.width || 1)) * 1000);
    const normY = Math.round((mousePosition.y / (this.screenSize.height || 1)) * 1000);

    const systemPrompt = `あなたはMacOS自動化エージェントです。あなたの目標は、コンピュータを操作してユーザーを助けることです。
現在の画面のスクリーンショットと、これまでに行ったアクションの履歴を受け取ります。
あなたの回答は、必ず指定されたJSON形式に従ってください。

最初にアプリケーションが起動しているか確認して、対象のアプリケーションが起動しなかったら起動するようなOSAスクリプトを実行します。


### 重要ルール:
1. 回答は必ず {"action": "...", "params": {...}} の形式のJSONにしてください。
2. "action" フィールドには、以下のいずれかの値を正確に指定してください: "click", "type", "press", "hotkey", "move", "scroll", "osa", "elements", "wait", "done", "batch"。
3. 余計な解説や、JSON以外のテキストを含めないでください。

### 効率化（バッチ実行）:
- 関連する一連の操作（例: 検索バーをクリックして、テキストを入力し、エンターキーを押す）を行う場合は、\`batch\` アクションを使用して一括で実行してください。
- これにより、1ステップずつ確認を待つ必要がなくなり、実行速度が向上し、トークン消費も抑えられます。
- 例: {"action": "batch", "params": {"actions": [{"action": "click", "params": {"x": 500, "y": 20}}, {"action": "type", "params": {"text": "hello"}}, {"action": "press", "params": {"key": "enter"}}]}}

### UI要素の取得（最優先推奨）:
- **確実に操作するために**: 新しいアプリを開いた直後や、操作対象の正確な位置が不明な場合は、まず \`elements\` アクションを使用してGUI要素一覧を取得してください。
- \`elements\` で取得できる \`役割|名前|座標|サイズ\` の情報は、スクリーンショットのみに頼るよりも遥かに正確です。
- 取得した座標（絶対座標）を正規化座標（0-1000）に変換して使用することで、誤クリックを劇的に減らすことができます。
- アプリケーション（Cometブラウザ等）の操作を開始する際は、まず \`elements\` を実行することを強く推奨します。

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

### 利用可能なアクションの詳細:
- { "action": "click", "params": { "x": number, "y": number } }
- { "action": "type", "params": { "text": string } }
- { "action": "press", "params": { "key": string } }
- { "action": "hotkey", "params": { "keys": ["command", "c"] } }
- { "action": "move", "params": { "x": number, "y": number } }
- { "action": "scroll", "params": { "amount": number } }
- { "action": "osa", "params": { "script": string } }
- { "action": "elements", "params": { "app_name": string } }
- { "action": "wait", "params": { "seconds": number } }
- { "action": "done", "params": { "message": string } }

小さく正確な、かつ効率的なステップに集中してください。`;

    const geminiHistory = history.map(h => {
      if (typeof h.content === 'string') {
        return { role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] };
      } else if (Array.isArray(h.content)) {
        const parts = h.content.map((c: any) => {
          if (c.type === 'text') return { text: c.text };
          if (c.type === 'image_url') {
            const base64Data = c.image_url.url.split(',')[1];
            return { inlineData: { data: base64Data, mimeType: "image/png" } };
          }
          return { text: "" };
        });
        return { role: h.role === 'assistant' ? 'model' : 'user', parts };
      }
      return { role: 'user', parts: [{ text: "" }] };
    });

    const result = await this.model.generateContent([
      { text: systemPrompt },
      ...geminiHistory.flatMap(h => h.parts),
      { text: `現在のマウスカーソル位置: (${normX}, ${normY}) [正規化座標]。
目標を達成するための次のアクションは何ですか？スクリーンショットで位置を確認してください。` },
      {
        inlineData: {
          data: screenshotBase64,
          mimeType: "image/png"
        }
      }
    ]);

    let content = result.response.text();
    
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      content = jsonMatch[1].trim();
    } else {
      content = content.trim();
    }

    try {
      return ActionSchema.parse(JSON.parse(content));
    } catch (e) {
      console.error("Gemini Response parsing failed!");
      console.error("Raw content:", content);
      throw e;
    }
  }

  private async executeAction(action: ActionBase): Promise<{ result: PythonResponse, observationContent: any[] }> {
    let execParams = { ... (action as any).params };
    let highlightPos: { x: number, y: number } | null = null;

    if (execParams.x !== undefined && execParams.y !== undefined) {
      execParams.x = Math.round((execParams.x / 1000) * this.screenSize.width);
      execParams.y = Math.round((execParams.y / 1000) * this.screenSize.height);
      
      if (action.action === "click" || action.action === "move") {
        highlightPos = { x: execParams.x, y: execParams.y };
      }
    }

    const result = await this.callPython(action.action, execParams);
    if (result.execution_time_ms !== undefined) {
      console.log(`  Action ${action.action}: ${result.execution_time_ms}ms`);
    }
    
    let observationContent: any[] = [{ type: "text", text: `Action ${action.action} performed. Result: ${JSON.stringify(result)}` }];
    
    if (highlightPos) {
      const hRes = await this.callPython("screenshot", { highlight_pos: highlightPos });
      if (hRes.status === "success" && hRes.data) {
        observationContent.push({
          type: "image_url",
          image_url: { url: `data:image/png;base64,${hRes.data}` },
        });
        observationContent.push({ type: "text", text: "The red dot in the screenshot above shows where the action was performed." });
      }
    }

    return { result, observationContent };
  }

  async run(goal: string) {
    console.log(`Goal: ${goal}`);
    
    const initRes = await this.callPython("screenshot");
    if (initRes.status !== "success" || !initRes.data || !initRes.mouse_position) {
      console.error("Initial observation failed:", initRes.message);
      return;
    }

    const history: any[] = [
      { role: "user", content: `私の目標は次の通りです: ${goal}` },
      {
        role: "user",
        content: [
          { type: "text", text: "これが現在のデスクトップの初期状態です。この画面から操作を開始してください。" },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${initRes.data}` },
          },
        ],
      }
    ];
    let step = 0;

    while (step < 20) {
      console.log(`\n--- Step ${step + 1} ---`);
      
      const res = await this.callPython("screenshot");
      if (res.status !== "success" || !res.data || !res.mouse_position) {
        console.error("Failed to take screenshot or get mouse position:", res.message);
        break;
      }
      const screenshot = res.data;
      const mousePosition = res.mouse_position;
      
      const action = await this.getActionFromLLM(history, screenshot, mousePosition);
      console.log(`Action: ${JSON.stringify(action)}`);

      if (action.action === "done") {
        console.log(`Success: ${action.params.message}`);
        break;
      }

      if (action.action === "wait") {
        await new Promise((r) => setTimeout(r, action.params.seconds * 1000));
        history.push({ role: "assistant", content: `I waited for ${action.params.seconds} seconds.` });
        step++;
        continue;
      }

      let finalObservationContent: any[] = [];
      
      if (action.action === "batch") {
        console.log(`Executing batch of ${action.params.actions.length} actions...`);
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

      step++;
      await new Promise((r) => setTimeout(r, 1000));
    }

    this.pythonProcess.kill();
  }
}

