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
let pythonBin = pythonPath;
if (!fs.existsSync(pythonPath)) {
  pythonBin = isWindows ? "python.exe" : "python3";
  if (!fs.existsSync(pythonBin)) {
    pythonBin = "python";
  }
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

const result = spawnSync(pythonBin, pyinstallerArgs, { stdio: "inherit" });
if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
