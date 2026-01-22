const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("miki", {
  appName: "miki-desktop",
  getStyleNonce: async () => {
    try {
      return await ipcRenderer.invoke("miki:getStyleNonce");
    } catch (error) {
      console.warn("Failed to get style nonce:", error);
      return "";
    }
  },
  setOverlayMousePassthrough: (ignore) => ipcRenderer.invoke("miki:setOverlayMousePassthrough", ignore),
  start: (goal) => ipcRenderer.invoke("miki:start", goal),
  hint: (text) => ipcRenderer.invoke("miki:hint", text),
  stop: () => ipcRenderer.invoke("miki:stop"),
  reset: () => ipcRenderer.invoke("miki:reset"),
  getApiKey: () => ipcRenderer.invoke("miki:getApiKey"),
  setApiKey: (apiKey) => ipcRenderer.invoke("miki:setApiKey", apiKey),
  getLocale: () => ipcRenderer.invoke("miki:getLocale"),
  setLocale: (locale) => ipcRenderer.invoke("miki:setLocale", locale),
  getSetupStatus: () => ipcRenderer.invoke("miki:getSetupStatus"),
  markSetupCompleted: () => ipcRenderer.invoke("miki:markSetupCompleted"),
  openSystemPreferences: (pane) => ipcRenderer.invoke("miki:openSystemPreferences", pane),
  onBackendEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("miki:backend", listener);
    return () => ipcRenderer.removeListener("miki:backend", listener);
  },
  onMousePos: (callback) => {
    const listener = (_event, pos) => callback(pos);
    ipcRenderer.on("miki:mouse-pos", listener);
    return () => ipcRenderer.removeListener("miki:mouse-pos", listener);
  },
  onFocusInput: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("miki:focus-input", listener);
    return () => ipcRenderer.removeListener("miki:focus-input", listener);
  },
  onChatVisibility: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("miki:chat-visibility", listener);
    return () => ipcRenderer.removeListener("miki:chat-visibility", listener);
  }
});
