# Context Management System

[日本語](./CONTEXT_MANAGEMENT_JP.md) | English

Miki's context management system is inspired by Anthropic's Manus project, implementing efficient LLM context window management.

## Overview

During LLM agent execution, conversation history grows and can exceed token limits or slow down response times. This system achieves:

1. **Importance-based history retention** - Prioritizes important messages
2. **Automatic UI data compression** - Compresses elementsJson and webElements results
3. **Sliding window** - Retains recent messages and important older messages
4. **Context snapshot** - Maintains compact task progress information

## Architecture

### Components

```
┌─────────────────────────────────────┐
│   MacOSAgentOrchestrator            │
│   ┌───────────────────────────┐     │
│   │   ContextManager          │     │
│   └───────────────────────────┘     │
│   ┌───────────────────────────┐     │
│   │ ContextManagementPlugin   │     │
│   └───────────────────────────┘     │
└─────────────────────────────────────┘
           ↓
    Google ADK Runner
           ↓
      Gemini LLM API
```

### ContextManager (`src/core/context-manager.ts`)

Manages conversation history and context snapshots.

**Key Features:**

- `addMessage(message)` - Adds message and auto-calculates importance
- `getMessages()` - Gets message list to send to LLM
- `updateSnapshot(snapshot)` - Updates task progress information
- `compressUIData(message)` - Compresses UI data to reduce token count
- `getStats()` - Gets context statistics

**Importance Calculation Logic:**

```typescript
Base Score: 0.5

Addition factors:
- Error messages: +0.3
- Completion messages (done): +0.3
- Planning phase think: +0.2
- Screenshots: +0.1

Subtraction factors:
- elementsJson/webElements: -0.1 (can be retrieved again)
```

**Message Retention Strategy:**

1. Always keep the most recent 40% of messages
2. Select high-importance messages from older messages
3. Reconstruct in chronological order

### ContextManagementPlugin (`src/adk/plugins/context-plugin.ts`)

Works as a Google ADK plugin, monitoring LLM requests/responses.

**Hooks:**

- `beforeModelRequest` - Compresses UI data before sending request
- `afterModelResponse` - Records message after receiving response
- `afterFunctionExecution` - Records tool execution results

### Integration (`src/adk/orchestrator.ts`)

Integrated with orchestrator to track context during task execution.

```typescript
// Initialization
this.contextManager = new ContextManager();

// On task start
this.contextManager.updateSnapshot({
  goal: "User's goal",
  completedActions: [],
  currentPhase: "planning",
  keyObservations: [],
});

// On action execution
completedActions.push(call.name);
this.contextManager.updateSnapshot({ completedActions });

// Output statistics in debug mode
const stats = this.contextManager.getStats();
this.log("info", `Context stats: ${stats.messageCount} messages, ~${stats.estimatedTokens} tokens`);
```

## Configuration

Adjustable in `src/core/constants.ts`:

```typescript
export const HISTORY_CONFIG = {
  MAX_MESSAGES: 24,          // Maximum number of messages
  MAX_TEXT_CHARS: 1000,      // Maximum text characters
  MAX_DATA_CHARS: 2000,      // Maximum data characters
  MAX_UI_NODES: 200,         // Maximum UI element nodes
  MAX_UI_DEPTH: 2,           // Maximum UI tree depth
  MAX_UI_CHILDREN: 20,       // Maximum number of children
  MAX_WEB_ELEMENTS: 200,     // Maximum web elements
  MAX_ACTIONS: 8,            // Maximum actions
};
```

## UI Data Compression Mechanism

### Compression Targets

- `elementsJson` results (accessibility tree)
- `webElements` results (browser DOM elements)

### Compression Methods

1. **Array Truncation**
   - If node count exceeds `MAX_UI_NODES`, keep only the beginning
   - If children exceed `MAX_UI_CHILDREN`, keep only the beginning

2. **Depth Limiting**
   - Levels exceeding `MAX_UI_DEPTH` are replaced with `"[truncated]"`

3. **Redundant Field Removal**
   - Remove fields like `description`, `help`

4. **String Truncation**
   - Strings exceeding `MAX_TEXT_CHARS` are truncated with `"...[truncated]"` appended

### Compression Example

**Before Compression:**
```json
{
  "elements": [
    {
      "role": "AXButton",
      "title": "Submit",
      "description": "Click this button to submit the form",
      "help": "Press enter to activate",
      "position": {"x": 100, "y": 200},
      "children": [ /* 50 children */ ]
    },
    /* ... 300 more elements ... */
  ]
}
```

**After Compression:**
```json
{
  "elements": [
    {
      "role": "AXButton",
      "title": "Submit",
      "position": {"x": 100, "y": 200},
      "children": [ /* first 20 children */ ]
    },
    /* ... first 200 elements ... */
  ]
}
```

## Context Snapshot

Structure for maintaining compact task progress:

```typescript
interface ContextSnapshot {
  goal: string;                    // User's goal
  completedActions: string[];      // Completed actions
  currentPhase: string;            // Current phase
  keyObservations: string[];       // Key observations
}
```

### Usage Example

```typescript
// On task start
contextManager.updateSnapshot({
  goal: "Open Safari and search Google",
  completedActions: [],
  currentPhase: "planning",
  keyObservations: [],
});

// On action execution
contextManager.updateSnapshot({
  completedActions: ["osa", "click", "type"],
  currentPhase: "executing",
});

// On completion
contextManager.updateSnapshot({
  currentPhase: "completed",
  keyObservations: ["Opened Safari and displayed Google"],
});
```

## Debugging and Monitoring

### Displaying Context Statistics

Statistics are output every 5 steps in debug mode (`--debug`):

```
Context stats: 18 messages, ~4500 tokens
```

### Getting Statistics

```typescript
const stats = orchestrator.getContextStats();
console.log(stats);
// {
//   messageCount: 18,
//   estimatedTokens: 4500,
//   hasSnapshot: true
// }
```

### Getting Snapshot

```typescript
const snapshot = orchestrator.getContextSnapshot();
console.log(snapshot);
// {
//   goal: "Open Safari and search Google",
//   completedActions: ["osa", "click", "type"],
//   currentPhase: "completed",
//   keyObservations: ["Opened Safari and displayed Google"]
// }
```

## Token Estimation

Token count is estimated using:

```
Estimated tokens = Total characters / 4
```

- Text parts: Count characters
- Function call/response: Count after JSON stringification
- Images: Fixed estimate of 100 tokens

## Best Practices

### 1. Appropriate MAX_MESSAGES Setting

- **Short tasks**: 12-16 messages
- **Normal tasks**: 20-24 messages (default)
- **Complex tasks**: 30-40 messages

### 2. UI Data Retrieval Frequency

- Don't call `elementsJson` if screenshot analysis is sufficient
- Fallback to `elementsJson` only after 3 consecutive failures

### 3. Preserving Important Information

- Error messages are automatically high priority
- Completion messages are also high priority
- Planning phase think messages are preserved

### 4. Context Reset

Always reset when starting a new task:

```typescript
await orchestrator.reset();
```

## Summary

This context management system enables Miki to:

1. **Efficient token usage** - Compress and remove unnecessary data
2. **Preserve important information** - Prioritize errors and completion messages
3. **Handle long-running tasks** - Manage old history with sliding window
4. **Transparency** - Visualize statistics in debug mode

This allows users to experience stable AI agent behavior even during complex, long-running tasks.
