const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("testify", {
  openExternal: (url) => ipcRenderer.invoke("open-external", url),

  // Interactive capture
  captureStart: (payload) => ipcRenderer.invoke("capture:start", payload),
  captureStop: (payload) => ipcRenderer.invoke("capture:stop", payload),
  captureStatus: () => ipcRenderer.invoke("capture:status"),

  // Dialog helpers
  openFile: (options) => ipcRenderer.invoke("dialog:open-file", options),

  // Python runner
  pythonDetect: () => ipcRenderer.invoke("python:detect"),
  pythonEnsureVenv: (payload) => ipcRenderer.invoke("python:ensure-venv", payload),
  pythonPipInstall: (payload) => ipcRenderer.invoke("python:pip-install", payload),
  pythonRunPytest: (payload) => ipcRenderer.invoke("python:run-pytest", payload),

  // Bundles
  bundleExtractZip: (payload) => ipcRenderer.invoke("bundle:extract-zip", payload),

  // Server
  serverDownloadBundle: (payload) => ipcRenderer.invoke("server:download-bundle", payload),
  serverCreateRun: (payload) => ipcRenderer.invoke("server:create-run", payload),
  serverUploadArtifacts: (payload) => ipcRenderer.invoke("server:upload-artifacts", payload),
  serverUnpackAllure: (payload) => ipcRenderer.invoke("server:unpack-allure", payload),

  // Zip
  zipDir: (payload) => ipcRenderer.invoke("zip:dir", payload),
});
