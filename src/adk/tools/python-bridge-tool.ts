import { FunctionTool, type ToolContext } from "@google/adk";
import type { PythonBridge } from "../../core/python-bridge";
import type { JSONSchemaDefinition } from "./schemas";

export class PythonBridgeTool extends FunctionTool<unknown> {
  protected bridge: PythonBridge;
  protected actionName: string;

  constructor(options: {
    name: string;
    description: string;
    parameters: JSONSchemaDefinition;
    bridge: PythonBridge;
    actionName?: string;
    execute?: (args: Record<string, unknown>, tool_context?: ToolContext) => Promise<unknown>;
  }) {
    super({
      name: options.name,
      description: options.description,
      parameters: options.parameters,
      execute: options.execute || (async (args: Record<string, unknown>, _tool_context?: ToolContext) => {
        return await this.bridge.call(this.actionName, args);
      }),
    });
    this.bridge = options.bridge;
    this.actionName = options.actionName || options.name;
  }
}
