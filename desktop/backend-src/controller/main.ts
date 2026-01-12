import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import * as dotenv from "dotenv";
import { MacOSAgentOrchestrator } from "../../../src/adk/orchestrator";

type Command =
  | { type: "start"; goal: string }
  | { type: "hint"; text: string }
  | { type: "stop" }
  | { type: "reset" };

type StatusState = "idle" | "running" | "stopping";

let agent: MacOSAgentOrchestrator | null = null;
let running = false;

// デバッグモードフラグ
const debugMode = process.env.MIKI_DEBUG === "1";

if (debugMode) {
  console.error("[Controller] Debug mode enabled");
}

function send(event: string, payload: Record<string, unknown> = {}) {
  process.stdout.write(JSON.stringify({ event, ...payload }) + "\n");
}

/**
 * Sends an error event with the error message.
 * Extracts the stack trace if available, otherwise uses the error message.
 * @param error - The error to send, can be an Error object or any other value
 */
function sendError(error: unknown) {
  if (error instanceof Error) {
    send("error", { message: error.stack || error.message });
  } else {
    send("error", { message: String(error) });
  }
}

function loadEnv() {
  process.env.DOTENV_CONFIG_QUIET = "true";
  const envPath = process.env.MIKI_ENV_PATH;
  if (envPath && fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    return;
  }

  const localEnv = path.join(process.cwd(), ".env");
  if (fs.existsSync(localEnv)) {
    dotenv.config({ path: localEnv });
  }
}

function ensureAgent() {
  if (agent) return;
  const apiKey = process.env.GEMINI_API_KEY || "";
  agent = new MacOSAgentOrchestrator(apiKey, debugMode);
  agent.on("log", (payload: { type: string; message: string; timestamp: Date }) => {
    send("log", {
      ...payload,
      timestamp: payload.timestamp.toISOString(),
    });
  });
  agent.on("step", (step: number) => send("step", { step }));
  agent.on("status", (payload: { state: any }) => sendStatus(payload.state));
  agent.on("completed", (message: string) => send("completed", { message }));
  agent.on("runCompleted", () => sendStatus("idle"));
  agent.on("stopped", () => sendStatus("idle"));
  agent.on("error", (message: string) => send("error", { message }));
  agent.on("action_update", (payload: any) => send("action_update", payload));
  agent.on("thinking", (payload: any) => send("thinking", payload));
  agent.on("token_usage", (payload: any) => send("token_usage", payload));
}

function sendStatus(state: StatusState, goal?: string) {
  send("status", { state, goal });
}

async function startRun(goal: string) {
  if (running) {
    send("log", { type: "info", message: "既存のタスクを停止して新しいタスクを開始します..." });
    agent?.stop();
    // 停止を待機
    await new Promise(resolve => setTimeout(resolve, 1000));
    running = false;
  }
  loadEnv();
  running = true;
  sendStatus("running", goal);

  try {
    ensureAgent();
    // Orchestratorのinitは内部でPythonBridgeのready時に呼ばれるが、
    // 明示的に呼ぶことも可能。ただし二重初期化に注意。
    // ここでは init() が Promise を返すので待機する。
    await agent!.init();
    await agent!.run(goal);
  } catch (error) {
    sendError(error);
  } finally {
    running = false;
    sendStatus("idle");
  }
}

function handleCommand(command: Command) {
  switch (command.type) {
    case "start":
      void startRun(command.goal);
      break;
    case "hint":
      try {
        ensureAgent();
        agent!.addHint(command.text);
      } catch (error) {
        sendError(error);
      }
      break;
    case "stop":
      if (!agent || !running) {
        sendStatus("idle");
        return;
      }
      sendStatus("stopping");
      agent.stop();
      break;
    case "reset":
      if (agent) {
        void agent.reset();
      }
      sendStatus("idle");
      break;
    default:
      send("error", { message: "Unknown command." });
  }
}

loadEnv();
send("ready");

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  if (!line.trim()) return;
  try {
    const command = JSON.parse(line) as Command;
    handleCommand(command);
  } catch (error) {
    send("error", { message: `Invalid command: ${String(error)}` });
  }
});

process.on("SIGTERM", () => {
  if (agent) {
    agent.destroy();
  }
  process.exit(0);
});
