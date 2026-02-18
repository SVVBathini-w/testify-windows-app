const fs = require("fs");
const os = require("os");
const path = require("path");

function _tmpFile(prefix, suffix) {
  const dir = path.join(os.tmpdir(), "testify");
  fs.mkdirSync(dir, { recursive: true });
  const name = `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}${suffix}`;
  return path.join(dir, name);
}

function _authHeaders(token) {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function downloadBundle({ serverUrl, token } = {}) {
  if (!serverUrl) throw new Error("serverUrl required");
  const url = new URL("/desktop/bundle", serverUrl);

  const res = await fetch(url.toString(), { headers: { ..._authHeaders(token) } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`bundle download failed: HTTP ${res.status} ${text}`);
  }

  const arrayBuf = await res.arrayBuffer();
  const outPath = _tmpFile("bundle", ".zip");
  fs.writeFileSync(outPath, Buffer.from(arrayBuf));
  return { ok: true, bundleZipPath: outPath };
}

async function createRun({ serverUrl, token, name } = {}) {
  if (!serverUrl) throw new Error("serverUrl required");
  const url = new URL("/desktop/runs", serverUrl);
  if (name) url.searchParams.set("name", name);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { ..._authHeaders(token) },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`create run failed: HTTP ${res.status} ${JSON.stringify(json)}`);
  }
  return { ok: true, ...json };
}

async function uploadArtifacts({ serverUrl, token, runId, allureZipPath, traceZipPath, pytestLogPath } = {}) {
  if (!serverUrl) throw new Error("serverUrl required");
  if (!runId) throw new Error("runId required");
  const url = new URL(`/desktop/runs/${runId}/upload`, serverUrl);

  const form = new FormData();

  function addFile(field, pth, filename) {
    if (!pth) return;
    if (!fs.existsSync(pth)) return;
    const buf = fs.readFileSync(pth);
    const blob = new Blob([buf]);
    form.append(field, blob, filename || path.basename(pth));
  }

  addFile("allure_results_zip", allureZipPath, "allure-results.zip");
  addFile("trace_zip", traceZipPath, "trace.zip");
  addFile("pytest_log", pytestLogPath, "pytest.log");

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { ..._authHeaders(token) },
    body: form,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`upload failed: HTTP ${res.status} ${JSON.stringify(json)}`);
  }
  return { ok: true, ...json };
}

async function unpackAllure({ serverUrl, token, runId } = {}) {
  if (!serverUrl) throw new Error("serverUrl required");
  if (!runId) throw new Error("runId required");
  const url = new URL(`/desktop/runs/${runId}/unpack-allure`, serverUrl);

  const res = await fetch(url.toString(), { method: "POST", headers: { ..._authHeaders(token) } });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`unpack failed: HTTP ${res.status} ${JSON.stringify(json)}`);
  }
  return { ok: true, ...json };
}

module.exports = {
  downloadBundle,
  createRun,
  uploadArtifacts,
  unpackAllure,
};
