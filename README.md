# Testify Desktop (testify-app)

Windows desktop companion app for Testify.

## Purpose (MVP)

1. Run **interactive capture** on the user's machine (headed browser), including SSO/MFA flows.
2. Export artifacts:
   - `storage_state.json`
   - optional Playwright `trace.zip`
   - optional DOM snapshots/checkpoints
3. Upload artifacts to the server (`backend-new`) to enable headless enrichment + SmartAI execution.

## Run locally (dev)

> Note: Development/testing should happen on Windows.

### 1) Start backend (via SSH tunnel)

This app expects the backend to be reachable at a local URL.

If you are on a restricted network (ports blocked), use an SSH tunnel from Windows to the VPS.

Example (Git Bash on Windows):

```bash
ssh -N -L 8001:127.0.0.1:8001 vishnu@72.62.226.134
```

Then confirm:
- http://127.0.0.1:8001/docs

You can override the backend URL in the UI by setting `localStorage.TESTIFY_SERVER_URL`.

### 2) Run the desktop app

```bash
npm install
npm run ui:install
npm run ui:build
npm run dev
```

Set `TESTIFY_DEVTOOLS=1` to open DevTools.

## Build Windows installer

On a Windows machine:

```powershell
cd testify-app
npm install
npm run ui:install
npm run dist:win
```

The installer will be created under `dist/`.

## Next steps

- Add a local Playwright capture engine (Node Playwright) invoked by the Electron main process.
- Add server session handshake:
  - create interactive session
  - upload artifacts
- Add basic settings + project selection.

## Notes

Opening the system default browser is supported, but **capturing cookies/localStorage/DOM reliably**
requires a Playwright-controlled browser session. The planned capture engine will run locally.
