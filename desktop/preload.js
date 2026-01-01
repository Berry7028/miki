const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("miki", {
  appName: "miki-desktop",
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
  }
});
