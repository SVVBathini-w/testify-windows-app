const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const capture = require("./capture");
const pythonRunner = require("./python_runner");
const bundle = require("./bundle");
const serverClient = require("./server_client");
const zipUtils = require("./zip_utils");

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Prefer packaged React UI build if present; fallback to prototype page.
  const uiBuildIndex = path.join(__dirname, "..", "..", "ui", "build", "index.html");
  const prototypeIndex = path.join(__dirname, "..", "renderer", "index.html");
  win.loadFile(require("fs").existsSync(uiBuildIndex) ? uiBuildIndex : prototypeIndex);

  // Open devtools if requested
  if (process.env.TESTIFY_DEVTOOLS === "1") {
    win.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// --- IPC ---
ipcMain.handle("open-external", async (_evt, url) => {
  if (!url || typeof url !== "string") return { ok: false, error: "Missing url" };
  await shell.openExternal(url);
  return { ok: true };
});

ipcMain.handle("capture:start", async (_evt, payload) => {
  try {
    const res = await capture.startCapture(payload || {});
    return res;
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});

ipcMain.handle("capture:stop", async (_evt, payload) => {
  try {
    const res = await capture.stopCapture(payload || {});
    return res;
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});

ipcMain.handle("capture:status", async () => {
  return { ok: true, running: capture.isRunning() };
});

ipcMain.handle("dialog:open-file", async (_evt, options) => {
  const res = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: (options && options.filters) || undefined,
  });
  if (res.canceled) return { ok: true, canceled: true };
  return { ok: true, canceled: false, filePaths: res.filePaths };
});

ipcMain.handle("python:detect", async () => {
  return await pythonRunner.detectPython();
});

ipcMain.handle("python:ensure-venv", async (_evt, payload) => {
  try {
    const venvDir = (payload && payload.venvDir) || pythonRunner.defaultVenvDir();
    const pythonCmd = payload && payload.pythonCmd;
    if (!pythonCmd) return { ok: false, error: "pythonCmd required" };
    return await pythonRunner.ensureVenv({ pythonCmd, venvDir });
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});

ipcMain.handle("python:pip-install", async (_evt, payload) => {
  try {
    const venvPython = payload && payload.venvPython;
    const requirementsPath = payload && payload.requirementsPath;
    return await pythonRunner.pipInstall({ venvPython, requirementsPath });
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});

ipcMain.handle("python:run-pytest", async (_evt, payload) => {
  try {
    return await pythonRunner.runPytest(payload || {});
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});

ipcMain.handle("bundle:extract-zip", async (_evt, payload) => {
  try {
    return bundle.extractZipToTemp(payload && payload.zipPath);
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});

ipcMain.handle("server:download-bundle", async (_evt, payload) => {
  try {
    return await serverClient.downloadBundle(payload || {});
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});

ipcMain.handle("server:create-run", async (_evt, payload) => {
  try {
    return await serverClient.createRun(payload || {});
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});

ipcMain.handle("server:upload-artifacts", async (_evt, payload) => {
  try {
    return await serverClient.uploadArtifacts(payload || {});
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});

ipcMain.handle("server:unpack-allure", async (_evt, payload) => {
  try {
    return await serverClient.unpackAllure(payload || {});
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});

ipcMain.handle("zip:dir", async (_evt, payload) => {
  try {
    const dirPath = payload && payload.dirPath;
    const outZipPath = payload && payload.outZipPath;
    return zipUtils.zipDirectory(dirPath, outZipPath);
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});
