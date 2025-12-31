const appNameEl = document.querySelector("#app-name");

if (appNameEl && window.miki) {
  appNameEl.textContent = window.miki.appName;
}
