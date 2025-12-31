const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("miki", {
  appName: "miki-desktop",
  start: (goal) => ipcRenderer.invoke("miki:start", goal),
  hint: (text) => ipcRenderer.invoke("miki:hint", text),
  stop: () => ipcRenderer.invoke("miki:stop"),
  reset: () => ipcRenderer.invoke("miki:reset"),
  getApiKey: () => ipcRenderer.invoke("miki:getApiKey"),
  setApiKey: (apiKey) => ipcRenderer.invoke("miki:setApiKey", apiKey),
  onBackendEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("miki:backend", listener);
    return () => ipcRenderer.removeListener("miki:backend", listener);
  }
});
