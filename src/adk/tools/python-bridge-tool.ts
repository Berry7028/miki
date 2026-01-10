import { FunctionTool, type ToolContext } from "@google/adk";
import type { PythonBridge } from "../../controller/python-bridge";

export class PythonBridgeTool extends FunctionTool<any> {
  protected bridge: PythonBridge;
  protected actionName: string;

  constructor(options: {
    name: string;
    description: string;
    parameters: any;
    bridge: PythonBridge;
    actionName?: string;
    execute?: (args: any, tool_context?: ToolContext) => Promise<any>;
  }) {
    super({
      name: options.name,
      description: options.description,
      parameters: options.parameters,
      execute: options.execute || (async (args: any, _tool_context?: ToolContext) => {
        return await this.bridge.call(this.actionName, args);
      }),
    });
    this.bridge = options.bridge;
    this.actionName = options.actionName || options.name;
  }
}
