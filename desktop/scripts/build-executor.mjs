import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const venvDir = path.join(rootDir, "venv");
const isWindows = process.platform === "win32";
const pythonPath = isWindows
  ? path.join(venvDir, "Scripts", "python.exe")
  : path.join(venvDir, "bin", "python");
const candidates = [];
if (fs.existsSync(pythonPath)) {
  candidates.push(pythonPath);
}
if (isWindows) {
  candidates.push("python.exe", "python");
} else {
  candidates.push("python3", "python");
}
const pyinstallerArgs = [
  "-m",
  "pyinstaller",
  "--name",
  "miki-executor",
  "--onedir",
  path.join(rootDir, "src", "executor", "main.py"),
  "--distpath",
  path.join(rootDir, "desktop", "backend", "executor"),
  "-y"
];

let result;
for (const candidate of candidates) {
  result = spawnSync(candidate, pyinstallerArgs, { stdio: "inherit" });
  if (!result.error || result.error.code !== "ENOENT") {
    break;
  }
}
if (!result) {
  console.error("Python executable not found.");
  process.exit(1);
}
if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
