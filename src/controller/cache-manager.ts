import { GoogleGenerativeAI } from "@google/generative-ai";
// @ts-ignore - Note: GoogleAICacheManager might be in @google/generative-ai/server
import { GoogleAICacheManager } from "@google/generative-ai/server";
import type { CacheMetadata } from "./types";

export class GeminiCacheManager {
  private cacheManager: any;
  private apiKey: string;
  private modelName: string = "gemini-3-flash-preview"; // Default model for caching
  private systemPromptCache: CacheMetadata | null = null;
  private historyCache: CacheMetadata | null = null; // 履歴を含むキャッシュ
  private uiElementsCaches: Map<string, CacheMetadata> = new Map();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    try {
      this.cacheManager = new GoogleAICacheManager(apiKey);
    } catch (e) {
      console.error("Failed to initialize GoogleAICacheManager:", e);
    }
  }

  /**
   * システムプロンプトをキャッシュに保存する
   * @param systemPrompt キャッシュするシステムプロンプト
   * @param model モデル名 (例: "models/gemini-3-flash-preview")
   * @param tools ツール定義 (オプション)
   */
  async createSystemPromptCache(systemPrompt: string, model: string, tools?: any[]): Promise<CacheMetadata | null> {
    if (!this.cacheManager) return null;

    try {
      this.modelName = model;
      
      // キャッシュを作成
      const cache = await this.cacheManager.create({
        model: model,
        displayName: "miki-system-prompt",
        contents: [
          {
            role: "user",
            parts: [{ text: systemPrompt }],
          },
        ],
        tools: tools ? [{ functionDeclarations: tools }] : undefined,
        ttlSeconds: 3600, // 1時間キャッシュ
      });

      this.systemPromptCache = {
        cacheName: cache.name,
        createdAt: cache.createTime,
        expiresAt: cache.expireTime,
        tokenCount: 0, // SDKから取得できない場合は0
      };

      console.error(`System prompt cache created: ${cache.name}`);
      return this.systemPromptCache;
    } catch (error: any) {
      // 1024トークン未満などの理由でキャッシュに失敗した場合は無視する
      if (error?.message?.includes("too small") || error?.status === 400) {
        console.error("System prompt is too small for caching. Skipping.");
      } else {
        console.error("Failed to create system prompt cache:", error);
      }
      return null;
    }
  }

  getSystemPromptCacheName(): string | null {
    return this.systemPromptCache?.cacheName || null;
  }

  /**
   * 履歴を含むキャッシュを作成または更新する
   */
  async updateHistoryCache(contents: any[], model: string, tools?: any[]): Promise<CacheMetadata | null> {
    if (!this.cacheManager) return null;

    try {
      this.modelName = model;
      
      // 古い履歴キャッシュを削除（オプション。Geminiは自動で消去するが明示的に管理）
      if (this.historyCache) {
        await this.deleteCache(this.historyCache.cacheName).catch(() => {});
      }

      const cache = await this.cacheManager.create({
        model: model,
        displayName: "miki-history-cache",
        contents: contents,
        tools: tools ? [{ functionDeclarations: tools }] : undefined,
        ttlSeconds: 1800, // 30分
      });

      this.historyCache = {
        cacheName: cache.name,
        createdAt: cache.createTime,
        expiresAt: cache.expireTime,
        tokenCount: 0,
      };

      console.error(`History cache created/updated: ${cache.name}`);
      return this.historyCache;
    } catch (error: any) {
      if (error?.message?.includes("too small") || error?.status === 400) {
        console.error("History is too small for caching. Skipping.");
      } else {
        console.error("Failed to update history cache:", error);
      }
      return null;
    }
  }

  getHistoryCacheName(): string | null {
    return this.historyCache?.cacheName || null;
  }

  /**
   * UI要素データをキャッシュする
   */
  async cacheUIElements(appName: string, uiData: any, model: string): Promise<CacheMetadata | null> {
    if (!this.cacheManager) return null;

    try {
      const dataStr = JSON.stringify(uiData);
      
      const cache = await this.cacheManager.create({
        model: model,
        displayName: `ui-elements-${appName}`,
        contents: [
          {
            role: "user",
            parts: [{ text: `Below is the UI structure for the application: ${appName}\n\n${dataStr}` }],
          },
        ],
        ttlSeconds: 300, // 5分キャッシュ
      });

      const metadata = {
        cacheName: cache.name,
        createdAt: cache.createTime,
        expiresAt: cache.expireTime,
        tokenCount: 0,
      };

      this.uiElementsCaches.set(appName, metadata);
      console.error(`UI elements cache created for ${appName}: ${cache.name}`);
      return metadata;
    } catch (error: any) {
      if (error?.message?.includes("too small") || error?.status === 400) {
        console.error(`UI elements for ${appName} are too small for caching. Skipping.`);
      } else {
        console.error(`Failed to cache UI elements for ${appName}:`, error);
      }
      return null;
    }
  }

  getUIElementsCacheName(appName: string): string | null {
    return this.uiElementsCaches.get(appName)?.cacheName || null;
  }

  /**
   * 指定したキャッシュを削除
   */
  async deleteCache(cacheName: string): Promise<void> {
    if (!this.cacheManager) return;
    try {
      await this.cacheManager.delete(cacheName);
    } catch (e) {
      console.error(`Failed to delete cache ${cacheName}:`, e);
    }
  }

  /**
   * 全てのキャッシュをクリアする
   */
  async clearAllCaches(): Promise<void> {
    if (this.systemPromptCache) {
      await this.deleteCache(this.systemPromptCache.cacheName);
      this.systemPromptCache = null;
    }

    if (this.historyCache) {
      await this.deleteCache(this.historyCache.cacheName);
      this.historyCache = null;
    }

    for (const [appName, metadata] of this.uiElementsCaches.entries()) {
      await this.deleteCache(metadata.cacheName);
    }
    this.uiElementsCaches.clear();
  }
}
