#!/usr/bin/env bun
import React from "react";
import { render } from "ink";
import { App } from "./components/App";
import * as dotenv from "dotenv";

// 環境変数の読み込み
dotenv.config();

// APIキーの必須チェック
if (!process.env.GEMINI_API_KEY) {
  console.error("エラー: GEMINI_API_KEY環境変数が設定されていません。");
  console.error(".envファイルにGEMINI_API_KEYを設定してください。");
  process.exit(1);
}

// Inkアプリケーションをレンダリング
const { unmount, waitUntilExit } = render(<App />);

// プロセス終了時のクリーンアップ
process.on("SIGINT", () => {
  unmount();
  process.exit(0);
});

process.on("SIGTERM", () => {
  unmount();
  process.exit(0);
});

// アプリケーションの終了を待つ
await waitUntilExit();
