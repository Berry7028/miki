import { LlmAgent, Gemini } from "@google/adk";
import { SYSTEM_AGENT_INSTRUCTION } from "./agent-config";
import type { MacOSToolSuite } from "../tools/macos-tool-suite";

export class SystemAgentFactory {
  static create(toolSuite: MacOSToolSuite, apiKey?: string): LlmAgent {
    const tools = toolSuite.createTools().filter(tool => 
      ["osa", "think", "done"].includes(tool.name)
    );

    const model = new Gemini({
      model: "gemini-3-flash-preview",
      apiKey: apiKey
    });

    return new LlmAgent({
      name: "system_agent",
      model: model,
      description: "システム情報取得、設定変更、AppleScript実行を専門とするエージェントです。",
      instruction: SYSTEM_AGENT_INSTRUCTION,
      tools: tools,
    });
  }
}
