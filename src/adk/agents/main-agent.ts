import { LlmAgent, Gemini } from "@google/adk";
import { createMainAgentInstruction } from "./agent-config";
import type { MacOSToolSuite } from "../tools/macos-tool-suite";
import { CustomLlm, type CustomLlmSettings } from "../models/custom-llm";

export class MainAgentFactory {
  static create(
    toolSuite: MacOSToolSuite,
    apiKey?: string,
    defaultBrowser: string = "Safari",
    defaultBrowserId?: string,
    customLlm?: CustomLlmSettings
  ): LlmAgent {
    const tools = toolSuite.createTools();
    const model = customLlm?.enabled && customLlm.apiKey && customLlm.model && customLlm.provider
      ? new CustomLlm({
          provider: customLlm.provider,
          apiKey: customLlm.apiKey,
          baseUrl: customLlm.baseUrl,
          model: customLlm.model
        })
      : new Gemini({
          model: "gemini-3-flash-preview",
          apiKey: apiKey
        });

    return new LlmAgent({
      name: "main_agent",
      model: model,
      description: "macOS操作を一貫して実行する自動化エージェントです。ユーザーの依頼を最初から最後まで追跡し、元のゴールを常に意識しながら作業を完遂します。macOSの操作の方法がわからない場合は全ての方法を試します。ただし、破壊的な方法は避けましょう。例: クリックによってデータが消える、または元に戻せないようなボタンの操作は避けてください。",
      instruction: createMainAgentInstruction(defaultBrowser, defaultBrowserId),
      tools: tools
    });
  }
}
