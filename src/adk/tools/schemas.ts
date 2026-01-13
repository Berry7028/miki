// Gemini API 直接のスキーマ形式で定義することで、ADK内部の変換エラーを回避します。

/**
 * JSON Schema 型定義
 * @see https://json-schema.org/
 */
interface JSONSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

interface JSONSchemaDefinition {
  type: string;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

// ============================================================================
// スキーマ定義 (JSON Schema 形式)
// ============================================================================

export const ClickSchema: JSONSchemaDefinition = {
  type: "object",
  properties: {
    x: { type: "number", description: "正規化X座標 (0-1000)" },
    y: { type: "number", description: "正規化Y座標 (0-1000)" },
  },
  required: ["x", "y"],
};

export const MoveSchema: JSONSchemaDefinition = {
  type: "object",
  properties: {
    x: { type: "number", description: "正規化X座標 (0-1000)" },
    y: { type: "number", description: "正規化Y座標 (0-1000)" },
  },
  required: ["x", "y"],
};

export const DragSchema: JSONSchemaDefinition = {
  type: "object",
  properties: {
    from_x: { type: "number", description: "開始X" },
    from_y: { type: "number", description: "開始Y" },
    to_x: { type: "number", description: "終了X" },
    to_y: { type: "number", description: "終了Y" },
  },
  required: ["from_x", "from_y", "to_x", "to_y"],
};

export const ScrollSchema: JSONSchemaDefinition = {
  type: "object",
  properties: {
    amount: { type: "number", description: "スクロール量 (正:下, 負:上)" },
  },
  required: ["amount"],
};

export const TypeSchema: JSONSchemaDefinition = {
  type: "object",
  properties: {
    text: { type: "string", description: "入力テキスト" },
  },
  required: ["text"],
};

export const PressSchema: JSONSchemaDefinition = {
  type: "object",
  properties: {
    key: { type: "string", description: "キー名" },
  },
  required: ["key"],
};

export const HotkeySchema: JSONSchemaDefinition = {
  type: "object",
  properties: {
    keys: {
      type: "array",
      items: { type: "string" },
      description: "同時押しするキーの配列"
    },
  },
  required: ["keys"],
};

export const ElementsJsonSchema: JSONSchemaDefinition = {
  type: "object",
  properties: {
    app_name: { type: "string", description: "アプリ名" },
    max_depth: { type: "number", description: "探索深さ" },
  },
  required: ["app_name"],
};

export const FocusElementSchema: JSONSchemaDefinition = {
  type: "object",
  properties: {
    app_name: { type: "string" },
    role: { type: "string" },
    name: { type: "string" },
  },
  required: ["app_name", "role", "name"],
};

export const WebElementsSchema: JSONSchemaDefinition = {
  type: "object",
  properties: {
    app_name: { type: "string" },
  },
  required: ["app_name"],
};

export const OsaSchema: JSONSchemaDefinition = {
  type: "object",
  properties: {
    script: { type: "string", description: "AppleScript内容" },
  },
  required: ["script"],
};

export const WaitSchema: JSONSchemaDefinition = {
  type: "object",
  properties: {
    seconds: { type: "number" },
  },
  required: ["seconds"],
};

export const ThinkSchema: JSONSchemaDefinition = {
  type: "object",
  properties: {
    thought: { type: "string" },
    phase: {
      type: "string",
      enum: ["planning", "verification", "reflection"]
    },
  },
  required: ["thought", "phase"],
};

export const DoneSchema: JSONSchemaDefinition = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
  required: ["message"],
};

export const ScreenshotSchema: JSONSchemaDefinition = {
  type: "object",
  properties: {
    quality: { type: "number" },
    highlight_pos: {
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
      },
      required: ["x", "y"],
    },
  },
  required: ["quality"],
};

// ============================================================================
// TypeScript 型定義
// ============================================================================

export interface ClickParams {
  x: number;
  y: number;
}

export interface MoveParams {
  x: number;
  y: number;
}

export interface DragParams {
  from_x: number;
  from_y: number;
  to_x: number;
  to_y: number;
}

export interface ScrollParams {
  amount: number;
}

export interface TypeParams {
  text: string;
}

export interface PressParams {
  key: string;
}

export interface HotkeyParams {
  keys: string[];
}

export interface ElementsJsonParams {
  app_name: string;
  max_depth?: number;
}

export interface FocusElementParams {
  app_name: string;
  role: string;
  name: string;
}

export interface WebElementsParams {
  app_name: string;
}

export interface OsaParams {
  script: string;
}

export interface WaitParams {
  seconds: number;
}

export interface ThinkParams {
  thought: string;
  phase: "planning" | "verification" | "reflection";
}

export interface DoneParams {
  message: string;
}

export interface ScreenshotParams {
  quality: number;
  highlight_pos?: { x: number; y: number };
}

// ============================================================================
// 型ユーティリティ
// ============================================================================

/** スキーマ名からパラメータ型へのマッピング */
export type ToolParams = {
  click: ClickParams;
  move: MoveParams;
  drag: DragParams;
  scroll: ScrollParams;
  type: TypeParams;
  press: PressParams;
  hotkey: HotkeyParams;
  elementsJson: ElementsJsonParams;
  focusElement: FocusElementParams;
  webElements: WebElementsParams;
  osa: OsaParams;
  wait: WaitParams;
  think: ThinkParams;
  done: DoneParams;
  screenshot: ScreenshotParams;
};
