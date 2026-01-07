const { contextBridge, ipcRenderer } = require("electron");

// Get nonce from main process
let styleNonce = "";
ipcRenderer.invoke("miki:getStyleNonce").then(nonce => {
  styleNonce = nonce;
}).catch(() => {
  console.warn("Failed to get style nonce");
});

contextBridge.exposeInMainWorld("miki", {
  appName: "miki-desktop",
  getStyleNonce: () => styleNonce,
  start: (goal) => ipcRenderer.invoke("miki:start", goal),
  hint: (text) => ipcRenderer.invoke("miki:hint", text),
  stop: () => ipcRenderer.invoke("miki:stop"),
  reset: () => ipcRenderer.invoke("miki:reset"),
  getApiKey: () => ipcRenderer.invoke("miki:getApiKey"),
  setApiKey: (apiKey) => ipcRenderer.invoke("miki:setApiKey", apiKey),
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
  }
});
