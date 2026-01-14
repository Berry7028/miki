import { FunctionTool, BuiltInCodeExecutor, LlmAgent } from "@google/adk";
import { Type } from "@google/genai";

// Global debug mode flag
let debugMode = false;

export function setDebugMode(enabled: boolean) {
  debugMode = enabled;
}

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

// Disable BuiltInCodeExecutor patch as per requirements
// The original patch has been commented out

// const originalProcessLlmRequest = (BuiltInCodeExecutor as any).prototype.processLlmRequest;
// (BuiltInCodeExecutor as any).prototype.processLlmRequest = function patchedProcessLlmRequest(llmRequest: any) {
//   try {
//     originalProcessLlmRequest.call(this, llmRequest);
//   } catch (e: any) {
//     console.error("[ADK PATCH] processLlmRequest error:", e);
//     if (e.message && e.message.includes("gemini-3-flash-preview")) {
//       return;
//     }
//     throw e;
//   }
// };

const originalFindAgent = (LlmAgent as any).prototype.findAgent;
if (originalFindAgent) {
  (LlmAgent as any).prototype.findAgent = function patchedFindAgent(agentName: string): any {
    if (this.name === agentName) {
      return this;
    }
    return originalFindAgent.call(this, agentName);
  };
}

// Helper function to validate JSON syntax
function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

// Helper function to extract JSON parse error details
function getJSONParseError(str: string): string {
  try {
    JSON.parse(str);
    return "";
  } catch (e: any) {
    return e.message || "Invalid JSON syntax";
  }
}

// パッチ: ツール実行結果に含まれるスクリーンショットを画像パーツとして展開する
// JSON構文エラーが発生した場合は、AIに修正を依頼する（最大3回まで）
const originalCallLlmAsync = (LlmAgent as any).prototype.callLlmAsync;

// Track retry attempts per invocation context
const retryAttemptsMap = new WeakMap<any, number>();

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
            if (debugMode) {
              console.log("[ADK PATCH] Detected functionCall:", part.functionCall.name, part.functionCall.args);
            }
            
            // args が文字列ならオブジェクトに変換
            if (typeof part.functionCall.args === "string") {
              const argsString = part.functionCall.args;
              
              // JSON構文の事前チェック
              if (!isValidJSON(argsString)) {
                const errorMsg = getJSONParseError(argsString);
                console.error("[ADK PATCH] JSON parse error detected:", errorMsg);
                
                // 現在の試行回数を取得
                const currentAttempts = retryAttemptsMap.get(invocationContext) || 0;
                const maxAttempts = 3;
                
                if (currentAttempts < maxAttempts) {
                  // 試行回数をインクリメント
                  retryAttemptsMap.set(invocationContext, currentAttempts + 1);
                  
                  // エラーメッセージを表示
                  console.log("このアクションは正しく実行されませんでした");
                  
                  if (debugMode) {
                    console.log(`[ADK PATCH] Retry attempt ${currentAttempts + 1}/${maxAttempts}`);
                    console.log(`[ADK PATCH] Invalid JSON: ${argsString}`);
                    console.log(`[ADK PATCH] Error: ${errorMsg}`);
                  }
                  
                  // AIに修正を依頼するため、エラー情報を含むレスポンスを返す
                  yield {
                    id: event.id || "error-response",
                    content: {
                      role: "model",
                      parts: [{
                        text: `JSON構文エラーが発生しました。以下のJSONを修正してください。\nエラー: ${errorMsg}\n不正なJSON: ${argsString}\n\n正しいJSON形式でもう一度functionCallを送信してください。`
                      }]
                    }
                  };
                  
                  // このイベントの処理を中断
                  continue;
                } else {
                  // 最大試行回数を超えた場合
                  console.error("ユーザーのタスクを正しく実行できませんでした");
                  
                  if (debugMode) {
                    console.error(`[ADK PATCH] Maximum retry attempts (${maxAttempts}) exceeded`);
                  }
                  
                  // エラーを通知するレスポンスを返す
                  yield {
                    id: event.id || "max-retry-error",
                    content: {
                      role: "model",
                      parts: [{
                        text: "JSON構文エラーが解決できませんでした。タスクを正しく実行できません。"
                      }]
                    }
                  };
                  
                  // 試行回数をリセット
                  retryAttemptsMap.delete(invocationContext);
                  continue;
                }
              }
              
              // JSONが有効な場合はパース
              try {
                part.functionCall.args = JSON.parse(argsString);
                // 成功したら試行回数をリセット
                retryAttemptsMap.delete(invocationContext);
              } catch (e) {
                // これは到達しないはずだが、念のため
                if (debugMode) {
                  console.error("[ADK PATCH] Unexpected JSON parse error:", e);
                }
                part.functionCall.args = {};
              }
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
