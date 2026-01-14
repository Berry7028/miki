# Test Plan for JSON Validation and Retry Mechanism

## Overview
This document provides a test plan for manually verifying the JSON validation and retry mechanism implementation.

## Prerequisites
- macOS system
- Python virtual environment set up
- API key configured
- Ability to run the application in debug mode

## Test Scenarios

### Test 1: Normal Operation (Valid JSON)
**Objective**: Verify that valid JSON is parsed successfully without any retry attempts.

**Steps**:
1. Start the application: `./dev.sh start --debug`
2. Request a simple task (e.g., "Click at position 500, 500")
3. Monitor console output

**Expected Results**:
- Function call is processed normally
- No error messages appear
- Debug logs show function call detection (if debug mode is on)
- Task completes successfully

**Success Criteria**:
- ✓ No retry messages
- ✓ No error messages
- ✓ Task completes as expected

---

### Test 2: JSON Parse Error with Retry
**Objective**: Verify that invalid JSON triggers the retry mechanism.

**Note**: This test requires the AI to produce invalid JSON, which is difficult to trigger naturally. This scenario is more likely to occur in edge cases.

**Steps**:
1. Start the application in debug mode: `./dev.sh start --debug`
2. Observe the behavior if the AI produces invalid JSON

**Expected Results** (if invalid JSON is produced):
- Console shows: "このアクションは正しく実行されませんでした"
- Debug console shows:
  - "[ADK PATCH] JSON parse error detected: {error}"
  - "[ADK PATCH] Retry attempt {n}/3"
  - "[ADK PATCH] Invalid JSON: {json}"
- AI receives error message with details
- Retry counter increments

**Success Criteria**:
- ✓ Error message displayed
- ✓ Debug logs show retry information (in debug mode)
- ✓ AI receives correction request
- ✓ System attempts to recover

---

### Test 3: Maximum Retry Attempts Exceeded
**Objective**: Verify behavior when 3 consecutive JSON parse errors occur.

**Note**: This is an extreme edge case that should rarely occur in production.

**Steps**:
1. Start the application in debug mode: `./dev.sh start --debug`
2. If the system encounters 3 consecutive JSON errors (very rare)

**Expected Results**:
- After 3rd attempt, console shows: "ユーザーのタスクを正しく実行できませんでした"
- Debug console shows: "[ADK PATCH] Maximum retry attempts (3) exceeded"
- AI receives final error message
- Retry counter is reset

**Success Criteria**:
- ✓ Final error message displayed after 3 attempts
- ✓ Debug logs show max attempts exceeded
- ✓ System stops retrying
- ✓ Retry counter is cleaned up

---

### Test 4: Debug Mode Off
**Objective**: Verify that detailed logs are not shown when debug mode is disabled.

**Steps**:
1. Start the application without debug flag: `./dev.sh start`
2. Perform various tasks
3. Monitor console output

**Expected Results**:
- Function call detection logs are NOT shown
- Only user-facing error messages appear (if errors occur)
- No detailed debug information in console

**Success Criteria**:
- ✓ No "[ADK PATCH]" prefixed messages
- ✓ No function call detection logs
- ✓ Only essential error messages shown

---

### Test 5: Debug Mode On
**Objective**: Verify that detailed logs appear when debug mode is enabled.

**Steps**:
1. Start the application with debug flag: `./dev.sh start --debug`
2. Perform various tasks
3. Monitor console output

**Expected Results**:
- Function call detection logs ARE shown
- Detailed debug information appears
- All "[ADK PATCH]" prefixed messages are visible

**Success Criteria**:
- ✓ "[ADK PATCH] Detected functionCall" messages appear
- ✓ Detailed error information shown when errors occur
- ✓ Retry attempt details visible

---

### Test 6: BuiltInCodeExecutor Disabled
**Objective**: Verify that the BuiltInCodeExecutor patch is disabled.

**Steps**:
1. Review the code in `src/adk/adk-patches.ts`
2. Confirm lines 159-173 are commented out
3. Run the application and verify it works without the patch

**Expected Results**:
- BuiltInCodeExecutor patch code is commented out
- Application functions normally without the patch

**Success Criteria**:
- ✓ Code is commented out in source
- ✓ No BuiltInCodeExecutor errors occur
- ✓ Application runs successfully

---

## Manual Verification Checklist

### Code Review
- [ ] `src/adk/adk-patches.ts` has `setDebugMode()` function
- [ ] `validateJSON()` helper function exists (returns {valid, error})
- [ ] BuiltInCodeExecutor patch is commented out
- [ ] Retry logic uses WeakMap for tracking
- [ ] Max attempts is set to 3
- [ ] Error messages are in Japanese as specified
- [ ] Debug logs are conditional on debugMode flag
- [ ] Error IDs are descriptive for debugging

### Orchestrator Integration
- [ ] `src/adk/orchestrator.ts` imports `setDebugMode`
- [ ] Constructor calls `setDebugMode(debugMode)`
- [ ] Debug mode flag is passed correctly

### Error Messages
- [ ] Retry message: "このアクションは正しく実行されませんでした"
- [ ] Max attempts message: "ユーザーのタスクを正しく実行できませんでした"
- [ ] AI receives detailed error information
- [ ] Debug logs only appear in debug mode

### Documentation
- [ ] `docs/json-validation-retry.md` exists
- [ ] Documentation covers all features
- [ ] Usage examples are clear
- [ ] Error messages are documented

## Notes for Testers

### Simulating Invalid JSON
It's difficult to force the AI to produce invalid JSON naturally. Most tests will verify the normal operation path. The retry mechanism serves as a safety net for rare edge cases.

### Debug Mode Commands
```bash
# Start in debug mode
./dev.sh start --debug

# Start normally (no debug)
./dev.sh start
```

### Monitoring Logs
- Console messages will appear in the terminal where the app is running
- User-facing messages appear in normal mode
- Debug logs only appear with `--debug` flag

### Known Limitations
- The retry mechanism depends on the AI's ability to correct the JSON
- After 3 attempts, the task will fail
- This is a defensive mechanism for edge cases, not normal operation

## Conclusion
The implementation provides robust error handling for JSON parse errors while maintaining clean console output in production mode. The retry mechanism gives the AI multiple chances to correct mistakes, improving overall reliability.
