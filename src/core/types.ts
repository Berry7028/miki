import { z } from "zod";

export interface UIElement {
  role: string;
  roleDescription: string;
  name: string;
  description: string;
  value: any;
  position: [number, number];
  size: [number, number];
  enabled: boolean;
  focused: boolean;
  selected: boolean;
  actions: string[];
  subrole: string;
  children: UIElement[];
}

export interface UIElementsResponse {
  windows: UIElement[];
}

export const ActionSchemaBase = z.discriminatedUnion("action", [
  z.object({ action: z.literal("screenshot") }),
  z.object({ action: z.literal("click"), params: z.object({ x: z.number(), y: z.number() }) }),
  z.object({ action: z.literal("type"), params: z.object({ text: z.string() }) }),
  z.object({ action: z.literal("press"), params: z.object({ key: z.string() }) }),
  z.object({ action: z.literal("hotkey"), params: z.object({ keys: z.array(z.string()) }) }),
  z.object({ action: z.literal("move"), params: z.object({ x: z.number(), y: z.number() }) }),
  z.object({ action: z.literal("scroll"), params: z.object({ amount: z.number() }) }),
  z.object({
    action: z.literal("drag"),
    params: z.object({
      from_x: z.number(),
      from_y: z.number(),
      to_x: z.number(),
      to_y: z.number(),
    }),
  }),
  z.object({ action: z.literal("osa"), params: z.object({ script: z.string() }) }),
  z.object({ action: z.literal("elements"), params: z.object({ app_name: z.string() }) }),
  z.object({
    action: z.literal("elementsJson"),
    params: z.object({ app_name: z.string(), max_depth: z.number().optional().default(3) }),
  }),
  z.object({
    action: z.literal("focusElement"),
    params: z.object({ app_name: z.string(), role: z.string(), name: z.string() }),
  }),
  z.object({ action: z.literal("webElements"), params: z.object({ app_name: z.string() }) }),
  z.object({ action: z.literal("wait"), params: z.object({ seconds: z.number() }) }),
  z.object({ action: z.literal("search"), params: z.object({ query: z.string() }) }),
  z.object({
    action: z.literal("think"),
    params: z.object({
      thought: z.string(),
      phase: z.enum(["planning", "executing", "verification", "reflection"]),
    }),
  }),
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
  z.object({
    action: z.literal("drag"),
    params: z.object({
      from_x: z.number(),
      from_y: z.number(),
      to_x: z.number(),
      to_y: z.number(),
    }),
  }),
  z.object({ action: z.literal("osa"), params: z.object({ script: z.string() }) }),
  z.object({ action: z.literal("elements"), params: z.object({ app_name: z.string() }) }),
  z.object({
    action: z.literal("elementsJson"),
    params: z.object({ app_name: z.string(), max_depth: z.number().optional().default(3) }),
  }),
  z.object({
    action: z.literal("focusElement"),
    params: z.object({ app_name: z.string(), role: z.string(), name: z.string() }),
  }),
  z.object({ action: z.literal("webElements"), params: z.object({ app_name: z.string() }) }),
  z.object({ action: z.literal("wait"), params: z.object({ seconds: z.number() }) }),
  z.object({ action: z.literal("search"), params: z.object({ query: z.string() }) }),
  z.object({
    action: z.literal("think"),
    params: z.object({
      thought: z.string(),
      phase: z.enum(["planning", "executing", "verification", "reflection"]),
    }),
  }),
  z.object({ action: z.literal("done"), params: z.object({ message: z.string() }) }),
  z.object({
    action: z.literal("batch"),
    params: z.object({ actions: z.array(ActionSchemaBase) }),
  }),
]);

export type Action = z.infer<typeof ActionSchema>;

export interface PythonResponse {
  status: string;
  data?: string;
  browser?: string;
  bundle_id?: string;
  width?: number;
  height?: number;
  mouse_position?: { x: number; y: number };
  elements?: string[];
  ui_data?: UIElementsResponse;
  message?: string;
  execution_time_ms?: number;
}

export interface CacheMetadata {
  cacheName: string;
  createdAt: string;
  expiresAt: string;
  tokenCount: number;
}

export interface CacheManager {
  systemPromptCache: CacheMetadata | null;
  uiElementsCaches: Map<string, CacheMetadata>;
}
