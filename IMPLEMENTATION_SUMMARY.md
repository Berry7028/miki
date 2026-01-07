# Implementation Summary: Agentic Movement

## Issue Background

**Original Problem:**
The agent was executing tools without showing its thought process, resulting in behavior like:
- "ツールを実行する → 『実行しました、OKでした』で終わる"
- No task decomposition visible
- No intermediate verification
- Agent's reasoning process completely hidden from users

**Expected Behavior:**
The agent should:
1. Break down tasks into phases (Todo / In Progress / Done style)
2. Show its planning process
3. Verify results after each phase
4. Only proceed to the next phase after confirmation

## Solution Implemented

### Core Changes

#### 1. New "think" Action (`src/controller/function-declarations.ts`)
```typescript
{
  name: "think",
  description: "タスクの計画や実行後の検証を明示的に記録します...",
  parameters: {
    thought: string,  // The agent's thought content
    phase: "planning" | "verification" | "reflection"
  }
}
```

Three phases:
- **planning**: Initial task breakdown into phases
- **verification**: Result checking after each execution phase
- **reflection**: Overall review before completion

#### 2. Enhanced System Prompt (`src/controller/constants.ts`)
Added explicit workflow instructions:

```
### エージェント的な動作フロー

1. タスク分解（最初のステップ）:
   - 最初に必ず think ツール（phase: "planning"）を使用
   - 各フェーズで何を達成するか明示

2. 実行:
   - 計画したフェーズごとに必要なツールを実行

3. 検証（各フェーズ後）:
   - 各フェーズの実行後、必ず think ツール（phase: "verification"）を使用
   - スクリーンショットを見て、期待通りの結果になったか確認

4. 完了確認:
   - すべてのフェーズが完了したら think ツール（phase: "reflection"）
   - その後、done ツールで完了を報告
```

#### 3. Agent Implementation (`src/controller/agent.ts`)
- Added handling for the "think" action
- Emits "thinking" events with phase and thought content
- Phase labels are now stored in constants for maintainability:
  ```typescript
  const THINKING_PHASE_LABELS = {
    planning: "計画",
    verification: "検証", 
    reflection: "振り返り"
  };
  ```

#### 4. UI Updates (`desktop/renderer/chat.tsx`)
- Displays thinking messages with distinct beige background
- Shows phase labels (計画/検証/振り返り)
- Helper functions for cleaner code:
  - `getMessageStyle(type)`: Returns appropriate styling based on message type
  - `getMessageLabel(msg)`: Returns appropriate label text
- Clear visual hierarchy for planning → execution → verification

#### 5. Event Flow (`desktop/backend-src/controller/main.ts`)
- Backend controller listens for "thinking" events
- Forwards to all UI windows (main, chat, overlay)
- Type-safe event payload with `thought` and `phase` fields

## Example Flow

### User Input
```
User: "Safariを開いてGoogleを検索して"
```

### Agent Response (New Behavior)

```
[思考中 - 計画]
このタスクを3つのフェーズに分解します：
フェーズ1: Safariを起動する
フェーズ2: URLバーをクリックしてフォーカス
フェーズ3: "google.com"を入力してEnterを押す

[ACTION] osa: tell application "Safari" to activate

[思考中 - 検証]
Safariが正常に起動しました。メニューバーに"Safari"と表示されており、
ウィンドウが前面に来ています。次のフェーズに進みます。

[ACTION] click: (500, 80) # URLバーをクリック

[思考中 - 検証]
URLバーが正しくフォーカスされました。カーソルが点滅しており、
入力可能な状態です。

[ACTION] type: "google.com"
[ACTION] press: "enter"

[思考中 - 検証]
GoogleのページがURL遷移中です。ページのロードが完了するまで待ちます。

[思考中 - 振り返り]
すべてのフェーズが正常に完了しました：
✓ Safariの起動 - 成功
✓ URLバーへのフォーカス - 成功
✓ Googleへの遷移 - 成功
タスクの目標を達成しました。

完了しました！Safariを開いてGoogleを表示しました。
```

## Key Benefits

1. **Transparency**: Users can see the agent's reasoning at each step
2. **Reliability**: Built-in verification ensures operations completed successfully
3. **Debuggability**: When something goes wrong, it's clear at which phase
4. **Trust**: Users understand what the agent is doing and why
5. **Iterative Improvement**: Agent can self-correct based on verification results

## Testing Checklist

- [ ] Agent starts with `think(planning)` to break down tasks
- [ ] Each execution phase is followed by `think(verification)`
- [ ] Agent ends with `think(reflection)` before `done()`
- [ ] Thinking messages appear in chat UI with beige background
- [ ] Phase labels (計画/検証/振り返り) are displayed correctly
- [ ] Agent adapts plan if verification detects issues
- [ ] Complex multi-step tasks show clear progression

## Files Changed

1. `src/controller/function-declarations.ts` - Added think function
2. `src/controller/types.ts` - Added think action types
3. `src/controller/constants.ts` - System prompt + phase labels
4. `src/controller/agent.ts` - Think action handler + event emission
5. `desktop/backend-src/controller/main.ts` - Event forwarding
6. `desktop/renderer/chat.tsx` - Thinking message display
7. `desktop/renderer/types.ts` - Extended event types
8. `AGENTIC_MOVEMENT_TEST.md` - Test guide

## Build Status

✅ Backend compiled successfully  
✅ TypeScript type checking passed  
✅ Code review feedback addressed  
✅ Ready for testing

## Next Steps

1. Test with real tasks (see `AGENTIC_MOVEMENT_TEST.md`)
2. Gather user feedback on visibility and clarity
3. Adjust prompt wording if needed
4. Monitor agent adherence to workflow
5. Consider adding progress indicators (e.g., "Phase 2/3")

## Notes

- The agent's LLM (Gemini) should naturally follow the structured prompt
- If agent skips thinking steps, the prompt may need stronger emphasis
- Phase labels are now in constants for easy translation/modification
- UI helper functions make future styling changes easier
