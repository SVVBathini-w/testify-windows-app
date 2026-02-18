// config.js
//
// Desktop (Electron) needs to talk to the server via an explicit URL.
// We default to the SSH tunnel address, but allow overrides via env and localStorage.

function isElectron() {
  return typeof window !== "undefined" && Boolean(window.testify);
}

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

const DEFAULT_WEB_API = "http://localhost:8001";
const DEFAULT_DESKTOP_API = "http://127.0.0.1:8002";

const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  readStorage("TESTIFY_SERVER_URL") ||
  (isElectron() ? DEFAULT_DESKTOP_API : DEFAULT_WEB_API);

export default API_BASE_URL;
