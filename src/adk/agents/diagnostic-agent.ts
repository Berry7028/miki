import { LlmAgent, Gemini } from "@google/adk";
import { DIAGNOSTIC_AGENT_INSTRUCTION } from "./agent-config";
import type { MacOSToolSuite } from "../tools/macos-tool-suite";

export class DiagnosticAgentFactory {
  static create(toolSuite: MacOSToolSuite, apiKey?: string): LlmAgent {
    // 診断エージェントは状況把握のために多くのツールを使えるようにする
    const tools = toolSuite.createTools();

    const model = new Gemini({
      model: "gemini-3-flash-preview",
      apiKey: apiKey
    });

    return new LlmAgent({
      name: "diagnostic_agent",
      model: model,
      description: "エラー診断、失敗の分析、修復提案を専門とするエージェントです。",
      instruction: DIAGNOSTIC_AGENT_INSTRUCTION,
      tools: tools,
    });
  }
}
