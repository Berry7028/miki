// CSP Manager
// 責務: CSPヘッダーの管理とノンス生成

const { session } = require("electron");
const crypto = require("node:crypto");

class CSPManager {
  constructor() {
    this.nonces = new Map(); // Map to store nonces per webContents ID
  }

  generateNonce() {
    return crypto.randomBytes(16).toString("base64");
  }

  setNonceForWindow(webContents) {
    const nonce = this.generateNonce();
    this.nonces.set(webContents.id, nonce);
    return nonce;
  }

  getNonceForWindow(webContentsId) {
    return this.nonces.get(webContentsId) || "";
  }

  deleteNonce(webContentsId) {
    this.nonces.delete(webContentsId);
  }

  setupHeaders() {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      // Skip if no webContents available
      if (!details.webContents) {
        callback({ responseHeaders: details.responseHeaders });
        return;
      }

      // Get or create nonce for this webContents (one nonce per window/page load)
      if (details.webContents.isDestroyed()) {
        callback({ responseHeaders: details.responseHeaders });
        return;
      }
      let nonce = this.nonces.get(details.webContents.id);
      if (!nonce) {
        nonce = this.generateNonce();
        this.nonces.set(details.webContents.id, nonce);
      }

      // Define CSP based on the URL (checking for filename only, so path changes don't affect this)
      let csp;
      if (details.url.includes('dashboard') || details.url.includes('index.html')) {
        csp = `default-src 'self'; script-src 'self'; style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self';`;
      } else if (details.url.includes('chat')) {
        csp = `default-src 'self'; script-src 'self'; style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self';`;
      } else if (details.url.includes('overlay')) {
        csp = `default-src 'self'; script-src 'self'; style-src 'self' 'nonce-${nonce}'; font-src 'self' data:; img-src 'self' data:; connect-src 'self';`;
      } else {
        // Default strict CSP - only set for HTML files to avoid setting CSP on every resource
        if (details.url.includes('.html') || details.resourceType === 'mainFrame') {
          csp = `default-src 'self'; script-src 'self'; style-src 'self' 'nonce-${nonce}'; font-src 'self' img-src 'self' data:;`;
        } else {
          // For non-HTML resources, don't set CSP headers
          callback({ responseHeaders: details.responseHeaders });
          return;
        }
      }

      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [csp]
        }
      });
    });
  }
}

module.exports = { CSPManager };
