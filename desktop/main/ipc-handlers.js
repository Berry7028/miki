// IPC Handlers
// 責務: IPCハンドラーの登録

const { ipcMain } = require("electron");

function setupIPCHandlers(controllerManager, securityManager, cspManager) {
  ipcMain.handle("miki:start", (_event, goal) => {
    controllerManager.sendToController({ type: "start", goal });
  });

  ipcMain.handle("miki:hint", (_event, text) => {
    controllerManager.sendToController({ type: "hint", text });
  });

  ipcMain.handle("miki:stop", () => {
    controllerManager.sendToController({ type: "stop" });
  });

  ipcMain.handle("miki:reset", () => {
    controllerManager.sendToController({ type: "reset" });
  });

  ipcMain.handle("miki:getApiKey", () => securityManager.readApiKey());

  ipcMain.handle("miki:setApiKey", (_event, apiKey) => {
    securityManager.writeApiKey(apiKey);
    return true;
  });

  ipcMain.handle("miki:getSetupStatus", () => securityManager.getSetupStatus());

  ipcMain.handle("miki:markSetupCompleted", () => {
    securityManager.markSetupCompleted();
    return true;
  });

  ipcMain.handle("miki:openSystemPreferences", (_event, pane) => {
    securityManager.openSystemPreferences(pane);
    return true;
  });

  ipcMain.handle("miki:getStyleNonce", (event) => {
    const webContentsId = event.sender.id;
    return cspManager.getNonceForWindow(webContentsId);
  });
}

module.exports = { setupIPCHandlers };
