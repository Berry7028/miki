import type { ActionBase, PythonResponse } from "./types";
import type { PythonBridge } from "./python-bridge";
import { PERFORMANCE_CONFIG, DEBUG_TEXT_TRUNCATE_LENGTH } from "./constants";

export class ActionExecutor {
  private pythonBridge: PythonBridge;
  private screenSize: { width: number; height: number };
  private debugMode: boolean;

  constructor(
    pythonBridge: PythonBridge,
    screenSize: { width: number; height: number },
    debugMode: boolean = false,
  ) {
    this.pythonBridge = pythonBridge;
    this.screenSize = screenSize;
    this.debugMode = debugMode;
  }

  updateScreenSize(width: number, height: number) {
    this.screenSize = { width, height };
  }

  private debugLog(message: string) {
    if (this.debugMode) {
      console.error(message);
    }
  }

  private debugLogSection(title: string, content: Record<string, any>) {
    if (!this.debugMode) return;
    console.error(`\n[DEBUG] ========== ${title} ==========`);
    for (const [key, value] of Object.entries(content)) {
      if (typeof value === "string" && value.length > DEBUG_TEXT_TRUNCATE_LENGTH) {
        console.error(
          `[DEBUG] ${key}: ${value.substring(0, DEBUG_TEXT_TRUNCATE_LENGTH)}... (${value.length} chars)`,
        );
      } else if (typeof value === "object" && value !== null) {
        console.error(`[DEBUG] ${key}: ${JSON.stringify(value, null, 2)}`);
      } else {
        console.error(`[DEBUG] ${key}: ${value}`);
      }
    }
    console.error(`[DEBUG] ==========================================\n`);
  }

  async execute(
    action: ActionBase,
  ): Promise<{ result: PythonResponse; functionResponse: { name: string; response: any } }> {
    let execParams = { ...(action as any).params };
    let highlightPos: { x: number; y: number } | null = null;

    // デバッグログ: アクション実行前
    this.debugLogSection("Executing Action", {
      Action: action.action,
      "Params (original)": execParams,
    });

    // UI要素ベースの操作は座標変換不要
    const elementBasedActions = [
      "clickElement",
      "typeToElement",
      "focusElement",
      "elementsJson",
      "webElements",
      "clickWebElement",
    ];
    const isElementBased = elementBasedActions.includes(action.action);

    if (!isElementBased && execParams.x !== undefined && execParams.y !== undefined) {
      execParams.x = Math.round((execParams.x / 1000) * this.screenSize.width);
      execParams.y = Math.round((execParams.y / 1000) * this.screenSize.height);

      if (action.action === "click" || action.action === "move") {
        highlightPos = { x: execParams.x, y: execParams.y };
      }
    }

    // dragアクションの座標変換
    if (action.action === "drag") {
      execParams.from_x = Math.round((execParams.from_x / 1000) * this.screenSize.width);
      execParams.from_y = Math.round((execParams.from_y / 1000) * this.screenSize.height);
      execParams.to_x = Math.round((execParams.to_x / 1000) * this.screenSize.width);
      execParams.to_y = Math.round((execParams.to_y / 1000) * this.screenSize.height);
      // ドラッグの開始位置をハイライト
      highlightPos = { x: execParams.from_x, y: execParams.from_y };
    }

    if (this.debugMode && !isElementBased) {
      this.debugLog(`[DEBUG] Params (converted): ${JSON.stringify(execParams, null, 2)}`);
    }

    const result = await this.pythonBridge.call(action.action, execParams);

    // デバッグログ: アクション実行結果
    if (this.debugMode) {
      const debugInfo: Record<string, any> = { Result: result };

      // UI要素取得アクションの場合、詳細な結果を追加
      if (action.action === "elementsJson" && result.ui_data) {
        debugInfo["UI Elements Retrieved"] = result.ui_data;
      }
      if (action.action === "webElements" && result.elements) {
        debugInfo["Web Elements Retrieved"] = result.elements;
      }

      this.debugLogSection("Action Result", debugInfo);
    }

    let screenshotBase64: string | undefined;
    if (highlightPos) {
      const hRes = await this.pythonBridge.call("screenshot", {
        highlight_pos: highlightPos,
        quality: PERFORMANCE_CONFIG.SCREENSHOT_QUALITY,
      });
      if (hRes.status === "success" && hRes.data) {
        screenshotBase64 = hRes.data;
      }
    }

    const responsePayload: any = {
      status: result.status,
      message: result.message,
      execution_time_ms: result.execution_time_ms,
      data: result.data,
      ui_data: result.ui_data,
      elements: result.elements,
      mouse_position: result.mouse_position,
    };

    if (screenshotBase64) {
      responsePayload.screenshot = screenshotBase64;
    }

    return { result, functionResponse: { name: action.action, response: responsePayload } };
  }
}
