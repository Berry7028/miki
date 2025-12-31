const appNameEl = document.querySelector("#app-name");
const goalInput = document.querySelector("#goal-input");
const hintInput = document.querySelector("#hint-input");
const startBtn = document.querySelector("#start-btn");
const stopBtn = document.querySelector("#stop-btn");
const resetBtn = document.querySelector("#reset-btn");
const hintBtn = document.querySelector("#hint-btn");
const apiKeyInput = document.querySelector("#api-key-input");
const saveKeyBtn = document.querySelector("#save-key-btn");
const saveKeyStatus = document.querySelector("#save-key-status");
const statusStateEl = document.querySelector("#status-state");
const statusStepEl = document.querySelector("#status-step");
const statusGoalEl = document.querySelector("#status-goal");
const logList = document.querySelector("#log-list");
const clearLogBtn = document.querySelector("#clear-log-btn");

if (appNameEl && window.miki) {
  appNameEl.textContent = window.miki.appName;
}

const logColors = {
  info: "text-slate-200",
  success: "text-emerald-200",
  error: "text-rose-200",
  hint: "text-amber-200",
  action: "text-sky-200"
};

const stateLabels = {
  idle: "idle",
  running: "running",
  stopping: "stopping"
};

function appendLog(entry) {
  if (!logList) return;
  const item = document.createElement("li");
  const color = logColors[entry.type] || "text-slate-200";
  item.className = `rounded-lg bg-white/5 px-3 py-2 ${color}`;
  item.textContent = `[${entry.time}] ${entry.message}`;
  logList.prepend(item);

  const items = logList.querySelectorAll("li");
  if (items.length > 120) {
    items[items.length - 1].remove();
  }
}

function setStatus(state, goal) {
  if (statusStateEl) {
    statusStateEl.textContent = stateLabels[state] || state;
  }
  if (statusGoalEl) {
    statusGoalEl.textContent = goal ? `ゴール: ${goal}` : "";
  }
}

function setStep(step) {
  if (statusStepEl) {
    statusStepEl.textContent = String(step);
  }
}

function toTime(value) {
  if (!value) {
    return new Date().toLocaleTimeString();
  }
  return new Date(value).toLocaleTimeString();
}

function sanitizeInput(input) {
  return input?.trim() ?? "";
}

function disableRunning(isRunning) {
  if (startBtn) startBtn.disabled = isRunning;
  if (hintBtn) hintBtn.disabled = !isRunning;
  if (stopBtn) stopBtn.disabled = !isRunning;
  if (resetBtn) resetBtn.disabled = false;
}

startBtn?.addEventListener("click", () => {
  const goal = sanitizeInput(goalInput?.value);
  if (!goal) {
    appendLog({ type: "error", time: toTime(), message: "ゴールを入力してください。" });
    return;
  }
  window.miki?.start(goal);
  disableRunning(true);
});

stopBtn?.addEventListener("click", () => {
  window.miki?.stop();
});

resetBtn?.addEventListener("click", () => {
  window.miki?.reset();
  setStep(0);
  setStatus("idle");
  disableRunning(false);
});

hintBtn?.addEventListener("click", () => {
  const hint = sanitizeInput(hintInput?.value);
  if (!hint) return;
  window.miki?.hint(hint);
  hintInput.value = "";
});

saveKeyBtn?.addEventListener("click", async () => {
  const key = sanitizeInput(apiKeyInput?.value);
  if (!key) {
    if (saveKeyStatus) {
      saveKeyStatus.textContent = "APIキーを入力してください。";
    }
    return;
  }
  await window.miki?.setApiKey(key);
  if (saveKeyStatus) {
    saveKeyStatus.textContent = "保存しました。";
  }
  apiKeyInput.value = "";
});

clearLogBtn?.addEventListener("click", () => {
  if (logList) {
    logList.innerHTML = "";
  }
});

window.miki?.onBackendEvent((payload) => {
  if (!payload) return;
  if (payload.event === "status") {
    setStatus(payload.state, payload.goal);
    if (payload.state === "running") {
      disableRunning(true);
    }
    if (payload.state === "idle") {
      disableRunning(false);
    }
  }
  if (payload.event === "step") {
    setStep(payload.step);
  }
  if (payload.event === "log") {
    appendLog({
      type: payload.type,
      time: toTime(payload.timestamp),
      message: payload.message
    });
  }
  if (payload.event === "completed") {
    appendLog({
      type: "success",
      time: toTime(),
      message: payload.message || "完了"
    });
    disableRunning(false);
  }
  if (payload.event === "error") {
    appendLog({
      type: "error",
      time: toTime(),
      message: payload.message || "エラー"
    });
  }
});

disableRunning(false);

window.miki?.getApiKey().then((value) => {
  if (apiKeyInput && value) {
    apiKeyInput.value = value;
  }
});
