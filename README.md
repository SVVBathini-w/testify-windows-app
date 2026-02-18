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

> Note: Electron GUI won’t run properly on this headless VPS due to Linux sandbox constraints.
> Development/testing should happen on Windows.

```bash
npm install
npm run ui:install
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
