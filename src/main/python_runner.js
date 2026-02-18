const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const which = require("which");

function _sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function _exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function _ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function _run(cmd, args, { cwd, env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: cwd || process.cwd(),
      env: { ...process.env, ...(env || {}) },
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });

    child.on("error", (err) => {
      resolve({ code: 1, stdout, stderr: (stderr || "") + String(err) });
    });
  });
}

async function detectPython() {
  // Windows-friendly order.
  const candidates = [
    { cmd: "py", args: ["-3.12", "-V"], label: "py -3.12" },
    { cmd: "py", args: ["-3", "-V"], label: "py -3" },
    { cmd: "python", args: ["-V"], label: "python" },
  ];

  for (const c of candidates) {
    try {
      // Ensure executable exists (best effort).
      if (c.cmd !== "py" && c.cmd !== "python") continue;
      if (c.cmd === "python") {
        try {
          await which("python");
        } catch {
          // ignore
        }
      }

      const res = await _run(c.cmd, c.args);
      const out = (res.stdout + res.stderr).trim();
      if (res.code === 0 && /Python\s+3\./i.test(out)) {
        return { ok: true, cmd: c.cmd, versionCheckArgs: c.args, label: c.label, versionText: out };
      }
    } catch {
      // continue
    }
  }

  return {
    ok: false,
    error:
      "Python not found. Install Python 3.12 and enable 'Add to PATH' or ensure the 'py' launcher is installed.",
  };
}

function _venvPythonPath(venvDir) {
  // Windows venv layout; still works if run on other OS with minor adjustment later.
  const win = path.join(venvDir, "Scripts", "python.exe");
  const posix = path.join(venvDir, "bin", "python");
  return process.platform === "win32" ? win : posix;
}

async function ensureVenv({ pythonCmd, venvDir }) {
  if (!pythonCmd) throw new Error("pythonCmd required");
  if (!venvDir) throw new Error("venvDir required");

  _ensureDir(venvDir);
  const vpy = _venvPythonPath(venvDir);

  if (_exists(vpy)) {
    return { ok: true, venvDir, venvPython: vpy, created: false };
  }

  // Create venv
  const res = await _run(pythonCmd, ["-m", "venv", venvDir]);
  if (res.code !== 0) {
    throw new Error(`Failed to create venv: ${res.stderr || res.stdout}`);
  }

  // Give filesystem a beat on Windows.
  await _sleep(200);

  if (!_exists(vpy)) {
    throw new Error(`Venv created but python not found at expected path: ${vpy}`);
  }

  return { ok: true, venvDir, venvPython: vpy, created: true };
}

async function pipInstall({ venvPython, requirementsPath }) {
  if (!venvPython) throw new Error("venvPython required");
  if (!requirementsPath) throw new Error("requirementsPath required");
  if (!_exists(requirementsPath)) throw new Error(`requirements.txt not found: ${requirementsPath}`);

  // Upgrade pip tooling.
  await _run(venvPython, ["-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"]);

  const res = await _run(venvPython, ["-m", "pip", "install", "-r", requirementsPath]);
  if (res.code !== 0) {
    throw new Error(`pip install failed: ${res.stderr || res.stdout}`);
  }
  return { ok: true };
}

async function runPytest({
  venvPython,
  projectDir,
  testsPath = "tests",
  allureResultsDir,
  headed = false,
  extraArgs = [],
}) {
  if (!venvPython) throw new Error("venvPython required");
  if (!projectDir) throw new Error("projectDir required");

  const args = ["-m", "pytest", "-q", testsPath];
  if (allureResultsDir) {
    args.push("--alluredir", allureResultsDir);
  }
  args.push(...(extraArgs || []));

  const env = {};
  // Convention: let conftest/fixtures read HEADLESS / SMARTAI_HEADLESS.
  env.HEADLESS = headed ? "0" : "1";
  env.SMARTAI_HEADLESS = headed ? "0" : "1";

  const res = await _run(venvPython, args, {
    cwd: projectDir,
    env,
  });

  return {
    ok: res.code === 0,
    code: res.code,
    stdout: res.stdout,
    stderr: res.stderr,
    cmd: `${venvPython} ${args.join(" ")}`,
  };
}

function defaultVenvDir() {
  const base = process.platform === "win32" ? process.env.APPDATA : os.homedir();
  return path.join(base || os.homedir(), "Testify", "venv");
}

module.exports = {
  detectPython,
  ensureVenv,
  pipInstall,
  runPytest,
  defaultVenvDir,
};
