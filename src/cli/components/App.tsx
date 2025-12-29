import React from 'react';
import { Box, Text } from 'ink';
import { useAgent } from '../hooks/useAgent';
import { LogPanel } from './LogPanel';
import { InputPanel } from './InputPanel';
import { StatusBar } from './StatusBar';

export const App: React.FC = () => {
  const { logs, status, runGoal, addHint } = useAgent();

  const handleInputSubmit = (input: string) => {
    if (status.state === 'idle' || status.state === 'completed') {
      // 新規ゴールを開始
      runGoal(input);
    } else if (status.state === 'running') {
      // 実行中のヒント追加
      addHint(input);
    }
  };

  return (
    <Box flexDirection="column" height="100%">
      {/* ヘッダー */}
      <Box borderStyle="double" paddingX={1} marginBottom={1}>
        <Text bold color="cyan">
          🤖 miki - MacOS 自動操作エージェント CLI
        </Text>
      </Box>

      {/* メインコンテンツエリア（スプリットビュー） */}
      <Box flexDirection="column" flexGrow={1}>
        {/* ログパネル（上部70%） */}
        <Box flexDirection="column" flexGrow={7} borderStyle="single" marginBottom={1}>
          <Box paddingX={1} borderStyle="single" borderBottom>
            <Text bold color="yellow">📋 ログ</Text>
          </Box>
          <LogPanel logs={logs} />
        </Box>

        {/* 入力パネル（下部20%） */}
        <Box flexDirection="column" flexGrow={2} marginBottom={1}>
          <InputPanel state={status.state} onSubmit={handleInputSubmit} />
        </Box>

        {/* ステータスバー（最下部10%） */}
        <Box flexDirection="column">
          <StatusBar status={status} />
        </Box>
      </Box>
    </Box>
  );
};
