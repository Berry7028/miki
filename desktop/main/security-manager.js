// Security Manager
// 責務: APIキーの暗号化、権限チェック、セットアップ状態管理

const fs = require("node:fs");
const path = require("node:path");
const { systemPreferences, shell, safeStorage, app } = require("electron");

class SecurityManager {
  constructor() {
    this.userDataPath = app.getPath("userData");
    this.ensureEnvDir();
  }

  ensureEnvDir() {
    const dir = this.userDataPath;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  envFilePath() {
    return path.join(this.userDataPath, ".env");
  }

  secureKeyPath() {
    return path.join(this.userDataPath, ".api_key.enc");
  }

  setupFlagPath() {
    return path.join(this.userDataPath, ".setup_completed");
  }

  readApiKey() {
    // Try to read from secure storage first
    const securePath = this.secureKeyPath();
    if (fs.existsSync(securePath)) {
      try {
        const encryptedData = fs.readFileSync(securePath);
        if (!safeStorage.isEncryptionAvailable()) {
          console.error("Encryption not available but encrypted key exists. Cannot decrypt.");
          return "";
        }
        const decrypted = safeStorage.decryptString(encryptedData);
        return decrypted.trim();
      } catch (err) {
        console.error("Failed to decrypt API key:", err);
        return "";
      }
    }

    // Fallback: migrate from old plain text .env file
    const envPath = this.envFilePath();
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, "utf-8");
        const match = content.match(/^GEMINI_API_KEY=(.*)$/m);
        if (match) {
          const apiKey = match[1].trim();
          // Migrate to secure storage
          if (apiKey && safeStorage.isEncryptionAvailable()) {
            const encrypted = safeStorage.encryptString(apiKey);
            fs.writeFileSync(securePath, encrypted);

            // Verify the encrypted file can be read back before deleting plain text
            try {
              const verifyData = fs.readFileSync(securePath);
              const verifyDecrypted = safeStorage.decryptString(verifyData);
              if (verifyDecrypted.trim() === apiKey) {
                // Migration successful, delete old plain text file
                fs.unlinkSync(envPath);
              } else {
                console.error("Migration verification failed: decrypted value doesn't match");
              }
            } catch (verifyErr) {
              console.error("Migration verification failed:", verifyErr);
              // Don't delete the plain text file if verification fails
            }
          }
          return apiKey;
        }
      } catch (err) {
        console.error("Failed to migrate API key:", err);
      }
    }

    return "";
  }

  writeApiKey(apiKey) {
    const value = (apiKey || "").trim();

    if (!safeStorage.isEncryptionAvailable()) {
      console.error("Encryption not available, cannot store API key securely");
      return;
    }

    const securePath = this.secureKeyPath();
    const envPath = this.envFilePath();

    if (!value) {
      // Delete the secure file if API key is empty
      if (fs.existsSync(securePath)) {
        fs.unlinkSync(securePath);
      }
      // Also delete old .env file if it exists
      if (fs.existsSync(envPath)) {
        fs.unlinkSync(envPath);
      }
      return;
    }

    // Encrypt and store the API key
    const encrypted = safeStorage.encryptString(value);
    fs.writeFileSync(securePath, encrypted);

    // Remove old plain text .env file if it exists
    if (fs.existsSync(envPath)) {
      fs.unlinkSync(envPath);
    }
  }

  isSetupCompleted() {
    return fs.existsSync(this.setupFlagPath());
  }

  markSetupCompleted() {
    fs.writeFileSync(this.setupFlagPath(), String(Date.now()), "utf-8");
  }

  checkAccessibilityPermission() {
    if (process.platform !== "darwin") {
      return true;
    }
    try {
      const trusted = systemPreferences.isTrustedAccessibilityClient(false);
      return trusted;
    } catch (error) {
      console.error("Failed to check accessibility permission:", error);
      return false;
    }
  }

  checkScreenRecordingPermission() {
    if (process.platform !== "darwin") {
      return true;
    }
    try {
      const status = systemPreferences.getMediaAccessStatus("screen");
      return status === "granted";
    } catch (error) {
      console.error("Failed to check screen recording permission:", error);
      return false;
    }
  }

  openSystemPreferences(pane) {
    if (process.platform !== "darwin") {
      return;
    }
    if (pane === "accessibility") {
      shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility");
    } else if (pane === "screen-recording") {
      shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
    }
  }

  getSetupStatus() {
    const apiKey = this.readApiKey();
    const hasApiKey = !!apiKey;
    const hasAccessibility = this.checkAccessibilityPermission();
    const hasScreenRecording = this.checkScreenRecordingPermission();
    const setupCompleted = this.isSetupCompleted();

    return {
      setupCompleted,
      hasApiKey,
      hasAccessibility,
      hasScreenRecording,
      needsSetup: !setupCompleted || !hasApiKey || !hasAccessibility || !hasScreenRecording
    };
  }
}

module.exports = { SecurityManager };
