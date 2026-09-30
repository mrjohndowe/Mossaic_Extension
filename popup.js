(() => {
  const $ = (s) => document.querySelector(s);
  const store = {
    get: (k, d) => new Promise((r) => chrome.storage.local.get(k, (v) => r(v[k] ?? d))),
    set: (k, v) => new Promise((r) => chrome.storage.local.set({ [k]: v }, r)),
  };

  const DEFAULT_WATCH = ["u/former-wolverine84/m/nothing_but_goths", "r/EarthPorn", "r/CityPorn", "r/wallpapers", "r/Cyberpunk"];
  const DEFAULT_PREFS = { filter: "all", sort: "hot", time: "day", cols: 4, turbo: false };
  const THEMES = {
    crimson: ["#ff1f5a", "#9b1dff"], gx: ["#fa1e4e", "#ff6a00"], violet: ["#8b5cf6", "#ec4899"], ocean: ["#22d3ee", "#3b82f6"],
    emerald: ["#10b981", "#06b6d4"], sunset: ["#f97316", "#ec4899"], gold: ["#fbbf24", "#f97316"],
  };

  // Same URL rules as the content script: subreddit, custom feed (multireddit) or user page.
  const MULTI_RE = /^\/(?:user|u)\/([A-Za-z0-9_-]{3,20})\/m\/([A-Za-z0-9_]{1,50})/i;
  const SUB_RE = /^\/r\/([A-Za-z0-9_+]{2,100})/i;
  const USER_RE = /^\/(?:user|u)\/([A-Za-z0-9_-]{3,20})(?:[/?#]|$)/i;
  function parseSource(input, allowBare) {
    let p = String(input || "").trim().replace(/^https?:\/\/(?:www\.|old\.|new\.)?reddit\.com/i, "");
    if (!p) return null;
    if (p[0] !== "/") p = "/" + p;
    let m = p.match(MULTI_RE);
    if (m) return { kind: "multi", path: `/user/${m[1]}/m/${m[2]}`, label: `u/${m[1]}/m/${m[2]}` };
    m = p.match(SUB_RE);
    if (m) return { kind: "sub", path: `/r/${m[1]}`, label: `r/${m[1]}` };
    m = p.match(USER_RE);
    if (m) return { kind: "user", path: `/user/${m[1]}`, label: `u/${m[1]}` };
    if (allowBare) {
      m = p.match(/^\/([A-Za-z0-9_]{2,21})\/?$/);
      if (m) return { kind: "sub", path: `/r/${m[1]}`, label: `r/${m[1]}` };
    }
    return null;
  }
  const urlFor = (src) => `https://www.reddit.com${src.path}/`;

  let tab = null;
  let onReddit = false;
  let current = null; // source for the page in the active tab, if supported
  let prefs = { ...DEFAULT_PREFS };
  let watch = DEFAULT_WATCH.slice();

  function applyTheme(settings) {
    let a = "#ff1f5a";
    let b = "#9b1dff";
    if (settings?.theme === "custom" && /^#[0-9a-f]{6}$/i.test(settings.customAccent || "")) a = b = settings.customAccent;
    else if (THEMES[settings?.theme]) [a, b] = THEMES[settings.theme];
    const n = parseInt(a.slice(1), 16);
    const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    const r = document.documentElement.style;
    r.setProperty("--accent", a);
    r.setProperty("--accent-b", b);
    r.setProperty("--on-accent", L > 0.3 ? "#15110a" : "#ffffff");
    if (settings?.darkness === "black") {
      r.setProperty("--bg", "#000");
      r.setProperty("--panel", "#0a0a0c");
    }
  }

  function setNote(text, warn) {
    const n = $("#note");
    n.hidden = !text;
    n.textContent = text || "";
    n.classList.toggle("warn", !!warn);
  }

  function renderStatus() {
    const dot = $("#dot");
    const label = $("#whereLabel");
    const name = $("#whereName");
    const btn = $("#openBtn");
    if (current) {
      dot.className = "dot ok";
      label.textContent = "You're on";
      name.textContent = current.label;
      btn.textContent = "Open media wall";
    } else {
      const fallback = parseSource(watch[0], true) || parseSource(DEFAULT_WATCH[0], true);
      dot.className = onReddit ? "dot warn" : "dot";
      label.textContent = onReddit ? "No gallery on this Reddit page" : "You're not on Reddit";
      name.textContent = `Will open ${fallback.label}`;
      name.title = fallback.label;
      btn.textContent = "Open media wall";
    }
  }

  function renderChips() {
    const box = $("#chips");
    box.innerHTML = "";
    for (const w of watch.slice(0, 8)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = w;
      b.title = `Open ${w}`;
      b.onclick = () => openWall(w);
      box.appendChild(b);
    }
  }

  function renderPrefs() {
    document.querySelectorAll("#filterSeg button").forEach((b) => b.classList.toggle("on", b.dataset.v === prefs.filter));
    $("#sortSel").value = prefs.sort;
    $("#timeSel").value = prefs.time;
    $("#timeSel").style.display = prefs.sort === "top" ? "" : "none";
    $("#colsRange").value = prefs.cols;
    $("#colsOut").textContent = prefs.cols;
    $("#turbo").checked = !!prefs.turbo;
  }

  // The wall listens for changes to these, so edits here apply to an open wall immediately.
  function savePrefs() {
    store.set("mz_prefs", {
      filter: prefs.filter, sort: prefs.sort, time: prefs.time, cols: prefs.cols, turbo: prefs.turbo,
    });
  }

  function send(msg) {
    return new Promise((res) => {
      try {
        chrome.tabs.sendMessage(tab.id, msg, (r) => res(chrome.runtime.lastError ? null : r));
      } catch {
        res(null);
      }
    });
  }

  async function openWall(input, opts = {}) {
    const typed = input != null;
    let src = typed ? parseSource(input, true) : current;
    if (typed && !src) {
      const e = $("#srcErr");
      e.hidden = false;
      e.textContent = "Couldn't read that. Paste a Reddit URL or type r/name, u/name or u/name/m/feed.";
      return;
    }
    $("#srcErr").hidden = true;
    if (!src) src = parseSource(watch[0], true) || parseSource(DEFAULT_WATCH[0], true);

    const btn = $("#openBtn");
    btn.disabled = true;

    if (onReddit) {
      const r = await send({ type: "mosaic-open", source: src.label, settings: !!opts.settings });
      if (r && r.ok) return window.close();
      if (r && r.error === "loading") {
        btn.disabled = false;
        return setNote("Mosaic is still starting on this page. Try again in a second.", true);
      }
      // No content script in this tab (it was open before Mosaic was installed or updated).
      // Reload it on the chosen source; the wall opens once the page has loaded.
      await store.set("mz_pending", { source: src.label, settings: !!opts.settings, ts: Date.now() });
      await chrome.tabs.update(tab.id, { url: urlFor(src) });
      return window.close();
    }
    await store.set("mz_pending", { source: src.label, settings: !!opts.settings, ts: Date.now() });
    await chrome.tabs.create({ url: urlFor(src) });
    window.close();
  }

  function bind() {
    $("#openBtn").onclick = () => openWall();
    $("#settingsBtn").onclick = () => openWall(undefined, { settings: true });
    $("#srcForm").onsubmit = (e) => {
      e.preventDefault();
      openWall($("#srcInput").value);
    };
    $("#srcInput").oninput = () => ($("#srcErr").hidden = true);

    $("#filterSeg").onclick = (e) => {
      const v = e.target.dataset?.v;
      if (!v) return;
      prefs.filter = v;
      renderPrefs();
      savePrefs();
    };
    $("#sortSel").onchange = (e) => {
      prefs.sort = e.target.value;
      renderPrefs();
      savePrefs();
    };
    $("#timeSel").onchange = (e) => {
      prefs.time = e.target.value;
      savePrefs();
    };
    $("#colsRange").oninput = (e) => {
      prefs.cols = +e.target.value;
      $("#colsOut").textContent = prefs.cols;
    };
    $("#colsRange").onchange = savePrefs;
    $("#turbo").onchange = (e) => {
      prefs.turbo = e.target.checked;
      savePrefs();
    };
  }

  async function init() {
    $("#ver").textContent = "v" + chrome.runtime.getManifest().version;
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = t || null;
    onReddit = /^https:\/\/(?:www|old)\.reddit\.com\//i.test(tab?.url || "");
    if (onReddit) {
      try {
        current = parseSource(new URL(tab.url).pathname, false);
      } catch {
        current = null;
      }
    }
    prefs = { ...DEFAULT_PREFS, ...(await store.get("mz_prefs", {})) };
    const w = await store.get("mz_watchlist", DEFAULT_WATCH);
    watch = (Array.isArray(w) && w.length ? w : DEFAULT_WATCH).map((n) => (String(n).includes("/") ? n : `r/${n}`));
    applyTheme(await store.get("mz_settings", {}));

    const favs = Object.keys(await store.get("mz_favs", {})).length;
    const hidden = (await store.get("mz_hidden", [])).length;
    $("#stats").innerHTML = `<b>${favs}</b> favorites · <b>${hidden}</b> hidden`;

    renderStatus();
    renderChips();
    renderPrefs();
    bind();
    if (!current) $("#srcInput").focus();
  }

  init();
})();
