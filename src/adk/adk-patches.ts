import { FunctionTool, BuiltInCodeExecutor, LlmAgent } from "@google/adk";
import { Type } from "@google/genai";

type ZodV4Def = {
  type?: string;
  shape?: Record<string, unknown>;
  element?: unknown;
  entries?: Record<string, unknown>;
  options?: unknown[];
  innerType?: unknown;
  values?: unknown[];
  defaultValue?: () => unknown;
  description?: string;
};

type JsonSchema = {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  anyOf?: JsonSchema[];
  default?: unknown;
};

const originalGetDeclaration = (FunctionTool as any).prototype._getDeclaration;

const getZodV4Def = (schema: any): ZodV4Def | undefined => {
  if (!schema || typeof schema !== "object") return undefined;
  const def = schema._def || schema.def;
  if (def && typeof def.type === "string") return def;
  return undefined;
};

const unwrapOptionalV4 = (schema: any) => {
  let current = schema;
  let optional = false;
  let def = getZodV4Def(current);
  while (def && (def.type === "optional" || def.type === "default")) {
    optional = true;
    current = def.innerType;
    def = getZodV4Def(current);
  }
  return { schema: current, optional };
};

const zodV4ToSchema = (schema: any): JsonSchema => {
  const def = getZodV4Def(schema);
  if (!def) return schema;

  const result: JsonSchema = {};
  if (def.description) {
    result.description = def.description;
  }

  switch (def.type) {
    case "string":
      result.type = "string";
      return result;
    case "number":
      result.type = "number";
      return result;
    case "boolean":
      result.type = "boolean";
      return result;
    case "array":
      result.type = "array";
      if (def.element) {
        result.items = zodV4ToSchema(def.element);
      }
      return result;
    case "object": {
      const shape = def.shape || {};
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        const { schema: unwrapped, optional } = unwrapOptionalV4(value);
        properties[key] = zodV4ToSchema(unwrapped);
        if (!optional) {
          required.push(key);
        }
      }
      return {
        type: "object",
        description: result.description,
        properties,
        required: required.length > 0 ? required : [],
      };
    }
    case "literal": {
      const literalValue = def.values ? def.values[0] : undefined;
      if (literalValue === null) {
        result.type = "null";
      } else if (typeof literalValue === "string") {
        result.type = "string";
      } else if (typeof literalValue === "number") {
        result.type = "number";
      } else if (typeof literalValue === "boolean") {
        result.type = "boolean";
      }
      if (literalValue !== undefined) {
        result.enum = [literalValue];
      }
      return result;
    }
    case "enum": {
      const values = def.entries ? Object.values(def.entries) : def.values || [];
      result.type = "string";
      result.enum = values;
      return result;
    }
    case "union":
      result.anyOf = (def.options || []).map(zodV4ToSchema);
      return result;
    case "optional":
      return zodV4ToSchema(def.innerType);
    case "nullable": {
      const inner = zodV4ToSchema(def.innerType);
      return {
        anyOf: [inner, { type: "null" }],
        description: result.description,
      };
    }
    case "default": {
      const inner = zodV4ToSchema(def.innerType);
      const defaultValue = typeof def.defaultValue === "function" ? def.defaultValue() : undefined;
      return defaultValue === undefined ? inner : { ...inner, default: defaultValue };
    }
    case "null":
      result.type = "null";
      return result;
    case "unknown":
    case "any":
      return result;
    default:
      return result;
  }
};

(FunctionTool as any).prototype._getDeclaration = function patchedGetDeclaration() {
  const declaration = originalGetDeclaration.call(this);
  if (declaration?.parameters && getZodV4Def(declaration.parameters)) {
    declaration.parameters = zodV4ToSchema(declaration.parameters);
  }
  if (declaration?.response && getZodV4Def(declaration.response)) {
    declaration.response = zodV4ToSchema(declaration.response);
  }
  return declaration;
};

// skip error for gemini-3-flash-preview
const originalProcessLlmRequest = (BuiltInCodeExecutor as any).prototype.processLlmRequest;
(BuiltInCodeExecutor as any).prototype.processLlmRequest = function patchedProcessLlmRequest(llmRequest: any) {
  try {
    originalProcessLlmRequest.call(this, llmRequest);
  } catch (e: any) {
    console.error("[ADK PATCH] processLlmRequest error:", e);
    if (e.message && e.message.includes("gemini-3-flash-preview")) {
      return;
    }
    throw e;
  }
};

const originalFindAgent = (LlmAgent as any).prototype.findAgent;
if (originalFindAgent) {
  (LlmAgent as any).prototype.findAgent = function patchedFindAgent(agentName: string): any {
    if (this.name === agentName) {
      return this;
    }
    return originalFindAgent.call(this, agentName);
  };
}

// パッチ: ツール実行結果に含まれるスクリーンショットを画像パーツとして展開する
const originalCallLlmAsync = (LlmAgent as any).prototype.callLlmAsync;
(LlmAgent as any).prototype.callLlmAsync = async function* patchedCallLlmAsync(
  invocationContext: any,
  llmRequest: any,
  modelResponseEvent: any
) {
  if (llmRequest && llmRequest.contents) {
    for (const content of llmRequest.contents) {
      if (content.role === "user" && content.parts) {
        const newParts = [];
        for (const part of content.parts) {
          newParts.push(part);
          if (part.functionResponse && part.functionResponse.response) {
            const response = part.functionResponse.response;
            if (response.screenshot && response.screenshot.inlineData) {
              newParts.push({
                inlineData: response.screenshot.inlineData,
              });
              delete response.screenshot;
            }
          }
        }
        content.parts = newParts;
      }
    }
  }

  try {
    const generator = originalCallLlmAsync.call(
      this,
      invocationContext,
      llmRequest,
      modelResponseEvent
    );

    while (true) {
      const { value: event, done } = await generator.next();
      if (done) break;

      // レスポンスの加工
      if (event && event.content && event.content.parts) {
        // text パーツが空文字のみで、他に functionCall がある場合は除去
        const hasFunctionCall = event.content.parts.some((p: any) => p.functionCall);
        if (hasFunctionCall) {
          event.content.parts = event.content.parts.filter((p: any) => {
            if (p.text !== undefined && p.text.trim() === "") return false;
            return true;
          });
        }

        for (const part of event.content.parts) {
          if (part.functionCall) {
            console.log("[ADK PATCH] Detected functionCall:", part.functionCall.name, part.functionCall.args);
            // args が文字列ならオブジェクトに変換
            if (typeof part.functionCall.args === "string") {
              try {
                part.functionCall.args = JSON.parse(part.functionCall.args);
              } catch (e) {}
            }
            if (!part.functionCall.args) {
              part.functionCall.args = {};
            }
          }
        }
      }
      yield event;
    }
  } catch (e: any) {
    console.error("[ADK PATCH] callLlmAsync error:", e);
    // MALFORMED_FUNCTION_CALL の場合、詳細を出力して、もし可能なら空のレスポンスを返して続行させる
    if (e.code === "MALFORMED_FUNCTION_CALL" || (e.message && e.message.includes("MALFORMED"))) {
      console.error("[ADK PATCH] Malformed function call detected. Attempting to recover...");
      return;
    }
    throw e;
  }
};
