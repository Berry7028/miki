/**
 * Context Management Plugin for Google ADK
 * Intercepts and manages conversation history with intelligent compression
 */

import type { Plugin, InvocationContext, ModelRequest, ModelResponse, FunctionResponse } from "@google/adk";
import { ContextManager, type Message } from "../../core/context-manager";

export class ContextManagementPlugin implements Plugin {
  name = "ContextManagementPlugin";
  private contextManager: ContextManager;

  constructor(contextManager: ContextManager) {
    this.contextManager = contextManager;
  }

  async beforeModelRequest(
    invocationContext: InvocationContext,
    modelRequest: ModelRequest
  ): Promise<ModelRequest> {
    // Apply context compression to the request before sending to LLM
    if (modelRequest.contents && Array.isArray(modelRequest.contents)) {
      const compressedContents = modelRequest.contents.map((content: any) => {
        const message: Message = {
          role: content.role,
          parts: content.parts || [],
        };

        // Compress UI data to save tokens
        const compressed = this.contextManager.compressUIData(message);
        
        return {
          ...content,
          parts: compressed.parts,
        };
      });

      return {
        ...modelRequest,
        contents: compressedContents,
      };
    }

    return modelRequest;
  }

  async afterModelResponse(
    invocationContext: InvocationContext,
    modelResponse: ModelResponse
  ): Promise<void> {
    // Track model responses in context manager
    if (modelResponse.content && modelResponse.content.parts) {
      this.contextManager.addMessage({
        role: "model",
        parts: modelResponse.content.parts,
      });
    }
  }

  async afterFunctionExecution(
    invocationContext: InvocationContext,
    functionResponse: FunctionResponse
  ): Promise<void> {
    // Track function responses
    if (functionResponse.name && functionResponse.response) {
      this.contextManager.addMessage({
        role: "function",
        parts: [
          {
            functionResponse: {
              name: functionResponse.name,
              response: functionResponse.response,
            },
          },
        ],
      });
    }
  }
}
