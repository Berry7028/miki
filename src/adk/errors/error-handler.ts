import { BasePlugin, type ToolContext, type BaseTool } from "@google/adk";

export class MacOSErrorHandlerPlugin extends BasePlugin {
  constructor() {
    super("macos_error_handler");
  }

  override async onToolErrorCallback({ tool, toolArgs, toolContext, error }: {
    tool: BaseTool;
    toolArgs: Record<string, unknown>;
    toolContext: ToolContext;
    error: Error;
  }): Promise<Record<string, unknown> | undefined> {
    console.error(`[ErrorHandler] Tool ${tool.name} failed: ${error.message}`);

    // エラー情報を状態に保存
    toolContext.state.set("last_error", {
      tool: tool.name,
      args: toolArgs,
      message: error.message,
      timestamp: new Date().toISOString(),
    });

    // タイムアウトや特定の接続エラーの場合は、
    // ここでリトライを試みるか、あるいは単にエラー情報を返して
    // LLMに判断させる（DiagnosticAgentが活躍する場面）
    
    return {
      status: "error",
      error_type: error.name,
      message: error.message,
      hint: "操作が失敗しました。DiagnosticAgentに相談するか、別の方法を試してください。"
    };
  }
}
