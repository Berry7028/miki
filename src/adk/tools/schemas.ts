// Gemini API 直接のスキーマ形式で定義することで、ADK内部の変換エラーを回避します。
export const ClickSchema = {
  type: "object",
  properties: {
    x: { type: "number", description: "正規化X座標 (0-1000)" },
    y: { type: "number", description: "正規化Y座標 (0-1000)" },
  },
  required: ["x", "y"],
};

export const MoveSchema = {
  type: "object",
  properties: {
    x: { type: "number", description: "正規化X座標 (0-1000)" },
    y: { type: "number", description: "正規化Y座標 (0-1000)" },
  },
  required: ["x", "y"],
};

export const DragSchema = {
  type: "object",
  properties: {
    from_x: { type: "number", description: "開始X" },
    from_y: { type: "number", description: "開始Y" },
    to_x: { type: "number", description: "終了X" },
    to_y: { type: "number", description: "終了Y" },
  },
  required: ["from_x", "from_y", "to_x", "to_y"],
};

export const ScrollSchema = {
  type: "object",
  properties: {
    amount: { type: "number", description: "スクロール量 (正:下, 負:上)" },
  },
  required: ["amount"],
};

export const TypeSchema = {
  type: "object",
  properties: {
    text: { type: "string", description: "入力テキスト" },
  },
  required: ["text"],
};

export const PressSchema = {
  type: "object",
  properties: {
    key: { type: "string", description: "キー名" },
  },
  required: ["key"],
};

export const HotkeySchema = {
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

export const ElementsJsonSchema = {
  type: "object",
  properties: {
    app_name: { type: "string", description: "アプリ名" },
    max_depth: { type: "number", description: "探索深さ" },
  },
  required: ["app_name", "max_depth"],
};

export const FocusElementSchema = {
  type: "object",
  properties: {
    app_name: { type: "string" },
    role: { type: "string" },
    name: { type: "string" },
  },
  required: ["app_name", "role", "name"],
};

export const WebElementsSchema = {
  type: "object",
  properties: {
    app_name: { type: "string" },
  },
  required: ["app_name"],
};

export const OsaSchema = {
  type: "object",
  properties: {
    script: { type: "string", description: "AppleScript内容" },
  },
  required: ["script"],
};

export const WaitSchema = {
  type: "object",
  properties: {
    seconds: { type: "number" },
  },
  required: ["seconds"],
};

export const SearchSchema = {
  type: "object",
  properties: {
    query: { type: "string" },
  },
  required: ["query"],
};

export const ThinkSchema = {
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

export const DoneSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
  required: ["message"],
};

export const ScreenshotSchema = {
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
  required: ["quality", "highlight_pos"],
};
