import { LlmAgent, Gemini } from "@google/adk";
import { UI_AGENT_INSTRUCTION } from "./agent-config";
import type { MacOSToolSuite } from "../tools/macos-tool-suite";

export class UIAgentFactory {
  static create(toolSuite: MacOSToolSuite, apiKey?: string): LlmAgent {
    const tools = toolSuite.createTools().filter(tool => 
      ["elementsJson", "focusElement", "click", "type", "press", "hotkey", "move", "scroll", "drag", "wait", "think", "done"].includes(tool.name)
    );

    const model = new Gemini({
      model: "gemini-3-flash-preview",
      apiKey: apiKey
    });

    return new LlmAgent({
      name: "ui_agent",
      model: model,
      description: "デスクトップアプリのUI要素の発見、解析、操作を専門とするエージェントです。",
      instruction: UI_AGENT_INSTRUCTION,
      tools: tools,
    });
  }
}
