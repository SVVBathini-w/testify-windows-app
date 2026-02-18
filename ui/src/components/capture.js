import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../css/Inputs.module.css";

function isElectron() {
  return typeof window !== "undefined" && Boolean(window.testify);
}

export default function Capture() {
  const navigate = useNavigate();
  const [startUrl, setStartUrl] = useState("");
  const [log, setLog] = useState("Ready.\n");

  const electron = useMemo(() => isElectron(), []);

  const append = (msg) => {
    setLog((prev) => prev + String(msg) + "\n");
  };

  const handleStart = async () => {
    if (!electron) {
      append("ERROR: Capture requires the Windows desktop app (Electron).");
      return;
    }
    if (!startUrl.trim()) {
      append("ERROR: Start URL required");
      return;
    }
    const res = await window.testify.captureStart({ startUrl: startUrl.trim(), trace: true });
    append(JSON.stringify(res, null, 2));
  };

  const handleStop = async () => {
    if (!electron) {
      append("ERROR: Capture requires the Windows desktop app (Electron).");
      return;
    }
    const res = await window.testify.captureStop({ saveTrace: true });
    append(JSON.stringify(res, null, 2));
  };

  return (
    <div className={styles.inputContainer}>
      <nav className={styles.navbar}>
        <div className={styles.navbarBrand}>
          <i className={`fa fa-code ${styles.navbarIcon}`}></i>
          <div>
            <h4 className={styles.navbarTitle}>Testify</h4>
            <p className={styles.navbarSubtitle}>Interactive Capture</p>
          </div>
        </div>

        <button onClick={() => navigate("/")} className={styles.backButton}>
          Back to Dashboard
        </button>
      </nav>

      <h1 className={styles.wizardTitle}>Interactive Capture (Local Browser)</h1>
      <p style={{ color: "#9fb1c1" }}>
        This feature runs only in the installed Windows desktop app. It opens a Playwright-controlled
        headed browser on your PC and exports <code>storage_state.json</code> (and optionally a trace)
        to enable server-side enrichment/execution.
      </p>

      <div style={{ display: "grid", gap: 12, maxWidth: 900 }}>
        <label style={{ color: "#9fb1c1" }}>Start URL</label>
        <input
          value={startUrl}
          onChange={(e) => setStartUrl(e.target.value)}
          placeholder="https://example.com/login"
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid #263244",
            background: "#0b0f14",
            color: "#e6edf3",
          }}
        />

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button onClick={handleStart} className={styles.backButton}>
            Start Capture
          </button>
          <button onClick={handleStop} className={styles.backButton}>
            Stop & Save
          </button>
        </div>

        <pre
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid #263244",
            background: "#0b0f14",
            color: "#e6edf3",
            whiteSpace: "pre-wrap",
            minHeight: 160,
          }}
        >
          {log}
        </pre>

        {!electron ? (
          <p style={{ color: "#f59e0b" }}>
            You are currently running the web UI. Install/run the Windows desktop app to use capture.
          </p>
        ) : null}
      </div>
    </div>
  );
}
