// CLI固有の型定義

export type LogType = 'info' | 'success' | 'error' | 'hint' | 'action';

export interface LogEntry {
  type: LogType;
  message: string;
  timestamp: Date;
}

export type AgentState = 'idle' | 'running' | 'completed' | 'error';

export interface AgentStatus {
  state: AgentState;
  currentStep: number;
  maxSteps: number;
  currentGoal?: string;
}
