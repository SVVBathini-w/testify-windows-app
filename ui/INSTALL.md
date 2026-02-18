# Testify UI (desktop embedded)

This UI is copied from `testify-automator-ai/FRONTEND-NEW`.

## Install

From the `testify-app` repo root:

```bash
npm run ui:install
```

## Build

```bash
npm run ui:build
```

The Electron main process will load `ui/build/index.html` when present.

## Desktop-only features

The UI detects Electron via `window.testify`.

- `/capture` uses Playwright headed capture via IPC.
- `/local-run` uses the local Python runner via IPC.

When run as a pure web app, those pages show a warning.
