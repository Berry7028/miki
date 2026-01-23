import { FunctionTool, type ToolContext } from "@google/adk";
import type { PythonBridge } from "../../core/python-bridge";

export class PythonBridgeTool extends FunctionTool<any> {
  protected bridge: PythonBridge;
  protected actionName: string;
  protected debugMode: boolean;

  constructor(options: {
    name: string;
    description: string;
    parameters: any;
    bridge: PythonBridge;
    actionName?: string;
    debugMode?: boolean;
    execute?: (args: any, tool_context?: ToolContext) => Promise<any>;
  }) {
    super({
      name: options.name,
      description: options.description,
      parameters: options.parameters,
      execute: options.execute || (async (args: any, _tool_context?: ToolContext) => {
        if (this.debugMode) {
          console.error(`[PythonBridgeTool] Executing action: ${this.actionName}`);
          console.error(`[PythonBridgeTool] Arguments: ${JSON.stringify(args).substring(0, 300)}...`);
        }
        const result = await this.bridge.call(this.actionName, args);
        if (this.debugMode) {
          const resultPreview = JSON.stringify(result).substring(0, 300);
          console.error(`[PythonBridgeTool] Result: ${resultPreview}...`);
        }
        return result;
      }),
    });
    this.bridge = options.bridge;
    this.actionName = options.actionName || options.name;
    this.debugMode = options.debugMode || false;
  }
}
