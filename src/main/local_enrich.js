const { chromium } = require("playwright");

/**
 * Local enrichment runner (Windows desktop).
 *
 * Opens a headed browser locally and injects an Alt+Q modal.
 * When the user clicks Enrich, we extract DOM metadata locally and send it to the server
 * for matching + writing after_enrichment.json.
 */

let _browser = null;
let _context = null;
let _page = null;
let _session = null;

function isRunning() {
  return Boolean(_browser && _context && _page);
}

function _assertSession() {
  if (!_session) throw new Error("Enrichment session not initialized");
  if (!_session.serverBaseUrl) throw new Error("serverBaseUrl missing");
  if (!_session.token) throw new Error("token missing");
  if (!_session.projectId) throw new Error("projectId missing");
}

function _headers() {
  _assertSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${_session.token}`,
    "X-Project-ID": String(_session.projectId),
  };
}

async function _extractDom(page, pageName) {
  // Keep this shape close to backend's manual_capture_mode.extract_dom_metadata
  return await page.evaluate((pn) => {
    const nodes = Array.from(
      document.querySelectorAll('body *:not(#smartaiModal *):not(#smartaiModal)'),
    );
    return nodes.map((e) => {
      let bbox = { x: "", y: "", width: "", height: "" };
      try {
        const b = e.getBoundingClientRect();
        bbox = { x: b.x, y: b.y, width: b.width, height: b.height };
      } catch {}

      const attrs = {};
      try {
        for (const attr of e.attributes) attrs[attr.name] = attr.value;
      } catch {}

      let label = "";
      try {
        if (e.id) {
          const labelElem = document.querySelector('label[for="' + e.id + '"]');
          if (labelElem) label = (labelElem.innerText || "").trim();
        }
      } catch {}

      try {
        if (!label && e.getAttribute("aria-label")) label = e.getAttribute("aria-label");
        if (!label && e.placeholder) label = e.placeholder;
        if (!label && (e.tagName || "").toLowerCase() === "button")
          label = (e.textContent || "").trim();
        if (!label && e.getAttribute("data-lov-name")) label = e.getAttribute("data-lov-name");
      } catch {}

      let editable = false;
      try {
        const tn = (e.tagName || "").toLowerCase();
        if (["input", "textarea", "select"].includes(tn)) editable = !e.readOnly && !e.disabled;
        else if (e.getAttribute("contenteditable") === "true") editable = true;
      } catch {}

      let visible = false;
      try {
        visible = !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
      } catch {}

      let enable = true;
      try {
        enable = !e.disabled;
      } catch {}

      return {
        page_name: pn || "",
        tag_name: (e.tagName || "").toLowerCase(),
        text: (e.textContent || "").trim(),
        class: e.className || "",
        id: e.id || "",
        value: (typeof e.value === "string" ? e.value : "") || "",
        placeholder: e.placeholder || "",
        type: e.type || "",
        enable,
        visible,
        editable,
        label_text: label || "",
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
        attributes: attrs,
        outer_html: (e.outerHTML || "").slice(0, 120),
      };
    });
  }, pageName || "page");
}

function _modalScripts() {
  // Top-frame modal UI + Alt+Q shortcut.
  // Uses a Playwright binding: window.testify_enrich_now({ pageName }).
  const TOP = `
(() => {
  if (window !== window.top) return;
  if (window._testifyTopInstalled) return;
  window._testifyTopInstalled = true;

  function isEditable(el){
    if(!el) return false;
    const t=(el.tagName||'').toLowerCase();
    return t==='input'||t==='textarea'||t==='select'||el.isContentEditable;
  }

  function suggestPageName(){
    try{
      const u = new URL(location.href);
      const p = (u.pathname || '/').replace(/\/+$/,'') || '/';
      const last = p.split('/').filter(Boolean).slice(-1)[0] || 'page';
      const host = (u.hostname || 'site').replace(/[^a-z0-9]+/gi,'_');
      const stem = (last || 'page').replace(/[^a-z0-9]+/gi,'_');
      return (host + '_' + stem).toLowerCase();
    }catch(_){
      return 'page';
    }
  }

  function ensureModal(){
    if (document.getElementById('smartaiModal')) return;
    const modal=document.createElement('div');
    modal.id='smartaiModal';
    modal.style.cssText='position:fixed;top:40%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:16px;border:2px solid #000;z-index:2147483647;display:none;min-width:300px;max-width:90vw;max-height:80vh;overflow:auto;border-radius:10px;font-family:Arial,sans-serif;';
    modal.innerHTML =
      '<div style="text-align:center;font-weight:bold;margin-bottom:10px;">Manual Enrich</div>' +
      '<div style="display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;">' +
      '<label style="font-size:12px;color:#333;">Page</label>' +
      '<input id="testify_page_name" style="padding:6px 8px;min-width:160px;" />' +
      '</div>' +
      '<div style="display:flex;gap:10px;justify-content:center;margin-top:10px;">' +
      '<button id="smartai_enrich_btn">Enrich</button>' +
      '<button id="smartai_close_btn">Close</button>' +
      '</div>' +
      '<div id="smartai_msg" style="margin-top:10px;font-weight:bold;text-align:center;"></div>' +
      '<div style="margin-top:8px;color:#666;font-size:12px;text-align:center;">Tip: press <b>Alt+Q</b> to open / close</div>';
    document.body.appendChild(modal);

    const input = modal.querySelector('#testify_page_name');
    if (input && !input.value) input.value = suggestPageName();

    const msg = modal.querySelector('#smartai_msg');
    modal.querySelector('#smartai_enrich_btn').onclick = async () => {
      msg.style.color='blue';
      msg.textContent='Capturing metadata...';
      try{
        const pageName = (input && input.value ? String(input.value) : 'page').trim() || 'page';
        const res = await window.testify_enrich_now({ pageName });
        const parsed = (typeof res === 'string') ? JSON.parse(res) : res;
        if (parsed && parsed.status === 'success'){
          msg.style.color='green';
          msg.textContent = 'Captured ' + (parsed.count || 0) + ' elements';
        } else {
          msg.style.color='red';
          msg.textContent = (parsed && (parsed.error || parsed.detail)) || 'Enrichment failed';
        }
      }catch(e){
        msg.style.color='red';
        msg.textContent='Error during enrichment';
      }
    };

    modal.querySelector('#smartai_close_btn').onclick = () => {
      modal.style.display = 'none';
    };
  }

  function toggleModal(){
    ensureModal();
    const m=document.getElementById('smartaiModal');
    if(!m) return;
    m.style.display = (m.style.display==='none' || !m.style.display) ? 'block' : 'none';
  }

  // Expose a stable hook for automation/debugging
  window.testifyShowModal = toggleModal;

  window.addEventListener('keydown', (e) => {
    if(!(e.altKey && (e.key==='q'||e.key==='Q'))) return;
    if(e.ctrlKey||e.metaKey) return;
    if(isEditable(document.activeElement)) return;
    try{e.preventDefault();e.stopPropagation();}catch(_){ }
    toggleModal();
  }, true);

  // Auto-show once after load to avoid "no modal" confusion.
  try { setTimeout(() => { try { toggleModal(); } catch(_) {} }, 800); } catch(_) {}
})();
  `;

  // Bridge for same-origin iframes so Alt+Q works there too.
  const IFRAME = `
(() => {
  if (window === window.top) return;
  if (window._testifyKeyBridgeInstalled) return;
  window._testifyKeyBridgeInstalled = true;
  function isEditable(el){ if(!el) return false; const t=(el.tagName||'').toLowerCase(); return t==='input'||t==='textarea'||t==='select'||el.isContentEditable; }
  window.addEventListener('keydown', (e) => {
    if(!(e.altKey && (e.key==='q'||e.key==='Q'))) return;
    if(e.ctrlKey||e.metaKey) return;
    if(isEditable(document.activeElement)) return;
    try{e.preventDefault();e.stopPropagation();}catch(_){ }
    try{window.top.postMessage({__testify:'TOGGLE_MODAL'}, '*');}catch(_){ }
  }, true);
})();
  `;

  // Message listener in top frame
  const TOP_LISTENER = `
(() => {
  if (window !== window.top) return;
  if (window._testifyPostMessageInstalled) return;
  window._testifyPostMessageInstalled = true;
  window.addEventListener('message', (e) => {
    if (!e || !e.data || e.data.__testify !== 'TOGGLE_MODAL') return;
    try{
      const evt = new KeyboardEvent('keydown', { altKey:true, key:'Q' });
      window.dispatchEvent(evt);
    }catch(_){ }
  });
})();
  `;

  return { TOP, IFRAME, TOP_LISTENER };
}

async function _sendDomToServer({ pageName, domData, sourceUrl }) {
  _assertSession();
  const endpoint = `${_session.serverBaseUrl.replace(/\/+$/, "")}/desktop/enrichment/dom-capture`;

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: _headers(),
    body: JSON.stringify({
      page_name: pageName,
      source_url: sourceUrl,
      dom_data: domData,
    }),
  });

  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { status: "fail", error: text };
  }

  if (!resp.ok) {
    const msg = (data && (data.detail || data.error)) || `HTTP ${resp.status}`;
    throw new Error(msg);
  }
  return data;
}

async function startManual({ startUrl, serverBaseUrl, token, projectId } = {}) {
  if (!startUrl) throw new Error("startUrl is required");
  if (isRunning()) throw new Error("Enrichment already running");
  _session = { serverBaseUrl, token, projectId, startUrl };

  _browser = await chromium.launch({ headless: false });
  _context = await _browser.newContext({ viewport: { width: 1280, height: 720 } });
  _page = await _context.newPage();

  // Expose binding for the modal button
  await _page.exposeBinding("testify_enrich_now", async (_source, payload) => {
    try {
      const pageName = (payload && payload.pageName ? String(payload.pageName) : "page").trim() || "page";
      const domData = await _extractDom(_page, pageName);
      const data = await _sendDomToServer({ pageName, domData, sourceUrl: _page.url() });
      return JSON.stringify(data);
    } catch (e) {
      return JSON.stringify({ status: "fail", error: String(e && e.message ? e.message : e) });
    }
  });

  const { TOP, IFRAME, TOP_LISTENER } = _modalScripts();
  await _context.addInitScript(TOP_LISTENER);
  await _context.addInitScript(TOP);
  await _context.addInitScript(IFRAME);

  await _page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });

  // Extra safety: force-show the modal in case the page swallows Alt+Q.
  try {
    await _page.evaluate(() => {
      try {
        if (window.testifyShowModal) window.testifyShowModal();
      } catch {}
    });
  } catch {}

  return { ok: true, startUrl };
}

async function startAuto({ startUrl, serverBaseUrl, token, projectId, pageName } = {}) {
  // Auto = open locally, capture once, close.
  if (!startUrl) throw new Error("startUrl is required");
  if (isRunning()) throw new Error("Enrichment already running");
  _session = { serverBaseUrl, token, projectId, startUrl };

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  const pn = (pageName || "page").trim() || "page";
  const domData = await _extractDom(page, pn);
  const res = await _sendDomToServer({ pageName: pn, domData, sourceUrl: page.url() });

  try {
    await page.close();
  } catch {}
  try {
    await context.close();
  } catch {}
  try {
    await browser.close();
  } catch {}

  _session = null;
  return { ok: true, result: res };
}

async function stop() {
  if (!isRunning()) return { ok: true, stopped: false };
  try {
    await _page.close();
  } catch {}
  try {
    await _context.close();
  } catch {}
  try {
    await _browser.close();
  } catch {}
  _browser = null;
  _context = null;
  _page = null;
  _session = null;
  return { ok: true, stopped: true };
}

module.exports = {
  isRunning,
  startManual,
  startAuto,
  stop,
};
