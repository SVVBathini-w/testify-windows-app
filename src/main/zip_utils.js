const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

function zipDirectory(dirPath, outZipPath) {
  if (!dirPath) throw new Error("dirPath required");
  if (!outZipPath) throw new Error("outZipPath required");
  if (!fs.existsSync(dirPath)) throw new Error(`dir not found: ${dirPath}`);

  const zip = new AdmZip();

  const base = path.resolve(dirPath);
  const add = (p) => {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(p)) {
        add(path.join(p, child));
      }
      return;
    }
    const rel = path.relative(base, p).replace(/\\/g, "/");
    zip.addFile(rel, fs.readFileSync(p));
  };

  add(base);
  zip.writeZip(outZipPath);
  return { ok: true, outZipPath };
}

module.exports = {
  zipDirectory,
};
