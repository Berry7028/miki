# JSON Validation and Retry Mechanism

## Overview
This document describes the JSON validation and retry mechanism implemented in the ADK patches module.

## Features

### 1. BuiltInCodeExecutor Disabled
The `BuiltInCodeExecutor` patch has been disabled as per requirements. The original patch that handled errors for `gemini-3-flash-preview` has been commented out in `src/adk/adk-patches.ts`.

### 2. JSON Syntax Validation
Before parsing JSON arguments in function calls, the system now validates the JSON syntax using the `validateJSON()` helper function. This prevents parse errors from being silently ignored and returns both validation status and error message in a single call.

### 3. Retry Mechanism
When a JSON parse error is detected:
- The system displays: **"このアクションは正しく実行されませんでした"**
- It sends a request to the AI with the error message and invalid JSON
- The AI is asked to correct the JSON and resend the function call
- This process can be attempted up to **3 times** (configurable via `maxAttempts`)

### 4. Maximum Retry Handling
After 3 failed attempts:
- The system displays: **"ユーザーのタスクを正しく実行できませんでした"**
- An error response is yielded to the AI
- The retry counter is reset

### 5. Debug Mode Logging
Detailed logs are only output to the console when debug mode is enabled:
- Function call detection logs
- Retry attempt information
- Invalid JSON content
- Detailed error messages

To enable debug mode, start the application with the `--debug` flag:
```bash
./dev.sh start --debug
```

## Implementation Details

### Files Modified
1. **src/adk/adk-patches.ts**
   - Added `setDebugMode()` function to control debug logging
   - Added `validateJSON()` helper function (returns both validity and error message)
   - Modified `callLlmAsync` patch to validate and retry JSON parsing
   - Disabled BuiltInCodeExecutor patch

2. **src/adk/orchestrator.ts**
   - Imports `setDebugMode` from adk-patches
   - Calls `setDebugMode()` with the debugMode flag in constructor

### Retry Tracking
Retry attempts are tracked using a `WeakMap` that maps invocation contexts to attempt counts. This ensures:
- Each invocation context has its own retry counter
- Memory is automatically cleaned up when contexts are garbage collected
- Retry counts are reset after successful parsing or max attempts

## Usage Example

### Normal Operation (Valid JSON)
```typescript
// AI sends valid JSON
part.functionCall.args = '{"x": 100, "y": 200}'
// System parses successfully
// Retry counter is reset/deleted
```

### Error with Retry (Invalid JSON)
```typescript
// AI sends invalid JSON (attempt 1)
part.functionCall.args = '{x: 100, y: 200}'  // Missing quotes
// System detects error
// Console: "このアクションは正しく実行されませんでした"
// Debug console: "[ADK PATCH] Retry attempt 1/3"
// AI receives: "JSON構文エラーが発生しました。以下のJSONを修正してください..."

// AI sends corrected JSON (attempt 2)
part.functionCall.args = '{"x": 100, "y": 200}'
// System parses successfully
// Retry counter is reset
```

### Maximum Attempts Exceeded
```typescript
// After 3 failed attempts with invalid JSON
// Console: "ユーザーのタスクを正しく実行できませんでした"
// Debug console: "[ADK PATCH] Maximum retry attempts (3) exceeded"
// AI receives: "JSON構文エラーが解決できませんでした。タスクを正しく実行できません。"
// Retry counter is reset
```

## Error Messages

### User-facing Messages
- **Success**: No message (silent success)
- **Retry**: "このアクションは正しく実行されませんでした"
- **Max Attempts**: "ユーザーのタスクを正しく実行できませんでした"

### AI-facing Messages
- **Retry**: "JSON構文エラーが発生しました。以下のJSONを修正してください。\nエラー: {error}\n不正なJSON: {json}\n\n正しいJSON形式でもう一度functionCallを送信してください。"
- **Max Attempts**: "JSON構文エラーが解決できませんでした。タスクを正しく実行できません。"

### Debug Messages (only in debug mode)
- "[ADK PATCH] Detected functionCall: {name} {args}"
- "[ADK PATCH] Retry attempt {n}/{max}"
- "[ADK PATCH] Invalid JSON: {json}"
- "[ADK PATCH] Error: {error}"
- "[ADK PATCH] Maximum retry attempts ({max}) exceeded"
