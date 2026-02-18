const fs = require("fs");
const os = require("os");
const path = require("path");
const AdmZip = require("adm-zip");

function _ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function _safeId() {
  return `run_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function extractZipToTemp(zipPath) {
  if (!zipPath) throw new Error("zipPath required");
  const dest = path.join(os.tmpdir(), "testify", _safeId());
  _ensureDir(dest);
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(dest, true);
  return { ok: true, destDir: dest };
}

module.exports = {
  extractZipToTemp,
};
