import { useEffect, useState, useCallback } from 'react';
import { MacOSAgent } from '../../controller/agent';
import type { LogEntry, AgentState, AgentStatus } from '../types';

export function useAgent() {
  const [agent, setAgent] = useState<MacOSAgent | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<AgentStatus>({
    state: 'idle',
    currentStep: 0,
    maxSteps: 20,
  });

  // エージェント初期化
  useEffect(() => {
    const newAgent = new MacOSAgent();

    // ログイベントのリスナー
    newAgent.on('log', (logEntry: LogEntry) => {
      setLogs((prev) => [...prev, logEntry]);
    });

    // ステップイベントのリスナー
    newAgent.on('step', (step: number) => {
      setStatus((prev) => ({ ...prev, currentStep: step }));
    });

    // 完了イベントのリスナー
    newAgent.on('completed', (message: string) => {
      setStatus((prev) => ({ ...prev, state: 'completed' }));
      setLogs((prev) => [...prev, {
        type: 'success',
        message: `タスク完了: ${message}`,
        timestamp: new Date()
      }]);
    });

    // 実行完了イベントのリスナー
    newAgent.on('runCompleted', () => {
      setStatus((prev) => ({ ...prev, state: 'idle', currentStep: 0 }));
    });

    // エラーイベントのリスナー
    newAgent.on('error', (errorMessage: string) => {
      setLogs((prev) => [...prev, {
        type: 'error',
        message: errorMessage,
        timestamp: new Date()
      }]);
    });

    // 初期化
    newAgent.init().catch((err) => {
      setLogs((prev) => [...prev, {
        type: 'error',
        message: `初期化失敗: ${err.message}`,
        timestamp: new Date()
      }]);
    });

    setAgent(newAgent);

    // クリーンアップ
    return () => {
      newAgent.destroy();
    };
  }, []);

  // ゴール実行
  const runGoal = useCallback(
    async (goal: string) => {
      if (!agent) return;

      setStatus((prev) => ({ ...prev, state: 'running', currentGoal: goal }));
      setLogs((prev) => [...prev, {
        type: 'info',
        message: `新しいゴールを開始: ${goal}`,
        timestamp: new Date()
      }]);

      try {
        await agent.run(goal);
      } catch (error: any) {
        setLogs((prev) => [...prev, {
          type: 'error',
          message: `実行エラー: ${error.message}`,
          timestamp: new Date()
        }]);
        setStatus((prev) => ({ ...prev, state: 'error' }));
      }
    },
    [agent]
  );

  // ヒント追加
  const addHint = useCallback(
    (hint: string) => {
      if (!agent) return;
      agent.addHint(hint);
    },
    [agent]
  );

  return {
    logs,
    status,
    runGoal,
    addHint,
  };
}
