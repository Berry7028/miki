import type { FunctionDeclaration } from "@google/generative-ai";
import { SchemaType } from "@google/generative-ai";

export const ACTION_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "click",
    description: "指定した正規化座標(0-1000)を単一の左クリックで操作します（本システムは0-1000で正規化）。クリック先のUIを確実にアクティブ化する際に使用します。",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        x: { type: SchemaType.NUMBER, description: "正規化X座標。左端が0、右端が1000。" },
        y: { type: SchemaType.NUMBER, description: "正規化Y座標。上端が0、下端が1000。" },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "move",
    description: "マウスカーソルを指定した正規化座標(0-1000)へ移動します。クリック不要なホバー操作に使用します。",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        x: { type: SchemaType.NUMBER, description: "正規化X座標。左端が0、右端が1000。" },
        y: { type: SchemaType.NUMBER, description: "正規化Y座標。上端が0、下端が1000。" },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "drag",
    description: "from座標からto座標へドラッグ&ドロップします。いずれも正規化座標(0-1000)。",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        from_x: { type: SchemaType.NUMBER, description: "ドラッグ開始位置の正規化X座標" },
        from_y: { type: SchemaType.NUMBER, description: "ドラッグ開始位置の正規化Y座標" },
        to_x: { type: SchemaType.NUMBER, description: "ドロップ位置の正規化X座標" },
        to_y: { type: SchemaType.NUMBER, description: "ドロップ位置の正規化Y座標" },
      },
      required: ["from_x", "from_y", "to_x", "to_y"],
    },
  },
  {
    name: "scroll",
    description: "垂直方向にスクロールします。正の値で下方向、負の値で上方向。",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        amount: { type: SchemaType.NUMBER, description: "スクロール量。例: 200で下方向、-200で上方向。" },
      },
      required: ["amount"],
    },
  },
  {
    name: "type",
    description: "フォーカス中の入力欄にテキストを入力します。事前にclick等でフォーカスを与えてください。",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        text: { type: SchemaType.STRING, description: "入力するテキスト" },
      },
      required: ["text"],
    },
  },
  {
    name: "press",
    description: "EnterやEscなどの単一キーを送信します。",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        key: { type: SchemaType.STRING, description: "送信するキー名 (例: enter, esc)" },
      },
      required: ["key"],
    },
  },
  {
    name: "hotkey",
    description: "修飾キーを含む複数キーの同時押下を送信します。",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        keys: {
          type: SchemaType.ARRAY,
          description: "送信するキーの並び。例: [\"command\", \"t\"]",
          items: { type: SchemaType.STRING },
        },
      },
      required: ["keys"],
    },
  },
  {
    name: "elementsJson",
    description: "macOSのアクセシビリティツリーを取得します。未知の画面では最初に実行してください。",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        app_name: { type: SchemaType.STRING, description: "対象アプリ名。メニューバーに表示される名前を指定。" },
        max_depth: {
          type: SchemaType.NUMBER,
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
      type: SchemaType.OBJECT,
      properties: {
        app_name: { type: SchemaType.STRING, description: "対象アプリ名" },
        role: { type: SchemaType.STRING, description: "アクセシビリティロール (例: AXButton, AXTextField)" },
        name: { type: SchemaType.STRING, description: "要素の表示名" },
      },
      required: ["app_name", "role", "name"],
    },
  },
  {
    name: "typeToElement",
    description: "指定した要素に直接テキストを入力します。フォーカスが不安定な場合に使用します。",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        app_name: { type: SchemaType.STRING, description: "対象アプリ名" },
        role: { type: SchemaType.STRING, description: "アクセシビリティロール (例: AXTextField)" },
        name: { type: SchemaType.STRING, description: "要素の表示名" },
        text: { type: SchemaType.STRING, description: "入力するテキスト" },
      },
      required: ["app_name", "role", "name", "text"],
    },
  },
  {
    name: "focusElement",
    description: "要素をフォーカスします。クリックや入力前の安定化に使用します。",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        app_name: { type: SchemaType.STRING, description: "対象アプリ名" },
        role: { type: SchemaType.STRING, description: "アクセシビリティロール" },
        name: { type: SchemaType.STRING, description: "要素の表示名" },
      },
      required: ["app_name", "role", "name"],
    },
  },
  {
    name: "webElements",
    description: "Cometブラウザ内のDOM要素一覧を取得します。Web操作時に使用します。",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        app_name: { type: SchemaType.STRING, description: "対象ブラウザアプリ名 (通常は \"Comet\")" },
      },
      required: ["app_name"],
    },
  },
  {
    name: "clickWebElement",
    description: "Cometブラウザ内のDOM要素をロールと名前でクリックします。",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        app_name: { type: SchemaType.STRING, description: "対象ブラウザアプリ名 (通常は \"Comet\")" },
        role: { type: SchemaType.STRING, description: "DOMロール (例: button, link)" },
        name: { type: SchemaType.STRING, description: "要素のラベルまたはテキスト" },
      },
      required: ["app_name", "role", "name"],
    },
  },
  {
    name: "osa",
    description: "任意のAppleScriptを実行します。アプリ起動やウィンドウ操作に使用。",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        script: { type: SchemaType.STRING, description: "実行するAppleScript" },
      },
      required: ["script"],
    },
  },
  {
    name: "batch",
    description: "複数のアクションを順番に実行します。各要素は他の関数ツールと同じ引数構造を持つ必要があり、コントローラー側でスキーマ検証されます。",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        actions: {
          type: SchemaType.ARRAY,
          description: "実行するアクションの配列。各要素は他の関数ツールと同じ引数構造に従います。",
          items: {
            type: SchemaType.OBJECT,
            description: "個々のアクション。action名とparamsを含みます。",
            properties: {
              action: { type: SchemaType.STRING, description: "実行する関数ツール名" },
              params: {
                type: SchemaType.OBJECT,
                description: "各ツールに対応する引数オブジェクト",
                properties: {},
              },
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
      type: SchemaType.OBJECT,
      properties: {
        seconds: { type: SchemaType.NUMBER, description: "待機する秒数" },
      },
      required: ["seconds"],
    },
  },
  {
    name: "search",
    description: "Google検索などの外部検索を指示します。結果は内部知識として利用してください。",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "検索クエリ" },
      },
      required: ["query"],
    },
  },
  {
    name: "done",
    description: "すべてのタスクが完了したことを報告します。次の操作は不要な場合に使用します。",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        message: { type: SchemaType.STRING, description: "完了メッセージ。何を達成したか簡潔に記載。" },
      },
      required: ["message"],
    },
  },
];
