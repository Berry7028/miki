# リポジトリガイドライン

## プロジェクト構造およびモジュールの整理
- `desktop/`: Electron デスクトップアプリ。
  - `desktop/main.js`: メインプロセス（ウィンドウ＋バックエンド起動）。
  - `desktop/preload.js`: `contextBridge` によるセキュアブリッジ。
  - `desktop/renderer/`: UI（`index.html`, `renderer.js`）。Tailwind CDN 使用。
  - `desktop/backend-src/`: デスクトップビルド用 Node コントローラーエントリ。
  - `desktop/backend/`: バンドル済みコントローラー／エグゼキューター出力（gitignore 済み）。
- `src/controller/`: LLM 制御ロジック（デスクトップバックエンドビルドと共通）。
- `src/executor/`: macOS オートメーションエグゼキューター（Python）。
- `venv/`: Python 仮想環境。

## ビルド・テスト・開発コマンド
- `npm --prefix desktop install`：デスクトップ依存パッケージインストール。
- `npm --prefix desktop run dev`：Electron アプリ起動。
- `npm --prefix desktop run build:backend`：デスクトップコントローラーバンドル。
- `npm --prefix desktop run dist`：デスクトップ配布ビルド。

## コーディング規約・命名規則
- JSON/HTML は 2 スペースインデント。JS は既存のダブルクォートスタイルを踏襲。
- ファイル名は小文字＆説明的（例：`desktop/renderer/renderer.js`）。
- メインプロセスでは簡潔で分かりやすい関数名（`createWindow`, `ensureController` など）を使用。
- TypeScript/Python は既存ツール（`prettier`, `autopep8` など）で整形。
- リポジトリ内の既存ドキュメントで特定のコマンドが指定されている場合はそれを優先し、それ以外は Bun ベースのツールチェーンを優先する。

## Bun ベースのツールチェーン
Node.js や npm/pnpm/vite よりも Bun を優先する。

- `bun <file>` を `node <file>` / `ts-node <file>` の代わりに使う
- `bun test` を `jest` / `vitest` の代わりに使う
- `bun build <file.html|file.ts|file.css>` を `webpack` / `esbuild` の代わりに使う
- `bun install` を `npm install` / `yarn install` / `pnpm install` の代わりに使う
- `bun run <script>` を `npm run <script>` / `yarn run <script>` / `pnpm run <script>` の代わりに使う
- `bunx <package> <command>` を `npx <package> <command>` の代わりに使う
- Bun は `.env` を自動で読み込むため `dotenv` は使わない

### APIs
- `Bun.serve()` は WebSocket/HTTPS/routes をサポートするため、`express` は使わない
- SQLite は `bun:sqlite` を使い、`better-sqlite3` は使わない
- Redis は `Bun.redis` を使い、`ioredis` は使わない
- Postgres は `Bun.sql` を使い、`pg` / `postgres.js` は使わない
- `WebSocket` は組み込みを使い、`ws` は使わない
- `node:fs` の readFile/writeFile より `Bun.file` を優先
- `execa` の代わりに `Bun.$` を使う

### Testing
`bun test` を使う。

```ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

### Frontend
`Bun.serve()` と HTML imports を使う。`vite` は使わない。HTML imports は React/CSS/Tailwind をフルサポート。

Server:

```ts
import index from "./index.html";

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    },
  },
  development: {
    hmr: true,
    console: true,
  },
});
```

HTML は .tsx/.jsx/.js を直接 import でき、Bun のバンドラが自動でトランスパイル＆バンドルする。`<link>` の CSS も Bun が束ねる。

```html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

`frontend.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";

import "./index.css";

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

起動:

```sh
bun --hot ./index.ts
```

詳細は `node_modules/bun-types/docs/**.mdx` を参照。

## テストガイドライン
自動テストは未導入。テストを追加する場合は以下の方針で：
- 対象階層の `desktop/package.json` に `test` スクリプトを追加。
- `desktop/renderer/__tests__/` など明確な場所に配置。
- ファイル名は `*.test.js` のように命名。

## コミット＆プルリクエストガイドライン
直近のコミット履歴では慣習的プレフィックス（例：`feat:`）と短い要約が混在。
このパターンを踏襲：
- タイプ（`feat:`, `fix:`）付きまたは短い現在形要約を先頭行に。
- 1 行目は約 72 文字以内を目安に。

プルリクエストには以下を含めること：
- 振る舞いの簡潔な記述。
- `desktop/renderer/` の UI 変更にはスクリーンショット添付。
- 関連する Issue リンク。

## セキュリティ＆設定のポイント
- `desktop/main.js` では `nodeIntegration: false` と `contextIsolation: true` を維持。
- 新しい外部アセットが必要なら `desktop/renderer/index.html` の CSP を更新。
