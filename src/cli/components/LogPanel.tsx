import React from 'react';
import { Box, Text } from 'ink';
import type { LogEntry } from '../types';

interface LogPanelProps {
  logs: LogEntry[];
  maxLogs?: number;
}

export const LogPanel: React.FC<LogPanelProps> = ({ logs, maxLogs = 100 }) => {
  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'info':
        return 'white';
      case 'success':
        return 'green';
      case 'error':
        return 'red';
      case 'hint':
        return 'yellow';
      case 'action':
        return 'cyan';
      case 'thought':
        return 'gray';
      default:
        return 'white';
    }
  };

  const getLogPrefix = (type: LogEntry['type'], isComplete?: boolean) => {
    switch (type) {
      case 'info':
        return '[INFO]';
      case 'success':
        return '[SUCCESS]';
      case 'error':
        return '[ERROR]';
      case 'hint':
        return '[HINT]';
      case 'action':
        return '[ACTION]';
      case 'thought':
        return isComplete ? '✅ [THOUGHT COMPLETE]' : '🧠 [THINKING]';
      default:
        return '';
    }
  };

  // 最新のログのみ保持
  const displayLogs = logs.slice(-maxLogs);

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      {displayLogs.length === 0 ? (
        <Text dimColor>ログがまだありません。ゴールを入力して開始してください。</Text>
      ) : (
        displayLogs.map((log, index) => {
          const isThought = log.type === 'thought';
          const displayMessage = isThought && log.isComplete 
            ? (log.message.split('\n')[0] || '思考が完了しました') 
            : log.message;

          return (
            <Box key={`${log.timestamp.getTime()}-${index}`} marginBottom={0} flexDirection="column">
              <Text color={getLogColor(log.type)}>
                <Text bold>{getLogPrefix(log.type, log.isComplete)}</Text> {displayMessage}
              </Text>
            </Box>
          );
        })
      )}
    </Box>
  );
};
