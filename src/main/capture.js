const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

/**
 * Minimal interactive capture engine.
 *
 * Runs a headed Playwright Chromium locally, lets the user navigate manually,
 * then exports storage_state + (optional) trace.
 *
 * NOTE: This module is intended to run on the Windows desktop app.
 */

let _browser = null;
let _context = null;
let _page = null;
let _startedAt = null;

function _ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function isRunning() {
  return Boolean(_browser && _context);
}

async function startCapture({ startUrl, outDir, trace = true, viewport } = {}) {
  if (!startUrl) throw new Error("startUrl is required");
  if (isRunning()) throw new Error("Capture already running");

  const resolvedOutDir = path.resolve(outDir || path.join(process.cwd(), "captures"));
  _ensureDir(resolvedOutDir);

  _browser = await chromium.launch({ headless: false });
  _context = await _browser.newContext({ viewport: viewport || { width: 1280, height: 720 } });
  _page = await _context.newPage();
  _startedAt = Date.now();

  if (trace) {
    await _context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  }

  await _page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });

  return {
    ok: true,
    startUrl,
    outDir: resolvedOutDir,
    startedAt: _startedAt,
  };
}

async function stopCapture({ outDir, saveTrace = true } = {}) {
  if (!isRunning()) throw new Error("Capture not running");

  const resolvedOutDir = path.resolve(outDir || path.join(process.cwd(), "captures"));
  _ensureDir(resolvedOutDir);

  const storageStatePath = path.join(resolvedOutDir, "storage_state.json");
  await _context.storageState({ path: storageStatePath });

  let tracePath = null;
  try {
    if (saveTrace) {
      tracePath = path.join(resolvedOutDir, "trace.zip");
      await _context.tracing.stop({ path: tracePath });
    } else {
      await _context.tracing.stop();
    }
  } catch {
    // ignore
  }

  try {
    await _page.close();
  } catch {}
  try {
    await _context.close();
  } catch {}
  try {
    await _browser.close();
  } catch {}

  const startedAt = _startedAt;
  _browser = null;
  _context = null;
  _page = null;
  _startedAt = null;

  return {
    ok: true,
    startedAt,
    durationMs: startedAt ? Date.now() - startedAt : null,
    storageStatePath,
    tracePath,
    outDir: resolvedOutDir,
  };
}

module.exports = {
  isRunning,
  startCapture,
  stopCapture,
};
