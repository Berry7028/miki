import { build } from "esbuild";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire, builtinModules } from "node:module";

const require = createRequire(import.meta.url);
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
  // 外部のsrcディレクトリからのインポートを解決するためにプラグインを使用
  plugins: [
    {
      name: "resolve-desktop-node-modules",
      setup(build) {
        build.onResolve({ filter: /^[^./]/ }, (args) => {
          // 組み込みモジュールは esbuild の標準解決に任せる
          if (args.path.startsWith("node:") || builtinModules.includes(args.path)) {
            return null;
          }
          try {
            const resolvedPath = require.resolve(args.path, { paths: [root] });
            if (path.isAbsolute(resolvedPath)) {
              return { path: resolvedPath };
            }
          } catch (e) {
            // 解決できない場合は null を返して esbuild のデフォルト解決に任せる
          }
          return null;
        });
      },
    },
  ],
});

if (!existsSync(executorDir)) {
  console.warn("Executor bundle not found. Put PyInstaller output in backend/executor.");
}

console.log("Backend build complete.");
