import { GoogleGenerativeAI } from "@google/generative-ai";
// @ts-ignore - Note: GoogleAICacheManager might be in @google/generative-ai/server
import { GoogleAICacheManager } from "@google/generative-ai/server";
import type { CacheMetadata } from "./types";

export class GeminiCacheManager {
  private cacheManager: any;
  private apiKey: string;
  private modelName: string = "gemini-1.5-flash-001"; // Default model for caching
  private systemPromptCache: CacheMetadata | null = null;
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
   * @param model モデル名 (例: "models/gemini-1.5-flash-001")
   */
  async createSystemPromptCache(systemPrompt: string, model: string): Promise<CacheMetadata | null> {
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
        ttlSeconds: 3600, // 1時間キャッシュ
      });

      this.systemPromptCache = {
        cacheName: cache.name,
        createdAt: cache.createTime,
        expiresAt: cache.expireTime,
        tokenCount: 0, // SDKから取得できない場合は0
      };

      console.log(`System prompt cache created: ${cache.name}`);
      return this.systemPromptCache;
    } catch (error) {
      console.error("Failed to create system prompt cache:", error);
      return null;
    }
  }

  getSystemPromptCacheName(): string | null {
    return this.systemPromptCache?.cacheName || null;
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
      console.log(`UI elements cache created for ${appName}: ${cache.name}`);
      return metadata;
    } catch (error) {
      console.error(`Failed to cache UI elements for ${appName}:`, error);
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

    for (const [appName, metadata] of this.uiElementsCaches.entries()) {
      await this.deleteCache(metadata.cacheName);
    }
    this.uiElementsCaches.clear();
  }
}
