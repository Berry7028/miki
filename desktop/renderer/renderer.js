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

// Setup Wizard
const setupModal = document.querySelector("#setup-modal");
const setupSteps = document.querySelectorAll(".setup-step");
const setupPrevBtn = document.querySelector("#setup-prev-btn");
const setupNextBtn = document.querySelector("#setup-next-btn");
const setupFinishBtn = document.querySelector("#setup-finish-btn");
const setupApiInput = document.querySelector("#setup-api-input");
const setupApiStatus = document.querySelector("#setup-api-status");
const setupAccessibilityGranted = document.querySelector("#setup-accessibility-granted");
const setupAccessibilityDenied = document.querySelector("#setup-accessibility-denied");
const setupScreenGranted = document.querySelector("#setup-screen-granted");
const setupScreenDenied = document.querySelector("#setup-screen-denied");
const setupOpenAccessibilityBtn = document.querySelector("#setup-open-accessibility-btn");
const setupOpenScreenBtn = document.querySelector("#setup-open-screen-btn");

let currentSetupStep = 0;
let setupStatus = null;

function showSetupModal() {
  if (setupModal) {
    setupModal.classList.remove("hidden");
    setupModal.classList.add("flex");
  }
}

function hideSetupModal() {
  if (setupModal) {
    setupModal.classList.add("hidden");
    setupModal.classList.remove("flex");
  }
}

function showSetupStep(index) {
  setupSteps.forEach((step, i) => {
    if (i === index) {
      step.classList.remove("hidden");
    } else {
      step.classList.add("hidden");
    }
  });

  if (setupPrevBtn) {
    if (index === 0) {
      setupPrevBtn.classList.add("hidden");
    } else {
      setupPrevBtn.classList.remove("hidden");
    }
  }

  if (setupNextBtn && setupFinishBtn) {
    if (index === setupSteps.length - 1) {
      setupNextBtn.classList.add("hidden");
      setupFinishBtn.classList.remove("hidden");
    } else {
      setupNextBtn.classList.remove("hidden");
      setupFinishBtn.classList.add("hidden");
    }
  }

  if (index === 1) {
    updateAccessibilityStatus();
  } else if (index === 2) {
    updateScreenStatus();
  }
}

async function updateAccessibilityStatus() {
  const status = await window.miki?.getSetupStatus();
  if (status?.hasAccessibility) {
    setupAccessibilityGranted?.classList.remove("hidden");
    setupAccessibilityDenied?.classList.add("hidden");
  } else {
    setupAccessibilityGranted?.classList.add("hidden");
    setupAccessibilityDenied?.classList.remove("hidden");
  }
}

async function updateScreenStatus() {
  const status = await window.miki?.getSetupStatus();
  if (status?.hasScreenRecording) {
    setupScreenGranted?.classList.remove("hidden");
    setupScreenDenied?.classList.add("hidden");
  } else {
    setupScreenGranted?.classList.add("hidden");
    setupScreenDenied?.classList.remove("hidden");
  }
}

setupPrevBtn?.addEventListener("click", () => {
  if (currentSetupStep > 0) {
    currentSetupStep--;
    showSetupStep(currentSetupStep);
  }
});

setupNextBtn?.addEventListener("click", async () => {
  if (currentSetupStep === 0) {
    const key = sanitizeInput(setupApiInput?.value);
    if (!key) {
      if (setupApiStatus) {
        setupApiStatus.textContent = "APIキーを入力してください。";
      }
      return;
    }
    await window.miki?.setApiKey(key);
    if (setupApiStatus) {
      setupApiStatus.textContent = "";
    }
  }

  if (currentSetupStep === 1) {
    const status = await window.miki?.getSetupStatus();
    if (!status?.hasAccessibility) {
      if (setupApiStatus) {
        setupApiStatus.textContent = "アクセシビリティ権限を付与してください。";
      }
      return;
    }
  }

  if (currentSetupStep < setupSteps.length - 1) {
    currentSetupStep++;
    showSetupStep(currentSetupStep);
  }
});

setupFinishBtn?.addEventListener("click", async () => {
  const status = await window.miki?.getSetupStatus();
  if (!status?.hasScreenRecording) {
    alert("画面収録権限を付与してください。");
    return;
  }

  await window.miki?.markSetupCompleted();
  hideSetupModal();
  appendLog({
    type: "success",
    time: toTime(),
    message: "セットアップが完了しました。"
  });
});

setupOpenAccessibilityBtn?.addEventListener("click", () => {
  window.miki?.openSystemPreferences("accessibility");
  setTimeout(updateAccessibilityStatus, 2000);
});

setupOpenScreenBtn?.addEventListener("click", () => {
  window.miki?.openSystemPreferences("screen-recording");
  setTimeout(updateScreenStatus, 2000);
});

// Check setup status on load
window.miki?.getSetupStatus().then((status) => {
  setupStatus = status;
  if (status?.needsSetup) {
    showSetupModal();
    showSetupStep(0);
  }
});
