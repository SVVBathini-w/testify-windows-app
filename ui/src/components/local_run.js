import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../css/Inputs.module.css";

function isElectron() {
  return typeof window !== "undefined" && Boolean(window.testify);
}

export default function LocalRun() {
  const navigate = useNavigate();
  const electron = useMemo(() => isElectron(), []);

  const [log, setLog] = useState("Ready.\n");
  const [serverUrl, setServerUrl] = useState(
    localStorage.getItem("TESTIFY_SERVER_URL") || "http://127.0.0.1:8002",
  );
  const [token, setToken] = useState("");
  const [zipPath, setZipPath] = useState("");
  const [projectDir, setProjectDir] = useState("");
  const [pythonCmd, setPythonCmd] = useState("py");
  const [headed, setHeaded] = useState(true);
  const [runId, setRunId] = useState("");

  const append = (msg) => setLog((prev) => prev + String(msg) + "\n");

  useEffect(() => {
    try {
      localStorage.setItem("TESTIFY_SERVER_URL", serverUrl);
    } catch {
      // ignore
    }
  }, [serverUrl]);

  const pickZip = async () => {
    if (!electron) return;
    const res = await window.testify.openFile({
      filters: [{ name: "Zip", extensions: ["zip"] }],
    });
    if (res?.ok && !res.canceled && res.filePaths?.[0]) {
      setZipPath(res.filePaths[0]);
      append(`Selected zip: ${res.filePaths[0]}`);
    }
  };

  const downloadBundle = async () => {
    if (!electron) return;
    const res = await window.testify.serverDownloadBundle({ serverUrl, token });
    append("serverDownloadBundle => " + JSON.stringify(res, null, 2));
    if (res?.ok && res.bundleZipPath) {
      setZipPath(res.bundleZipPath);
      append(`Bundle saved to: ${res.bundleZipPath}`);
    }
  };

  const createRun = async () => {
    if (!electron) return;
    const res = await window.testify.serverCreateRun({ serverUrl, token, name: "desktop-local-run" });
    append("serverCreateRun => " + JSON.stringify(res, null, 2));
    if (res?.ok && res.run_id) {
      setRunId(res.run_id);
    }
    return res;
  };

  const detectPython = async () => {
    const res = await window.testify.pythonDetect();
    append("pythonDetect => " + JSON.stringify(res, null, 2));
    if (res?.ok && res.cmd) setPythonCmd(res.cmd);
  };

  const extractBundle = async () => {
    if (!zipPath) {
      append("ERROR: select a zip first");
      return;
    }
    const res = await window.testify.bundleExtractZip({ zipPath });
    append("bundleExtractZip => " + JSON.stringify(res, null, 2));
    if (res?.ok && res.destDir) {
      setProjectDir(res.destDir);
    }
  };

  const ensureVenv = async () => {
    const res = await window.testify.pythonEnsureVenv({ pythonCmd });
    append("pythonEnsureVenv => " + JSON.stringify(res, null, 2));
    return res;
  };

  const pipInstall = async (venvPython) => {
    // Expect bundle contains requirements.txt at project root.
    const req = projectDir ? `${projectDir}/requirements.txt` : "";
    const res = await window.testify.pythonPipInstall({ venvPython, requirementsPath: req });
    append("pythonPipInstall => " + JSON.stringify(res, null, 2));
    return res;
  };

  const runPytest = async (venvPython) => {
    const allureDir = projectDir ? `${projectDir}/allure-results` : "";
    const res = await window.testify.pythonRunPytest({
      venvPython,
      projectDir,
      testsPath: "tests",
      allureResultsDir: allureDir,
      headed,
    });
    append("pythonRunPytest => " + JSON.stringify(res, null, 2));
    if (res?.stdout) append(res.stdout);
    if (res?.stderr) append(res.stderr);
    return res;
  };

  const runAll = async () => {
    if (!electron) {
      append("ERROR: Local run requires the Windows desktop app (Electron).");
      return;
    }
    if (!projectDir) {
      append("ERROR: Extract bundle first.");
      return;
    }

    const venvRes = await ensureVenv();
    if (!venvRes?.ok) return;

    const vpy = venvRes.venvPython;
    const pipRes = await pipInstall(vpy);
    if (!pipRes?.ok) return;

    const pytestRes = await runPytest(vpy);

    // Upload artifacts to server if configured
    if (serverUrl && runId) {
      try {
        const allureDir = `${projectDir}/allure-results`;
        const outZip = `${projectDir}/allure-results.zip`;
        const zipRes = await window.testify.zipDir({ dirPath: allureDir, outZipPath: outZip });
        append("zipDir => " + JSON.stringify(zipRes, null, 2));

        const uploadRes = await window.testify.serverUploadArtifacts({
          serverUrl,
          token,
          runId,
          allureZipPath: outZip,
          // trace zip could be in bundle or produced by tests; skipped for now
          traceZipPath: "",
          pytestLogPath: "",
        });
        append("serverUploadArtifacts => " + JSON.stringify(uploadRes, null, 2));

        const unpackRes = await window.testify.serverUnpackAllure({ serverUrl, token, runId });
        append("serverUnpackAllure => " + JSON.stringify(unpackRes, null, 2));
      } catch (e) {
        append("Upload failed: " + String(e));
      }
    } else {
      append("NOTE: serverUrl or runId missing; skipping upload.");
    }

    return pytestRes;
  };

  return (
    <div className={styles.inputContainer}>
      <nav className={styles.navbar}>
        <div className={styles.navbarBrand}>
          <i className={`fa fa-code ${styles.navbarIcon}`}></i>
          <div>
            <h4 className={styles.navbarTitle}>Testify</h4>
            <p className={styles.navbarSubtitle}>Local Execution (Prototype)</p>
          </div>
        </div>

        <button onClick={() => navigate("/")} className={styles.backButton}>
          Back to Dashboard
        </button>
      </nav>

      <h1 className={styles.wizardTitle}>Run Generated Tests Locally (Python)</h1>
      <p style={{ color: "#9fb1c1" }}>
        Prototype: pick a server-provided bundle zip (tests + requirements), extract it, bootstrap a
        venv, install deps, and run pytest locally.
      </p>

      {!electron ? (
        <p style={{ color: "#f59e0b" }}>
          You are currently running the web UI. Install/run the Windows desktop app to use local
          execution.
        </p>
      ) : null}

      <div style={{ display: "grid", gap: 10, maxWidth: 900 }}>
        <label style={{ color: "#9fb1c1" }}>Server Base URL</label>
        <input
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder="https://your-vps-domain"
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid #263244",
            background: "#0b0f14",
            color: "#e6edf3",
          }}
        />

        <label style={{ color: "#9fb1c1" }}>Auth token (optional for now)</label>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Bearer token"
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid #263244",
            background: "#0b0f14",
            color: "#e6edf3",
          }}
        />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={downloadBundle} className={styles.backButton}>
            Download Bundle
          </button>
          <button onClick={pickZip} className={styles.backButton}>
            Select Bundle Zip
          </button>
          <button onClick={extractBundle} className={styles.backButton}>
            Extract Bundle
          </button>
          <button onClick={createRun} className={styles.backButton}>
            Create Server Run
          </button>
          <button onClick={detectPython} className={styles.backButton}>
            Detect Python
          </button>
        </div>

        <div style={{ color: "#9fb1c1" }}>Zip: {zipPath || "(none)"}</div>
        <div style={{ color: "#9fb1c1" }}>Extracted Dir: {projectDir || "(none)"}</div>
        <div style={{ color: "#9fb1c1" }}>Server runId: {runId || "(none)"}</div>

        <label style={{ color: "#9fb1c1" }}>Python command (default: py)</label>
        <input
          value={pythonCmd}
          onChange={(e) => setPythonCmd(e.target.value)}
          placeholder="py"
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid #263244",
            background: "#0b0f14",
            color: "#e6edf3",
          }}
        />

        <label style={{ color: "#9fb1c1" }}>
          Headed mode <input type="checkbox" checked={headed} onChange={() => setHeaded(!headed)} />
        </label>

        <button onClick={runAll} className={styles.backButton}>
          Run Pytest
        </button>

        <pre
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid #263244",
            background: "#0b0f14",
            color: "#e6edf3",
            whiteSpace: "pre-wrap",
            minHeight: 180,
          }}
        >
          {log}
        </pre>
      </div>
    </div>
  );
}
