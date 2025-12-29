import { z } from "zod";

// アクションの定義（Geminiの構造化出力に使用）
export const ActionSchemaBase = z.discriminatedUnion("action", [
  z.object({ action: z.literal("screenshot") }),
  z.object({ action: z.literal("click"), params: z.object({ x: z.number(), y: z.number() }) }),
  z.object({ action: z.literal("type"), params: z.object({ text: z.string() }) }),
  z.object({ action: z.literal("press"), params: z.object({ key: z.string() }) }),
  z.object({ action: z.literal("hotkey"), params: z.object({ keys: z.array(z.string()) }) }),
  z.object({ action: z.literal("move"), params: z.object({ x: z.number(), y: z.number() }) }),
  z.object({ action: z.literal("scroll"), params: z.object({ amount: z.number() }) }),
  z.object({ action: z.literal("osa"), params: z.object({ script: z.string() }) }),
  z.object({ action: z.literal("elements"), params: z.object({ app_name: z.string() }) }),
  z.object({ action: z.literal("wait"), params: z.object({ seconds: z.number() }) }),
  z.object({ action: z.literal("search"), params: z.object({ query: z.string() }) }),
  z.object({ action: z.literal("done"), params: z.object({ message: z.string() }) }),
]);

export type ActionBase = z.infer<typeof ActionSchemaBase>;

export const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("screenshot") }),
  z.object({ action: z.literal("click"), params: z.object({ x: z.number(), y: z.number() }) }),
  z.object({ action: z.literal("type"), params: z.object({ text: z.string() }) }),
  z.object({ action: z.literal("press"), params: z.object({ key: z.string() }) }),
  z.object({ action: z.literal("hotkey"), params: z.object({ keys: z.array(z.string()) }) }),
  z.object({ action: z.literal("move"), params: z.object({ x: z.number(), y: z.number() }) }),
  z.object({ action: z.literal("scroll"), params: z.object({ amount: z.number() }) }),
  z.object({ action: z.literal("osa"), params: z.object({ script: z.string() }) }),
  z.object({ action: z.literal("elements"), params: z.object({ app_name: z.string() }) }),
  z.object({ action: z.literal("wait"), params: z.object({ seconds: z.number() }) }),
  z.object({ action: z.literal("search"), params: z.object({ query: z.string() }) }),
  z.object({ action: z.literal("done"), params: z.object({ message: z.string() }) }),
  z.object({ action: z.literal("batch"), params: z.object({ actions: z.array(ActionSchemaBase) }) }),
]);

export type Action = z.infer<typeof ActionSchema>;

export interface PythonResponse {
  status: string;
  data?: string;
  width?: number;
  height?: number;
  mouse_position?: { x: number; y: number };
  elements?: string[];
  message?: string;
  execution_time_ms?: number;
}

