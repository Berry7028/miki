import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import * as dotenv from "dotenv";
import { MacOSAgent } from "../../../src/controller/agent";

type Command =
  | { type: "start"; goal: string }
  | { type: "hint"; text: string }
  | { type: "stop" }
  | { type: "reset" };

type StatusState = "idle" | "running" | "stopping";

let agent: MacOSAgent | null = null;
let running = false;

function send(event: string, payload: Record<string, unknown> = {}) {
  process.stdout.write(JSON.stringify({ event, ...payload }) + "\n");
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
  agent = new MacOSAgent();
  agent.on("log", (payload: { type: string; message: string; timestamp: Date }) => {
    send("log", {
      ...payload,
      timestamp: payload.timestamp.toISOString(),
    });
  });
  agent.on("step", (step: number) => send("step", { step }));
  agent.on("completed", (message: string) => send("completed", { message }));
  agent.on("runCompleted", () => sendStatus("idle"));
  agent.on("stopped", () => sendStatus("idle"));
  agent.on("error", (message: string) => send("error", { message }));
}

function sendStatus(state: StatusState, goal?: string) {
  send("status", { state, goal });
}

async function startRun(goal: string) {
  if (running) {
    send("error", { message: "Agent already running." });
    return;
  }
  loadEnv();
  ensureAgent();
  running = true;
  sendStatus("running", goal);

  try {
    await agent!.init();
    await agent!.run(goal);
  } catch (error) {
    send("error", { message: error instanceof Error ? error.message : String(error) });
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
      ensureAgent();
      agent!.addHint(command.text);
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
        agent.reset();
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
