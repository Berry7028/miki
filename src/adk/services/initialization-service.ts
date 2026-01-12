// Initialization Service
// 責務: Orchestratorの初期化ロジック

import { PythonBridge } from "../../core/python-bridge";
import { MacOSToolSuite } from "../tools/macos-tool-suite";
import { MainAgentFactory } from "../agents/main-agent";
import { MacOSErrorHandlerPlugin } from "../errors/error-handler";
import { LlmAgent, Runner, InMemorySessionService, LoggingPlugin } from "@google/adk";
import type { ToolContext } from "@google/adk";

export interface InitializationConfig {
  screenSize: { width: number; height: number };
  defaultBrowser: string;
  defaultBrowserId: string;
}

export interface InitializedComponents {
  toolSuite: MacOSToolSuite;
  rootAgent: LlmAgent;
  runner: Runner;
  sessionService: InMemorySessionService;
}

export class InitializationService {
  constructor(
    private pythonBridge: PythonBridge,
    private apiKey: string,
    private debugMode: boolean
  ) {}

  async initialize(): Promise<InitializationConfig> {
    // 画面サイズの取得
    const res = await this.pythonBridge.call("size");
    const screenSize = { width: res.width || 0, height: res.height || 0 };

    // デフォルトブラウザの取得 (タイムアウト付き)
    let defaultBrowser = "Safari";
    let defaultBrowserId = "";
    try {
      const browserRes = await this.pythonBridge.call("browser", {}, { timeout: 5000 });
      if (browserRes.status === "success" && browserRes.browser) {
        defaultBrowser = browserRes.browser;
        defaultBrowserId = browserRes.bundle_id || "";
      }
    } catch (e) {
      // ブラウザ取得エラーは無視してSafariを使用
    }

    return {
      screenSize,
      defaultBrowser,
      defaultBrowserId
    };
  }

  createComponents(config: InitializationConfig): InitializedComponents {
    // ツールスイートの構築
    const toolSuite = new MacOSToolSuite(this.pythonBridge, config.screenSize);

    // ルートエージェントの作成
    const rootAgent = MainAgentFactory.create(
      toolSuite,
      this.apiKey,
      config.defaultBrowser,
      config.defaultBrowserId
    );

    // セッションサービスの初期化
    const sessionService = new InMemorySessionService();

    // プラグインの設定
    const plugins = [
      new MacOSErrorHandlerPlugin()
    ];

    if (this.debugMode) {
      plugins.push(new LoggingPlugin());
    }

    // ランナーの初期化
    const runner = new Runner({
      agent: rootAgent,
      appName: "miki-desktop",
      sessionService: sessionService,
      plugins: plugins
    });

    return {
      toolSuite,
      rootAgent,
      runner,
      sessionService
    };
  }
}
