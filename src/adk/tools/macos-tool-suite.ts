import { FunctionTool, type ToolContext } from "@google/adk";
import type { PythonBridge } from "../../core/python-bridge";
import { PERFORMANCE_CONFIG } from "../../core/constants";
import * as schemas from "./schemas";

export class MacOSToolSuite {
  private bridge: PythonBridge;
  private screenSize: { width: number; height: number };

  constructor(bridge: PythonBridge, screenSize: { width: number; height: number }) {
    this.bridge = bridge;
    this.screenSize = screenSize;
  }

  public updateScreenSize(width: number, height: number) {
    this.screenSize = { width, height };
  }

  private normalizeToScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.round((x / 1000) * this.screenSize.width),
      y: Math.round((y / 1000) * this.screenSize.height),
    };
  }

  private async takePostActionScreenshot(highlightPos?: { x: number; y: number }) {
    const result = await this.bridge.call("screenshot", {
      highlight_pos: highlightPos,
      quality: PERFORMANCE_CONFIG.SCREENSHOT_QUALITY,
    });
    if (result.status !== "success" || !result.data) {
      return undefined;
    }
    return {
      inlineData: {
        mimeType: "image/jpeg",
        data: result.data
      }
    };
  }

  public createTools(): FunctionTool<any>[] {
    return [
      this.createClickTool(),
      this.createMoveTool(),
      this.createDragTool(),
      this.createScrollTool(),
      this.createTypeTool(),
      this.createPressTool(),
      this.createHotkeyTool(),
      this.createElementsJsonTool(),
      this.createFocusElementTool(),
      this.createWebElementsTool(),
      this.createOsaTool(),
      this.createWaitTool(),
      this.createThinkTool(),
      this.createDoneTool(),
    ];
  }

  private createClickTool() {
    return new FunctionTool({
      name: "click",
      description: "指定した正規化座標(0-1000)を単一の左クリックで操作します。",
      parameters: schemas.ClickSchema,
      execute: async (args: any, context?: ToolContext) => {
        const pos = this.normalizeToScreen(args.x, args.y);
        const result = await this.bridge.call("click", pos);
        const screenshot = await this.takePostActionScreenshot(pos);
        if (context) {
          context.state.set("last_action_pos", pos);
        }
        const finalResult: any = { ...result };
        if (screenshot) {
          finalResult.screenshot = screenshot;
        }
        return finalResult;
      },
    });
  }

  private createMoveTool() {
    return new FunctionTool({
      name: "move",
      description: "マウスカーソルを指定した正規化座標(0-1000)へ移動します。",
      parameters: schemas.MoveSchema,
      execute: async (args: any, context?: ToolContext) => {
        const pos = this.normalizeToScreen(args.x, args.y);
        const result = await this.bridge.call("move", pos);
        const screenshot = await this.takePostActionScreenshot(pos);
        if (context) {
          context.state.set("last_action_pos", pos);
        }
        const finalResult: any = { ...result };
        if (screenshot) {
          finalResult.screenshot = screenshot;
        }
        return finalResult;
      },
    });
  }

  private createDragTool() {
    return new FunctionTool({
      name: "drag",
      description: "from座標からto座標へドラッグ&ドロップします。",
      parameters: schemas.DragSchema,
      execute: async (args: any, context?: ToolContext) => {
        const from = this.normalizeToScreen(args.from_x, args.from_y);
        const to = this.normalizeToScreen(args.to_x, args.to_y);
        const result = await this.bridge.call("drag", {
          from_x: from.x,
          from_y: from.y,
          to_x: to.x,
          to_y: to.y,
        });
        const screenshot = await this.takePostActionScreenshot(from);
        if (context) {
          context.state.set("last_action_pos", from);
        }
        const finalResult: any = { ...result };
        if (screenshot) {
          finalResult.screenshot = screenshot;
        }
        return finalResult;
      },
    });
  }

  private createScrollTool() {
    return new FunctionTool({
      name: "scroll",
      description: "垂直方向にスクロールします。正の値で下方向、負の値で上方向。",
      parameters: schemas.ScrollSchema,
      execute: async (args: any) => {
        const result = await this.bridge.call("scroll", args);
        const screenshot = await this.takePostActionScreenshot();
        const finalResult: any = { ...result };
        if (screenshot) {
          finalResult.screenshot = screenshot;
        }
        return finalResult;
      },
    });
  }

  private createTypeTool() {
    return new FunctionTool({
      name: "type",
      description: "フォーカス中の入力欄にテキストを入力します。",
      parameters: schemas.TypeSchema,
      execute: async (args: any) => {
        const result = await this.bridge.call("type", args);
        const screenshot = await this.takePostActionScreenshot();
        const finalResult: any = { ...result };
        if (screenshot) {
          finalResult.screenshot = screenshot;
        }
        return finalResult;
      },
    });
  }

  private createPressTool() {
    return new FunctionTool({
      name: "press",
      description: "EnterやEscなどの単一キーを送信します。",
      parameters: schemas.PressSchema,
      execute: async (args: any) => {
        const result = await this.bridge.call("press", args);
        const screenshot = await this.takePostActionScreenshot();
        const finalResult: any = { ...result };
        if (screenshot) {
          finalResult.screenshot = screenshot;
        }
        return finalResult;
      },
    });
  }

  private createHotkeyTool() {
    return new FunctionTool({
      name: "hotkey",
      description: "修飾キーを含む複数キーの同時押下を送信します。",
      parameters: schemas.HotkeySchema,
      execute: async (args: any) => {
        const result = await this.bridge.call("hotkey", args);
        const screenshot = await this.takePostActionScreenshot();
        const finalResult: any = { ...result };
        if (screenshot) {
          finalResult.screenshot = screenshot;
        }
        return finalResult;
      },
    });
  }

  private createElementsJsonTool() {
    return new FunctionTool({
      name: "elementsJson",
      description: "macOSのアクセシビリティツリーを取得します。",
      parameters: schemas.ElementsJsonSchema,
      execute: async (args: any, context?: ToolContext) => {
        const result = await this.bridge.call("elementsJson", args);
        const screenshot = await this.takePostActionScreenshot();
        if (context && result.status === "success" && result.ui_data) {
          context.state.set("last_ui_snapshot_app", args.app_name);
          context.state.set("current_app", args.app_name);
        }
        const finalResult: any = { ...result };
        if (screenshot) {
          finalResult.screenshot = screenshot;
        }
        return finalResult;
      },
    });
  }

  private createFocusElementTool() {
    return new FunctionTool({
      name: "focusElement",
      description: "要素をフォーカスします。",
      parameters: schemas.FocusElementSchema,
      execute: async (args: any) => {
        const result = await this.bridge.call("focusElement", args);
        const screenshot = await this.takePostActionScreenshot();
        const finalResult: any = { ...result };
        if (screenshot) {
          finalResult.screenshot = screenshot;
        }
        return finalResult;
      },
    });
  }

  private createWebElementsTool() {
    return new FunctionTool({
      name: "webElements",
      description: "ブラウザ内のDOM要素一覧を取得します。",
      parameters: schemas.WebElementsSchema,
      execute: async (args: any, context?: ToolContext) => {
        const result = await this.bridge.call("webElements", args);
        const screenshot = await this.takePostActionScreenshot();
        if (context && result.status === "success") {
          context.state.set("current_app", args.app_name);
        }
        const finalResult: any = { ...result };
        if (screenshot) {
          finalResult.screenshot = screenshot;
        }
        return finalResult;
      },
    });
  }

  private createOsaTool() {
    return new FunctionTool({
      name: "osa",
      description: "任意のAppleScriptを実行します。",
      parameters: schemas.OsaSchema,
      execute: async (args: any) => {
        const result = await this.bridge.call("osa", args);
        const screenshot = await this.takePostActionScreenshot();
        const finalResult: any = { ...result };
        if (screenshot) {
          finalResult.screenshot = screenshot;
        }
        return finalResult;
      },
    });
  }

  private createWaitTool() {
    return new FunctionTool({
      name: "wait",
      description: "指定秒数待機します。",
      parameters: schemas.WaitSchema,
      execute: async (args: any) => {
        await new Promise((resolve) => setTimeout(resolve, args.seconds * 1000));
        const screenshot = await this.takePostActionScreenshot();
        const finalResult: any = { status: "success", message: `${args.seconds}秒待機しました` };
        if (screenshot) {
          finalResult.screenshot = screenshot;
        }
        return finalResult;
      },
    });
  }

  private createThinkTool() {
    return new FunctionTool({
      name: "think",
      description: "タスクの計画や実行後の検証を明示的に記録します。",
      parameters: schemas.ThinkSchema,
      execute: async (args: any) => {
        return { status: "success", thought: args.thought, phase: args.phase };
      },
    });
  }

  private createDoneTool() {
    return new FunctionTool({
      name: "done",
      description: "すべてのタスクが完了したことを報告します。",
      parameters: schemas.DoneSchema,
      execute: async (args: any) => {
        return { status: "success", message: args.message };
      },
    });
  }
}
