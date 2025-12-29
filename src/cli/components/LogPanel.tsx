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
      default:
        return 'white';
    }
  };

  const getLogPrefix = (type: LogEntry['type']) => {
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
        displayLogs.map((log, index) => (
          <Box key={`${log.timestamp.getTime()}-${index}`} marginBottom={0}>
            <Text color={getLogColor(log.type)}>
              <Text bold>{getLogPrefix(log.type)}</Text> {log.message}
            </Text>
          </Box>
        ))
      )}
    </Box>
  );
};
