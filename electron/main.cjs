const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");

let serverStarted = false;

function waitForServer(port, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const http = require("http");
    const start = Date.now();

    function attempt() {
      const req = http.get({ host: "127.0.0.1", port, path: "/api/health", timeout: 2000 }, (res) => {
        // any response means server is up
        res.resume();
        resolve(true);
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) return reject(new Error("Server did not start in time"));
        setTimeout(attempt, 500);
      });
      req.on("timeout", () => {
        req.destroy();
        if (Date.now() - start > timeoutMs) return reject(new Error("Server start timed out"));
        setTimeout(attempt, 500);
      });
    }
    attempt();
  });
}

function startServer() {
  if (serverStarted) return;
  process.env.DESKTOP = process.env.DESKTOP || "1";
  process.env.PORT = process.env.PORT || "5000";
  try {
    const distIndex = path.resolve(__dirname, "..", "dist", "index.js");
    // dist/index.js is ESM; load via dynamic import from CJS
    const { pathToFileURL } = require("url");
    const distUrl = pathToFileURL(distIndex).href;
    // Force production so server serves built static files
    process.env.NODE_ENV = "production";
    import(distUrl)
      .then(async () => {
        try {
          await waitForServer(Number(process.env.PORT || "5000"), 30000);
          serverStarted = true;
        } catch (e) {
          dialog.showErrorBox("Server startup timeout", String(e?.message || e));
          app.quit();
        }
      })
      .catch((err) => {
        dialog.showErrorBox("Failed to start server", String(err?.stack || err));
        app.quit();
      });
  } catch (err) {
    dialog.showErrorBox("Failed to start server", String(err?.stack || err));
    app.quit();
  }
}

async function createWindow() {
  startServer();
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: { contextIsolation: true },
    show: false,
  });
  const url = `http://localhost:${process.env.PORT || "5000"}`;
  // Wait until serverStarted flag is set before loading URL
  const start = Date.now();
  while (!serverStarted) {
    if (Date.now() - start > 32000) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  // Diagnostics: show a dialog if page load fails
  win.webContents.on("did-fail-load", (_e, code, desc, _url, isMainFrame) => {
    if (isMainFrame) {
      dialog.showErrorBox("Failed to load UI", `${desc} (code ${code})`);
    }
  });
  // Optional: open DevTools when debugging
  if (process.env.DESKTOP_DEBUG === "1") {
    win.webContents.openDevTools({ mode: "detach" });
  }
  await win.loadURL(url);
  win.once("ready-to-show", () => win.show());
}

app.on("ready", createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });


