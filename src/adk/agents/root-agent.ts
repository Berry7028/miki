import { LlmAgent, Gemini } from "@google/adk";
import { ROOT_AGENT_INSTRUCTION } from "./agent-config";
import type { MacOSToolSuite } from "../tools/macos-tool-suite";

export class RootAgentFactory {
  static create(
    toolSuite: MacOSToolSuite,
    subAgents: LlmAgent[],
    apiKey?: string
  ): LlmAgent {
    const tools = toolSuite.createTools();
    const model = new Gemini({
      model: "gemini-3-flash-preview",
      apiKey: apiKey
    });

    return new LlmAgent({
      name: "macos_root_agent",
      model: model,
      description: "macOS操作の全体を統括するリーダーエージェントです。",
      instruction: ROOT_AGENT_INSTRUCTION,
      tools: tools,
      subAgents: subAgents,
    });
  }
}
