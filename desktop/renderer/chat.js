const messagesContainer = document.querySelector("#messages");
const messageInput = document.querySelector("#message-input");
const sendBtn = document.querySelector("#send-btn");
const closeBtn = document.querySelector("#close-btn");

let conversationHistory = [];

// 自動リサイズするテキストエリア
messageInput?.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = messageInput.scrollHeight + "px";
});

// メッセージを追加
function addMessage(type, content, timestamp) {
  if (!messagesContainer) return;

  const messageEl = document.createElement("div");
  messageEl.className = "animate-fade-in";

  const time = timestamp ? new Date(timestamp).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit"
  }) : new Date().toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit"
  });

  if (type === "user") {
    messageEl.innerHTML = `
      <div class="flex justify-end">
        <div class="message-user max-w-[75%] px-3.5 py-2.5 text-sm text-white">
          <p class="whitespace-pre-wrap leading-relaxed">${escapeHtml(content)}</p>
          <p class="mt-1 text-right text-xs opacity-60">${time}</p>
        </div>
      </div>
    `;
  } else if (type === "action") {
    messageEl.innerHTML = `
      <div class="flex justify-start">
        <div class="message-action max-w-[75%] px-3 py-2 text-xs text-emerald-300">
          <div class="flex items-center gap-2">
            <svg class="h-3 w-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>${escapeHtml(content)}</span>
          </div>
        </div>
      </div>
    `;
  } else if (type === "result") {
    messageEl.innerHTML = `
      <div class="flex justify-start">
        <div class="message-ai max-w-[75%] px-3.5 py-2.5 text-sm text-slate-100">
          <p class="whitespace-pre-wrap leading-relaxed">${escapeHtml(content)}</p>
          <p class="mt-1 text-xs text-slate-400">${time}</p>
        </div>
      </div>
    `;
  } else {
    messageEl.innerHTML = `
      <div class="flex justify-start">
        <div class="message-ai max-w-[75%] px-3.5 py-2.5 text-sm text-slate-100">
          <p class="whitespace-pre-wrap leading-relaxed">${escapeHtml(content)}</p>
          <p class="mt-1 text-xs text-slate-400">${time}</p>
        </div>
      </div>
    `;
  }

  messagesContainer.appendChild(messageEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  conversationHistory.push({ type, content, timestamp: timestamp || Date.now() });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// メッセージ送信
async function sendMessage() {
  const text = messageInput?.value.trim();
  if (!text) return;

  addMessage("user", text);
  messageInput.value = "";
  messageInput.style.height = "auto";

  // バックエンドに送信
  try {
    await window.miki?.start(text);
  } catch (error) {
    console.error("Failed to send message:", error);
    addMessage("result", "エラーが発生しました: " + error.message);
  }
}

sendBtn?.addEventListener("click", sendMessage);

messageInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

closeBtn?.addEventListener("click", () => {
  window.close();
});

// バックエンドからのイベントを受信
window.miki?.onBackendEvent((payload) => {
  if (!payload) return;

  if (payload.event === "status") {
    if (payload.state === "running" && payload.goal) {
      // 実行開始時は何もしない（ユーザーメッセージで既に表示済み）
    }
  }

  if (payload.event === "step") {
    // ステップ情報は表示しない（シンプルに保つ）
  }

  if (payload.event === "log") {
    if (payload.type === "action") {
      addMessage("action", payload.message, payload.timestamp);
    }
  }

  if (payload.event === "completed") {
    const result = payload.message || payload.result || "完了しました";
    addMessage("result", result, payload.timestamp);
  }

  if (payload.event === "error") {
    addMessage("result", "エラー: " + (payload.message || "不明なエラー"), payload.timestamp);
  }
});

// 初期メッセージ（オプション）
// addMessage("result", "こんにちは！何かお手伝いできることはありますか？");
