import { BaseLlm, type BaseLlmConnection } from "@google/adk";
import type { Content, Part, FunctionCall } from "@google/genai";
import type { LlmRequest, LlmResponse } from "@google/adk";
import { OpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";

export type CustomLlmProvider = "openai" | "openrouter" | "anthropic";

export type CustomLlmSettings = {
  enabled: boolean;
  provider?: CustomLlmProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

type CustomLlmConfig = {
  provider: CustomLlmProvider;
  apiKey: string;
  baseUrl?: string;
  model: string;
};

type OpenAIToolCall = {
  id?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
};

type OpenAIChatMessage = {
  role: "user" | "assistant" | "tool" | "system";
  content?: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
};

type OpenAITool = {
  type: "function";
  function: {
    name?: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

type AnthropicMessageContent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

type AnthropicMessage = {
  role: "user" | "assistant";
  content: AnthropicMessageContent[];
};

export class CustomLlm extends BaseLlm {
  private provider: CustomLlmProvider;
  private apiKey: string;
  private baseUrl?: string;

  constructor(config: CustomLlmConfig) {
    super({ model: config.model });
    this.provider = config.provider;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
  }

  async *generateContentAsync(llmRequest: LlmRequest, stream = false): AsyncGenerator<LlmResponse, void> {
    if (stream) {
      throw new Error("Streaming is not supported for custom providers.");
    }

    this.maybeAppendUserContent(llmRequest);

    try {
      switch (this.provider) {
        case "anthropic":
          yield await this.callAnthropic(llmRequest);
          return;
        case "openai":
        case "openrouter":
        default:
          yield await this.callOpenAI(llmRequest);
          return;
      }
    } catch (error: any) {
      yield {
        errorCode: "PROVIDER_ERROR",
        errorMessage: this.formatProviderError(error),
      };
      return;
    }
  }

  async connect(_llmRequest: LlmRequest): Promise<BaseLlmConnection> {
    throw new Error("Live connections are not supported for custom providers.");
  }

  private async callOpenAI(llmRequest: LlmRequest): Promise<LlmResponse> {
    const openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
      dangerouslyAllowBrowser: false,
    });

    const { messages, tools } = this.buildOpenAIMessages(llmRequest);
    const completion = await openai.chat.completions.create({
      model: llmRequest.model || this.model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      max_tokens: llmRequest.config?.maxOutputTokens,
    });

    const choice = completion.choices?.[0];
    const responseMessage = choice?.message;

    if (!responseMessage) {
      return {
        errorCode: "NO_RESPONSE",
        errorMessage: "No response from provider.",
      };
    }

    const parts: Part[] = [];
    if (responseMessage.content) {
      parts.push({ text: responseMessage.content });
    }

    if (responseMessage.tool_calls?.length) {
      for (const toolCall of responseMessage.tool_calls) {
        const args = toolCall.function?.arguments;
        const parsedArgs = this.parseFunctionArgs(args);
        parts.push({
          functionCall: {
            id: toolCall.id,
            name: toolCall.function?.name,
            args: parsedArgs,
          },
        });
      }
    }

    return {
      content: {
        role: "model",
        parts,
      },
    };
  }

  private async callAnthropic(llmRequest: LlmRequest): Promise<LlmResponse> {
    const anthropic = new Anthropic({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
      dangerouslyAllowBrowser: false,
    });

    const { messages, tools, system } = this.buildAnthropicMessages(llmRequest);

    const response = await anthropic.messages.create({
      model: llmRequest.model || this.model,
      messages,
      system,
      tools: tools.length > 0 ? tools : undefined,
      max_tokens: llmRequest.config?.maxOutputTokens ?? 2048,
    });

    const parts: Part[] = [];
    for (const content of response.content ?? []) {
      if (content.type === "text") {
        parts.push({ text: content.text });
      }
      if (content.type === "tool_use") {
        parts.push({
          functionCall: {
            id: content.id,
            name: content.name,
            args: content.input,
          },
        });
      }
    }

    return {
      content: {
        role: "model",
        parts,
      },
    };
  }

  private formatProviderError(error: any): string {
    const rawMessage = String(error?.message || error || "");
    if (!rawMessage) return "Provider error.";
    if (rawMessage.includes("not_found_error") && rawMessage.includes("model")) {
      return `Model not found. Check provider/model name. (${rawMessage})`;
    }
    return rawMessage;
  }

  private buildOpenAIMessages(llmRequest: LlmRequest) {
    const messages: OpenAIChatMessage[] = [];
    const tools: OpenAITool[] = [];

    const systemText = this.extractSystemText(llmRequest.config?.systemInstruction);
    if (systemText) {
      messages.push({ role: "system", content: systemText });
    }

    for (const content of llmRequest.contents) {
      const parts = content.parts ?? [];
      const textParts = parts.filter((part) => part.text).map((part) => part.text).join("\n");
      const role = content.role === "model" ? "assistant" : "user";

      const toolCalls = this.extractFunctionCalls(parts);
      if (toolCalls.length > 0) {
        messages.push({
          role: "assistant",
          content: textParts || null,
          tool_calls: toolCalls.map((call) => ({
            id: call.id,
            type: "function",
            function: {
              name: call.name,
              arguments: JSON.stringify(call.args ?? {}),
            },
          })),
        });
        continue;
      }

      const toolResponses = this.extractFunctionResponses(parts);
      if (toolResponses.length > 0) {
        for (const response of toolResponses) {
          if (response.id) {
            messages.push({
              role: "tool",
              tool_call_id: response.id,
              content: JSON.stringify(response.response ?? {}),
            });
          }
        }
      }

      if (textParts) {
        messages.push({ role, content: textParts });
      }
    }

    const toolDeclarations = this.extractToolDeclarations(llmRequest);
    for (const declaration of toolDeclarations) {
      tools.push({
        type: "function",
        function: {
          name: declaration.name,
          description: declaration.description,
          parameters: declaration.parameters,
        },
      });
    }

    if (messages.length === 0) {
      return { messages: [{ role: "user", content: "Continue." }], tools };
    }

    return { messages, tools };
  }

  private buildAnthropicMessages(llmRequest: LlmRequest) {
    const messages: AnthropicMessage[] = [];
    const tools: Array<{ name: string; description?: string; input_schema?: Record<string, unknown> }> = [];
    const system = this.extractSystemText(llmRequest.config?.systemInstruction);

    for (const content of llmRequest.contents) {
      const parts = content.parts ?? [];
      const messageParts: AnthropicMessageContent[] = [];
      const text = parts.filter((part) => part.text).map((part) => part.text).join("\n");
      if (text) {
        messageParts.push({ type: "text", text });
      }

      const toolCalls = this.extractFunctionCalls(parts);
      for (const toolCall of toolCalls) {
        if (!toolCall.id || !toolCall.name) {
          continue;
        }
        messageParts.push({
          type: "tool_use",
          id: toolCall.id,
          name: toolCall.name,
          input: toolCall.args ?? {},
        });
      }

      const toolResponses = this.extractFunctionResponses(parts);
      for (const toolResponse of toolResponses) {
        if (!toolResponse.id) {
          continue;
        }
        messageParts.push({
          type: "tool_result",
          tool_use_id: toolResponse.id,
          content: JSON.stringify(toolResponse.response ?? {}),
        });
      }

      if (messageParts.length > 0) {
        messages.push({ role: content.role === "model" ? "assistant" : "user", content: messageParts });
      }
    }

    const toolDeclarations = this.extractToolDeclarations(llmRequest);
    for (const declaration of toolDeclarations) {
      tools.push({
        name: declaration.name || "",
        description: declaration.description,
        input_schema: declaration.parameters as Record<string, unknown> | undefined,
      });
    }

    if (messages.length === 0) {
      messages.push({
        role: "user",
        content: [{ type: "text", text: "Continue." }],
      });
    }

    return { messages, tools, system };
  }

  private extractSystemText(systemInstruction?: unknown): string | undefined {
    if (!systemInstruction) return undefined;
    if (typeof systemInstruction === "string") return systemInstruction;
    if (Array.isArray(systemInstruction)) {
      return systemInstruction
        .map((entry) => {
          if (typeof entry === "string") return entry;
          if (!entry || typeof entry !== "object") return undefined;
          const maybeText = (entry as { text?: string }).text;
          return typeof maybeText === "string" ? maybeText : undefined;
        })
        .filter(Boolean)
        .join("\n");
    }
    if (typeof systemInstruction === "object" && systemInstruction !== null) {
      const maybeContent = systemInstruction as Content;
      return maybeContent.parts?.map((part) => part.text).filter(Boolean).join("\n") || undefined;
    }
    return undefined;
  }

  private extractFunctionCalls(parts: Part[]): FunctionCall[] {
    return parts
      .map((part) => part.functionCall)
      .filter((call): call is FunctionCall => Boolean(call));
  }

  private extractFunctionResponses(parts: Part[]): Array<{ id?: string; response?: Record<string, unknown> }> {
    return parts
      .map((part) => part.functionResponse)
      .filter((response): response is { id?: string; response?: Record<string, unknown> } => Boolean(response));
  }

  private parseFunctionArgs(args?: string) {
    if (!args) return {};
    try {
      return JSON.parse(args);
    } catch {
      return {};
    }
  }

  private extractToolDeclarations(llmRequest: LlmRequest) {
    const declarations: Array<{ name?: string; description?: string; parameters?: Record<string, unknown> }> = [];
    const toolsConfig = llmRequest.config?.tools ?? [];
    for (const tool of toolsConfig) {
      if ("functionDeclarations" in tool && Array.isArray(tool.functionDeclarations)) {
        for (const declaration of tool.functionDeclarations) {
          declarations.push(declaration);
        }
      }
    }
    return declarations;
  }
}
