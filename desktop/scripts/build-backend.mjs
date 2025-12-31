import { build } from "esbuild";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const entry = path.join(root, "backend-src", "controller", "main.ts");
const outdir = path.join(root, "backend", "controller");
const executorDir = path.join(root, "backend", "executor");

if (!existsSync(entry)) {
  console.error(`Missing controller entry: ${entry}`);
  process.exit(1);
}

mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outfile: path.join(outdir, "index.js"),
  sourcemap: "inline",
});

if (!existsSync(executorDir)) {
  console.warn("Executor bundle not found. Put PyInstaller output in backend/executor.");
}

console.log("Backend build complete.");
