import type { FunctionDeclaration } from "@google/generative-ai";

export const ACTION_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "click",
    description: "指定した正規化座標(0-1000)を単一の左クリックで操作します。クリック先のUIを確実にアクティブ化する際に使用します。",
    parameters: {
      type: "object",
      properties: {
        x: { type: "number", description: "正規化X座標。左端が0、右端が1000。" },
        y: { type: "number", description: "正規化Y座標。上端が0、下端が1000。" },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "move",
    description: "マウスカーソルを指定した正規化座標(0-1000)へ移動します。クリック不要なホバー操作に使用します。",
    parameters: {
      type: "object",
      properties: {
        x: { type: "number", description: "正規化X座標。左端が0、右端が1000。" },
        y: { type: "number", description: "正規化Y座標。上端が0、下端が1000。" },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "drag",
    description: "from座標からto座標へドラッグ&ドロップします。いずれも正規化座標(0-1000)。",
    parameters: {
      type: "object",
      properties: {
        from_x: { type: "number", description: "ドラッグ開始位置の正規化X座標" },
        from_y: { type: "number", description: "ドラッグ開始位置の正規化Y座標" },
        to_x: { type: "number", description: "ドロップ位置の正規化X座標" },
        to_y: { type: "number", description: "ドロップ位置の正規化Y座標" },
      },
      required: ["from_x", "from_y", "to_x", "to_y"],
    },
  },
  {
    name: "scroll",
    description: "垂直方向にスクロールします。正の値で下方向、負の値で上方向。",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number", description: "スクロール量。例: 200で下方向、-200で上方向。" },
      },
      required: ["amount"],
    },
  },
  {
    name: "type",
    description: "フォーカス中の入力欄にテキストを入力します。事前にclick等でフォーカスを与えてください。",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "入力するテキスト" },
      },
      required: ["text"],
    },
  },
  {
    name: "press",
    description: "EnterやEscなどの単一キーを送信します。",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", description: "送信するキー名 (例: enter, esc)" },
      },
      required: ["key"],
    },
  },
  {
    name: "hotkey",
    description: "修飾キーを含む複数キーの同時押下を送信します。",
    parameters: {
      type: "object",
      properties: {
        keys: {
          type: "array",
          description: "送信するキーの並び。例: [\"command\", \"t\"]",
          items: { type: "string" },
        },
      },
      required: ["keys"],
    },
  },
  {
    name: "elementsJson",
    description: "macOSのアクセシビリティツリーを取得します。未知の画面では最初に実行してください。",
    parameters: {
      type: "object",
      properties: {
        app_name: { type: "string", description: "対象アプリ名。メニューバーに表示される名前を指定。" },
        max_depth: {
          type: "number",
          description: "探索の最大深さ (デフォルト3)。深すぎるとレスポンスが大きくなるため注意。",
        },
      },
      required: ["app_name"],
    },
  },
  {
    name: "clickElement",
    description: "アクセシビリティロールと名前で特定したUI要素をクリックします。座標よりも堅牢です。",
    parameters: {
      type: "object",
      properties: {
        app_name: { type: "string", description: "対象アプリ名" },
        role: { type: "string", description: "アクセシビリティロール (例: AXButton, AXTextField)" },
        name: { type: "string", description: "要素の表示名" },
      },
      required: ["app_name", "role", "name"],
    },
  },
  {
    name: "typeToElement",
    description: "指定した要素に直接テキストを入力します。フォーカスが不安定な場合に使用します。",
    parameters: {
      type: "object",
      properties: {
        app_name: { type: "string", description: "対象アプリ名" },
        role: { type: "string", description: "アクセシビリティロール (例: AXTextField)" },
        name: { type: "string", description: "要素の表示名" },
        text: { type: "string", description: "入力するテキスト" },
      },
      required: ["app_name", "role", "name", "text"],
    },
  },
  {
    name: "focusElement",
    description: "要素をフォーカスします。クリックや入力前の安定化に使用します。",
    parameters: {
      type: "object",
      properties: {
        app_name: { type: "string", description: "対象アプリ名" },
        role: { type: "string", description: "アクセシビリティロール" },
        name: { type: "string", description: "要素の表示名" },
      },
      required: ["app_name", "role", "name"],
    },
  },
  {
    name: "webElements",
    description: "Cometブラウザ内のDOM要素一覧を取得します。Web操作時に使用します。",
    parameters: {
      type: "object",
      properties: {
        app_name: { type: "string", description: "対象ブラウザアプリ名 (通常は \"Comet\")" },
      },
      required: ["app_name"],
    },
  },
  {
    name: "clickWebElement",
    description: "Cometブラウザ内のDOM要素をロールと名前でクリックします。",
    parameters: {
      type: "object",
      properties: {
        app_name: { type: "string", description: "対象ブラウザアプリ名 (通常は \"Comet\")" },
        role: { type: "string", description: "DOMロール (例: button, link)" },
        name: { type: "string", description: "要素のラベルまたはテキスト" },
      },
      required: ["app_name", "role", "name"],
    },
  },
  {
    name: "osa",
    description: "任意のAppleScriptを実行します。アプリ起動やウィンドウ操作に使用。",
    parameters: {
      type: "object",
      properties: {
        script: { type: "string", description: "実行するAppleScript" },
      },
      required: ["script"],
    },
  },
  {
    name: "batch",
    description: "複数のアクションを順番に実行します。各要素は他の関数ツールと同じ引数構造を持つ必要があり、コントローラー側でスキーマ検証されます。",
    parameters: {
      type: "object",
      properties: {
        actions: {
          type: "array",
          description: "実行するアクションの配列。各要素は他の関数ツールと同じ引数構造に従います。",
          items: {
            type: "object",
            description: "個々のアクション。action名とparamsを含みます。",
            properties: {
              action: { type: "string", description: "実行する関数ツール名" },
              params: { type: "object", description: "各ツールに対応する引数オブジェクト" },
            },
            required: ["action", "params"],
          },
        },
      },
      required: ["actions"],
    },
  },
  {
    name: "wait",
    description: "指定秒数待機します。UI更新を待つ際に使用します。",
    parameters: {
      type: "object",
      properties: {
        seconds: { type: "number", description: "待機する秒数" },
      },
      required: ["seconds"],
    },
  },
  {
    name: "search",
    description: "Google検索などの外部検索を指示します。結果は内部知識として利用してください。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "検索クエリ" },
      },
      required: ["query"],
    },
  },
  {
    name: "done",
    description: "すべてのタスクが完了したことを報告します。次の操作は不要な場合に使用します。",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "完了メッセージ。何を達成したか簡潔に記載。" },
      },
      required: ["message"],
    },
  },
];
