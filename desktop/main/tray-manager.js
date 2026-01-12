// Tray Manager
// 責務: トレイアイコンの管理

const { Tray, Menu, nativeImage } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

class TrayManager {
  constructor(windowManager, onQuit) {
    this.windowManager = windowManager;
    this.onQuit = onQuit;
    this.tray = null;
  }

  createTray() {
    const iconPath = path.join(__dirname, "../renderer/icon.png");
    let icon;
    if (fs.existsSync(iconPath)) {
      icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
      icon.setTemplateImage(true);
      this.tray = new Tray(icon);
    } else {
      icon = nativeImage.createEmpty();
      this.tray = new Tray(icon);
      this.tray.setTitle("miki");
    }

    this.tray.setToolTip("miki");

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Settings",
        click: () => {
          const mainWindow = this.windowManager.getMainWindow();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            this.windowManager.createMainWindow();
          }
        }
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          this.onQuit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }
}

module.exports = { TrayManager };
