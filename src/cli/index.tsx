#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { App } from './components/App';
import * as dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

// Inkアプリケーションをレンダリング
const { unmount, waitUntilExit } = render(<App />);

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => {
  unmount();
  process.exit(0);
});

process.on('SIGTERM', () => {
  unmount();
  process.exit(0);
});

// アプリケーションの終了を待つ
await waitUntilExit();
