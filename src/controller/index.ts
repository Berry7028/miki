// ⚠️ このファイルは非推奨です
// CLI型インターフェースに移行しました。
// 新しいエントリーポイントは src/cli/index.tsx です。
// `bun run start` で起動してください。

/*
import * as dotenv from "dotenv";
import { MacOSAgent } from "./agent";

dotenv.config();

async function main() {
  const agent = new MacOSAgent();
  await agent.init();

  const goal = process.argv.slice(2).join(" ") || "YouTubeを開いて、'猫'を検索してください。";
  await agent.run(goal);
}

main().catch(console.error);
*/

