import { LlmAgent, Gemini } from "@google/adk";
import { BROWSER_AGENT_INSTRUCTION } from "./agent-config";
import type { MacOSToolSuite } from "../tools/macos-tool-suite";

export class BrowserAgentFactory {
  static create(toolSuite: MacOSToolSuite, apiKey?: string): LlmAgent {
    const tools = toolSuite.createTools().filter(tool => 
      ["webElements", "click", "type", "scroll", "osa", "wait", "search", "think", "done"].includes(tool.name)
    );

    const model = new Gemini({
      model: "gemini-3-flash-preview",
      apiKey: apiKey
    });

    return new LlmAgent({
      name: "browser_agent",
      model: model,
      description: "ブラウザの起動、ナビゲーション、Web要素の操作を専門とするエージェントです。",
      instruction: BROWSER_AGENT_INSTRUCTION,
      tools: tools,
    });
  }
}
