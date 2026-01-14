/**
 * Context Manager for efficient LLM context window management
 * Inspired by manus-style context management patterns
 */

import { HISTORY_CONFIG } from "./constants";

export interface Message {
  role: "user" | "model" | "function";
  parts: MessagePart[];
  timestamp?: Date;
  importance?: number; // 0-1, higher = more important
}

export interface MessagePart {
  text?: string;
  functionCall?: {
    name: string;
    args: any;
  };
  functionResponse?: {
    name: string;
    response: any;
  };
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface ContextSnapshot {
  goal: string;
  completedActions: string[];
  currentPhase: string;
  keyObservations: string[];
}

/**
 * Manages conversation history with intelligent truncation and summarization
 */
export class ContextManager {
  private messages: Message[] = [];
  private contextSnapshot: ContextSnapshot | null = null;
  private readonly maxMessages: number;

  constructor(maxMessages: number = HISTORY_CONFIG.MAX_MESSAGES) {
    this.maxMessages = maxMessages;
  }

  /**
   * Add a message to the context
   */
  addMessage(message: Message): void {
    const enrichedMessage = {
      ...message,
      timestamp: message.timestamp || new Date(),
      importance: message.importance ?? this.calculateImportance(message),
    };
    this.messages.push(enrichedMessage);
    this.trimIfNeeded();
  }

  /**
   * Get all messages for LLM context
   */
  getMessages(): Message[] {
    return this.messages;
  }

  /**
   * Update context snapshot (compact representation of progress)
   */
  updateSnapshot(snapshot: Partial<ContextSnapshot>): void {
    this.contextSnapshot = {
      ...this.contextSnapshot,
      ...snapshot,
    } as ContextSnapshot;
  }

  /**
   * Get current context snapshot
   */
  getSnapshot(): ContextSnapshot | null {
    return this.contextSnapshot;
  }

  /**
   * Clear all context
   */
  clear(): void {
    this.messages = [];
    this.contextSnapshot = null;
  }

  /**
   * Calculate importance score for a message
   */
  private calculateImportance(message: Message): number {
    let score = 0.5; // base score

    for (const part of message.parts) {
      // Error messages are important
      if (part.text?.toLowerCase().includes("error") || 
          part.text?.toLowerCase().includes("エラー")) {
        score += 0.3;
      }

      // Done/completion messages are important
      if (part.functionCall?.name === "done" ||
          part.text?.toLowerCase().includes("完了")) {
        score += 0.3;
      }

      // Think messages with planning are important
      if (part.functionCall?.name === "think" &&
          part.functionCall?.args?.phase === "planning") {
        score += 0.2;
      }

      // Screenshots are moderately important
      if (part.inlineData?.mimeType?.startsWith("image/")) {
        score += 0.1;
      }

      // UI element data is less important (can be retrieved again)
      if (part.functionResponse?.name === "elementsJson" ||
          part.functionResponse?.name === "webElements") {
        score -= 0.1;
      }
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Trim messages if context is too large
   * Uses importance-based sliding window
   */
  private trimIfNeeded(): void {
    if (this.messages.length <= this.maxMessages) {
      return;
    }

    // Always keep the most recent messages
    const recentCount = Math.ceil(this.maxMessages * 0.4); // Keep 40% most recent
    const recentMessages = this.messages.slice(-recentCount);

    // From older messages, keep high-importance ones
    const olderMessages = this.messages.slice(0, -recentCount);
    const importantOlderMessages = olderMessages
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, this.maxMessages - recentCount);

    // Recombine, maintaining temporal order
    const keptMessages = [...importantOlderMessages, ...recentMessages]
      .sort((a, b) => {
        const timeA = a.timestamp?.getTime() || 0;
        const timeB = b.timestamp?.getTime() || 0;
        return timeA - timeB;
      });

    this.messages = keptMessages;
  }

  /**
   * Compress UI data in messages to save tokens
   */
  compressUIData(message: Message): Message {
    const compressedParts = message.parts.map((part) => {
      if (part.functionResponse?.name === "elementsJson" ||
          part.functionResponse?.name === "webElements") {
        const response = part.functionResponse.response;
        
        if (response && typeof response === "object") {
          // Keep only essential fields, limit array sizes
          const compressed = this.compressObject(response);
          
          return {
            ...part,
            functionResponse: {
              ...part.functionResponse,
              response: compressed,
            },
          };
        }
      }
      return part;
    });

    return {
      ...message,
      parts: compressedParts,
    };
  }

  /**
   * Recursively compress object data
   */
  private compressObject(obj: any, depth: number = 0): any {
    if (depth > HISTORY_CONFIG.MAX_UI_DEPTH) {
      return "[truncated]";
    }

    if (Array.isArray(obj)) {
      const maxLength = HISTORY_CONFIG.MAX_UI_NODES;
      if (obj.length > maxLength) {
        return obj.slice(0, maxLength).map((item) => this.compressObject(item, depth + 1));
      }
      return obj.map((item) => this.compressObject(item, depth + 1));
    }

    if (obj && typeof obj === "object") {
      const compressed: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip verbose fields
        if (key === "children" && Array.isArray(value) && value.length > HISTORY_CONFIG.MAX_UI_CHILDREN) {
          compressed[key] = value.slice(0, HISTORY_CONFIG.MAX_UI_CHILDREN).map((item) => this.compressObject(item, depth + 1));
        } else if (key === "description" || key === "help") {
          // Skip descriptions to save tokens
          continue;
        } else {
          compressed[key] = this.compressObject(value, depth + 1);
        }
      }
      return compressed;
    }

    // Truncate long strings
    if (typeof obj === "string" && obj.length > HISTORY_CONFIG.MAX_TEXT_CHARS) {
      return obj.substring(0, HISTORY_CONFIG.MAX_TEXT_CHARS) + "...[truncated]";
    }

    return obj;
  }

  /**
   * Generate a summary message for context compression
   */
  generateSummaryMessage(): Message | null {
    if (!this.contextSnapshot) {
      return null;
    }

    const summary = `
## Context Summary

**Goal**: ${this.contextSnapshot.goal || "Not specified"}

**Progress**: 
- Completed Actions: ${this.contextSnapshot.completedActions?.join(", ") || "None"}
- Current Phase: ${this.contextSnapshot.currentPhase || "Starting"}

**Key Observations**:
${this.contextSnapshot.keyObservations?.map((obs) => `- ${obs}`).join("\n") || "None"}
    `.trim();

    return {
      role: "model",
      parts: [{ text: summary }],
      timestamp: new Date(),
      importance: 0.9, // Summaries are important
    };
  }

  /**
   * Get context statistics
   */
  getStats(): {
    messageCount: number;
    estimatedTokens: number;
    hasSnapshot: boolean;
  } {
    // Rough estimation: ~4 characters per token
    const estimatedTokens = this.messages.reduce((sum, msg) => {
      let chars = 0;
      for (const part of msg.parts) {
        if (part.text) chars += part.text.length;
        if (part.functionCall) chars += JSON.stringify(part.functionCall).length;
        if (part.functionResponse) chars += JSON.stringify(part.functionResponse).length;
        if (part.inlineData) chars += 100; // Rough estimate for image tokens
      }
      return sum + Math.ceil(chars / 4);
    }, 0);

    return {
      messageCount: this.messages.length,
      estimatedTokens,
      hasSnapshot: this.contextSnapshot !== null,
    };
  }
}
