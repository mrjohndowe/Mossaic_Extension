(() => {
  if (window.__mosaicLoaded) return;
  window.__mosaicLoaded = true;

  // Understands every Reddit listing Mosaic can browse:
  //   /r/name                      subreddit
  //   /user/name/m/feed/           custom feed (multireddit), e.g. /user/former-wolverine84/m/nothing_but_goths/
  //   /user/name/                  a user's posts
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

  const store = {
    get: (k, d) => new Promise((r) => chrome.storage.local.get(k, (v) => r(v[k] ?? d))),
    set: (k, v) => chrome.storage.local.set({ [k]: v }),
  };

  const state = {
    open: false,
    subreddit: null,
    items: [],
    seenIds: new Set(),
    after: null,
    pagesLoaded: 0,
    loading: false,
    done: false,
    filter: "all",
    sort: "hot",
    time: "day",
    cols: 4,
    turbo: false,
    hidden: new Set(),
    seen: new Set(),
    favs: {},
    watchlist: [""],
    showHidden: false,
    favView: false,
    index: -1,
    zoom: 1,
    panX: 0,
    panY: 0,
    slideshow: null,
  };

  // ---------- Settings model ----------
  const DEFAULTS = {
    // appearance
    theme: "midnight", customAccent: "#ff1f5a", darkness: "dark",
    // wall layout
    gap: 10, radius: 10, cardShape: "smart", captions: "hover", badges: true, hoverZoom: true, dimSeen: true,
    // content filters
    nsfw: "show", minScore: 0, minWidth: 0, showGalleries: true, showGifs: true, showEmbeds: true,
    dedupe: false, blockedWords: "", blockedAuthors: "",
    // loading
    pageSize: 100, autoLoad: true, prefetch: 1400, useLogin: true,
    // viewer
    fit: "contain", wheelAction: "navigate", maxZoom: 5, preload: 2, showInfo: true, backdropClose: true,
    // playback
    autoplay: true, startMuted: true, volume: 15, rememberVolume: true, loopVideo: false,
    // slideshow
    slideshowSeconds: 10, slideshowSkipVideos: false, slideshowLoop: false,
    // launcher
    launcher: "bottom-right",
  };
  const settings = { ...DEFAULTS };
  let blockedWords = [];
  let blockedAuthors = [];

  const THEMES = {
    crimson: ["Crimson", "#ff1f5a", "#9b1dff"],
    gx: ["GX Red", "#fa1e4e", "#ff6a00"],
    violet: ["Violet", "#8b5cf6", "#ec4899"],
    ocean: ["Ocean", "#22d3ee", "#3b82f6"],
    emerald: ["Emerald", "#10b981", "#06b6d4"],
    sunset: ["Sunset", "#f97316", "#ec4899"],
    gold: ["Gold", "#fbbf24", "#f97316"],
    midnight: ["midnight", "#2c2c2c", "#320000"]
  };
  // True when white text would be hard to read on this color (WCAG relative luminance).
  const isLight = (hex) => {
    const n = parseInt(hex.replace("#", ""), 16);
    const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return L > 0.3;
  };

  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const unesc = (s) => (s || "").replace(/&amp;/g, "&");

  // Label of the source for the page we're on (null if this page isn't a supported listing)
  function currentSubredditFromUrl() {
    return parseSource(location.pathname, false)?.label || null;
  }

  // ---------- Parsing Reddit subreddit posts into media items ----------
  function parsePost(p) {
    if (!p || !p.subreddit) return null;
    const base = {
      id: p.name,
      title: p.title,
      author: p.author,
      sub: p.subreddit_name_prefixed || `r/${p.subreddit}`,
      subreddit: p.subreddit,
      permalink: "https://www.reddit.com" + p.permalink,
      nsfw: p.over_18,
      score: p.score || 0,
      crosspost_parent: p.crosspost_parent || null,
    };
    const thumb = unesc(
      p.preview?.images?.[0]?.resolutions?.slice(-2)[0]?.url || p.preview?.images?.[0]?.source?.url
    );
    const src = p.preview?.images?.[0]?.source;

    if (p.is_gallery && p.media_metadata && p.gallery_data) {
      const slides = p.gallery_data.items
        .map((g) => {
          const m = p.media_metadata[g.media_id];
          if (!m || m.status !== "valid") return null;
          if (m.e === "AnimatedImage")
            return { kind: "video", src: unesc(m.s.mp4 || m.s.gif), w: m.s.x, h: m.s.y, gif: true };
          const prev = m.p?.[m.p.length - 1] || m.s;
          return { kind: "image", src: unesc(m.s.u), thumb: unesc(prev.u), w: m.s.x, h: m.s.y };
        })
        .filter(Boolean);
      if (!slides.length) return null;
      return {
        ...base,
        type: "gallery",
        slides,
        thumb: slides[0].thumb || slides[0].src,
        full: slides[0].src,
        w: slides[0].w,
        h: slides[0].h,
      };
    }

    const rv = p.secure_media?.reddit_video || p.media?.reddit_video;
    if (p.is_video && rv) {
      const video = rv.fallback_url.split("?")[0];
      const root = video.replace(/DASH_[^/]+$/, "");
      return {
        ...base,
        type: "video",
        thumb,
        w: rv.width,
        h: rv.height,
        video,
        audio:
          rv.has_audio === false
            ? null
            : [root + "DASH_AUDIO_128.mp4", root + "DASH_audio.mp4", root + "DASH_AUDIO_64.mp4"],
        hls: rv.hls_url,
      };
    }

    const gifPrev = p.preview?.reddit_video_preview || p.preview?.images?.[0]?.variants?.mp4?.source;
    const url = p.url_overridden_by_dest || p.url || "";

    if (/\.gifv$/i.test(url) && /imgur/.test(url)) {
      return {
        ...base,
        type: "video",
        gif: true,
        thumb,
        video: url.replace(/\.gifv$/i, ".mp4"),
        w: src?.width,
        h: src?.height,
      };
    }
    if (gifPrev && (p.preview?.reddit_video_preview || /\.gif$/i.test(url))) {
      return {
        ...base,
        type: "video",
        gif: true,
        thumb,
        video: unesc(gifPrev.fallback_url || gifPrev.url),
        w: gifPrev.width,
        h: gifPrev.height,
      };
    }
    if (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(url) || p.post_hint === "image") {
      return { ...base, type: "image", thumb: thumb || url, full: url, w: src?.width, h: src?.height };
    }
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/);
    if (yt)
      return {
        ...base,
        type: "video",
        embed: `https://www.youtube.com/embed/${yt[1]}?autoplay=1`,
        thumb: thumb || `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`,
        w: 16,
        h: 9,
      };
    const vm = url.match(/vimeo\.com\/(\d+)/);
    if (vm)
      return {
        ...base,
        type: "video",
        embed: `https://player.vimeo.com/video/${vm[1]}?autoplay=1`,
        thumb,
        w: 16,
        h: 9,
      };
    if (/\.(mp4|webm)(\?|$)/i.test(url)) return { ...base, type: "video", video: url, thumb, w: 16, h: 9 };
    return null;
  }

  function listingUrl() {
    const src = parseSource(state.subreddit || currentSubredditFromUrl(), true);
    if (!src) return null;
    const q = new URLSearchParams({ limit: String(settings.pageSize), raw_json: "1" });
    if (state.sort === "top") q.set("t", state.time);
    if (state.after) q.set("after", state.after);
    if (src.kind === "user") {
      q.set("sort", state.sort === "rising" ? "hot" : state.sort);
      return `https://www.reddit.com${src.path}/submitted.json?${q}`;
    }
    return `https://www.reddit.com${src.path}/${state.sort}.json?${q}`;
  }

  // Unlimited session loader — chains pages automatically with no post cap
  async function loadMore(hops = 0) {
    if (state.loading || state.done || state.favView) return;
    const url = listingUrl();
    if (!url) {
      setStatus("Open a subreddit, custom feed (u/name/m/feed) or user page.");
      return;
    }
    state.loading = true;
    setStatus(`Loading ${state.subreddit} (page ${state.pagesLoaded + 1}, ∞ unlimited session)…`);
    try {
      const res = await fetch(url, { credentials: settings.useLogin ? "include" : "omit" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const posts = json.data?.children?.map((c) => c.data) || [];
      state.after = json.data?.after || null;
      state.pagesLoaded += 1;
      if (!state.after || posts.length === 0) state.done = true;

      const fresh = [];
      for (const p of posts) {
        const parsed = parsePost(p);
        if (parsed && !state.seenIds.has(parsed.id)) {
          state.seenIds.add(parsed.id);
          fresh.push(parsed);
        }
      }
      state.items.push(...fresh);
      render(true);
      setStatus(state.done ? `End of ${state.subreddit} feed (${state.items.length} media posts loaded)` : "");

      // If this page had very few media items or the screen isn't full yet, keep fetching automatically
      const gridNotFull = ui.grid.scrollHeight <= ui.grid.clientHeight + 300;
      const sparse = settings.autoLoad && fresh.filter(passes).length < 6;
      if (!state.done && (sparse || gridNotFull) && hops < 4) {
        state.loading = false;
        return await loadMore(hops + 1);
      }
    } catch (e) {
      setStatus(`Couldn't load ${state.subreddit}. Check that it exists and is public (private feeds need you to be logged in).`);
    } finally {
      state.loading = false;
      updateMore();
    }
  }

  // ---------- UI ----------
  const ui = {};
  function buildUI() {
    ui.launch = el(
      "button",
      "mz-launch",
      `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="10" rx="2"/><rect x="13" y="3" width="8" height="6" rx="2"/><rect x="13" y="11" width="8" height="10" rx="2"/><rect x="3" y="15" width="8" height="6" rx="2"/></svg><span class="mz-launch-label">Mosaic</span>`
    );
    ui.launch.title = "Open Mosaic media wall (Alt+M)";
    ui.launch.onclick = () => openWall();
    document.body.appendChild(ui.launch);

    ui.root = el("div", "mz-root");
    ui.root.innerHTML = `
      <header class="mz-bar">
        <div class="mz-brand"><i></i>MOSAIC <span class="mz-badge">∞ UNLIMITED</span></div>
        <form class="mz-subform" title="Paste a Reddit URL or type r/name, u/name, u/name/m/feed">
          <input class="mz-subinput" type="text" placeholder="r/name · u/name/m/feed · paste URL" spellcheck="false" />
          <button type="submit" class="mz-subgo">Go</button>
        </form>
        <button class="mz-btn mz-watch-toggle" title="Save this source to Watchlist">☆ Watch</button>
        <select class="mz-watch-select" title="Saved sources"><option value="">★ Watchlist</option></select>
        <div class="mz-seg" data-k="filter">
          <button data-v="all">All</button><button data-v="image">Images</button><button data-v="video">Videos</button>
        </div>
        <select class="mz-sort"><option value="hot">Hot</option><option value="new">New</option><option value="top">Top</option><option value="rising">Rising</option></select>
        <select class="mz-time"><option value="hour">Hour</option><option value="day">Today</option><option value="week">Week</option><option value="month">Month</option><option value="year">Year</option><option value="all">All time</option></select>
        <label class="mz-cols">Cols <input type="range" min="1" max="12"></label>
        <button class="mz-btn mz-favs" title="Favorites">♥ <span>0</span></button>
        <button class="mz-btn mz-showhid" title="Show hidden">Hidden <span>0</span></button>
        <button class="mz-btn mz-turbo" title="Turbo Mode: auto-open Mosaic on supported Reddit pages">⚡ Turbo</button>
        <span class="mz-count"></span>
        <button class="mz-btn mz-gear" title="Settings (S)">⚙ Settings</button>
        <button class="mz-btn mz-close" title="Close (Esc)">✕</button>
      </header>
      <main class="mz-grid"></main>
      <div class="mz-status"><span class="mz-status-message"></span><span class="mz-next-frame" aria-live="polite"></span></div>
      <div class="mz-viewer">
        <div class="mz-stage"></div>
        <button class="mz-nav mz-prev">‹</button><button class="mz-nav mz-next">›</button>
        <aside class="mz-info"></aside>
        <div class="mz-tools">
          <label>Zoom <input class="mz-zoom" type="range" min="1" max="5" step="0.1" value="1"></label>
          <button class="mz-btn mz-play">▶ Slideshow</button>
          <button class="mz-btn mz-fav">♡ Favorite</button>
          <button class="mz-btn mz-dl">⬇ Download</button>
          <button class="mz-btn mz-hide">Hide</button>
          <button class="mz-btn mz-full">⛶</button>
          <button class="mz-btn mz-vgear" title="Settings (S)">⚙</button>
          <button class="mz-btn mz-vclose">✕</button>
        </div>
      </div>
      <div class="mz-setback"></div>
      <aside class="mz-settings">
        <div class="mz-sethead">
          <b>⚙ Settings</b>
          <input class="mz-setsearch" type="search" placeholder="Search settings…" spellcheck="false" />
          <button class="mz-btn mz-setclose" title="Close (Esc)">✕</button>
        </div>
        <div class="mz-setbody"></div>
        <div class="mz-setfoot">Saved automatically · press S to open or close</div>
      </aside>`;
    document.body.appendChild(ui.root);
    const q = (s) => ui.root.querySelector(s);
    Object.assign(ui, {
      grid: q(".mz-grid"),
      status: q(".mz-status"),
      statusMessage: q(".mz-status-message"),
      nextFrame: q(".mz-next-frame"),
      viewer: q(".mz-viewer"),
      stage: q(".mz-stage"),
      info: q(".mz-info"),
      sort: q(".mz-sort"),
      time: q(".mz-time"),
      cols: q(".mz-cols input"),
      count: q(".mz-count"),
      zoomIn: q(".mz-zoom"),
      subInput: q(".mz-subinput"),
      watchToggle: q(".mz-watch-toggle"),
      watchSelect: q(".mz-watch-select"),
      turboBtn: q(".mz-turbo"),
      launchLabel: ui.launch.querySelector(".mz-launch-label"),
      setBody: q(".mz-setbody"),
      setSearch: q(".mz-setsearch"),
    });
    ui.more = el("button", "mz-more", "Load more posts");
    ui.more.onclick = () => loadMore();

    q(".mz-gear").onclick = () => toggleSettings();
    q(".mz-vgear").onclick = () => toggleSettings();
    q(".mz-setclose").onclick = () => toggleSettings(false);
    q(".mz-setback").onclick = () => toggleSettings(false);
    ui.setSearch.oninput = applySearch;

    q(".mz-subform").onsubmit = (e) => {
      e.preventDefault();
      const src = parseSource(ui.subInput.value, true);
      if (src) {
        state.subreddit = src.label;
        ui.subInput.value = src.label;
        state.favView = false;
        syncWatchlistUI();
        reload();
      } else {
        setStatus("Couldn't read that. Paste a Reddit URL or type r/name, u/name, or u/name/m/feedname.");
      }
    };

    ui.watchToggle.onclick = () => {
      if (!state.subreddit) return;
      const idx = state.watchlist.findIndex((s) => s.toLowerCase() === state.subreddit.toLowerCase());
      if (idx >= 0) state.watchlist.splice(idx, 1);
      else state.watchlist.push(state.subreddit);
      store.set("mz_watchlist", state.watchlist);
      syncWatchlistUI();
    };

    ui.watchSelect.onchange = () => {
      const val = ui.watchSelect.value;
      if (val) {
        state.subreddit = val;
        ui.subInput.value = val;
        state.favView = false;
        syncWatchlistUI();
        reload();
        ui.watchSelect.value = "";
      }
    };

    ui.turboBtn.onclick = () => {
      state.turbo = !state.turbo;
      ui.turboBtn.classList.toggle("on", state.turbo);
      savePrefs();
      if (settingsOpen()) buildSettingsBody();
    };

    q(".mz-seg").onclick = (e) => {
      const v = e.target.dataset.v;
      if (v) {
        state.filter = v;
        savePrefs();
        render();
      }
    };
    ui.sort.onchange = () => {
      state.sort = ui.sort.value;
      savePrefs();
      reload();
    };
    ui.time.onchange = () => {
      state.time = ui.time.value;
      savePrefs();
      reload();
    };
    ui.cols.oninput = () => {
      state.cols = +ui.cols.value;
      savePrefs();
      applyCols();
      if (settingsOpen()) buildSettingsBody();
    };
    q(".mz-close").onclick = closeWall;
    q(".mz-favs").onclick = () => {
      state.favView = !state.favView;
      render();
    };
    q(".mz-showhid").onclick = () => {
      state.showHidden = !state.showHidden;
      render();
    };
    ui.grid.addEventListener("scroll", () => {
      if (settings.autoLoad && ui.grid.scrollTop + ui.grid.clientHeight > ui.grid.scrollHeight - settings.prefetch) loadMore();
    });

    q(".mz-prev").onclick = () => step(-1);
    q(".mz-next").onclick = () => step(1);
    q(".mz-vclose").onclick = closeViewer;
    q(".mz-play").onclick = toggleSlideshow;
    q(".mz-fav").onclick = () => toggleFav(visible()[state.index]);
    q(".mz-dl").onclick = () => downloadCurrent();
    q(".mz-hide").onclick = () => {
      const it = visible()[state.index];
      hide(it);
      if (!visible().length) closeViewer();
      else show(Math.min(state.index, visible().length - 1));
    };
    q(".mz-full").onclick = () =>
      document.fullscreenElement ? document.exitFullscreen() : ui.viewer.requestFullscreen();
    ui.zoomIn.oninput = () => setZoom(+ui.zoomIn.value);
    ui.stage.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const act = settings.wheelAction;
        if (e.ctrlKey || act === "zoom" || state.zoom > 1)
          setZoom(Math.min(settings.maxZoom, Math.max(1, state.zoom - e.deltaY * 0.002)));
        else if (act === "navigate" && Math.abs(e.deltaY) > 20) wheelStep(e.deltaY > 0 ? 1 : -1);
      },
      { passive: false }
    );
    let drag = null;
    ui.stage.addEventListener("mousedown", (e) => {
      if (state.zoom > 1) {
        drag = { x: e.clientX - state.panX, y: e.clientY - state.panY };
        e.preventDefault();
      }
    });
    window.addEventListener("mousemove", (e) => {
      if (drag) {
        state.panX = e.clientX - drag.x;
        state.panY = e.clientY - drag.y;
        applyZoom();
      }
    });
    window.addEventListener("mouseup", () => (drag = null));
    ui.stage.addEventListener("click", (e) => {
      if (e.target === ui.stage && settings.backdropClose) closeViewer();
    });
  }

  function syncWatchlistUI() {
    const inWatch =
      state.subreddit && state.watchlist.some((s) => s.toLowerCase() === state.subreddit.toLowerCase());
    ui.watchToggle.textContent = inWatch ? "★ Watched" : "☆ Watch";
    ui.watchToggle.classList.toggle("on", !!inWatch);
    ui.watchSelect.innerHTML =
      `<option value="">★ Watchlist (${state.watchlist.length})</option>` +
      state.watchlist.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
  }

  let wheelLock = 0;
  function wheelStep(d) {
    const now = Date.now();
    if (now - wheelLock > 350) {
      wheelLock = now;
      step(d);
    }
  }

  const mediaKey = (i) => {
    // For crossposts, use the original post ID as the key
    if (i.crosspost_parent) return i.crosspost_parent;
    // Otherwise use the media URL
    return String(i.full || i.video || i.slides?.[0]?.src || i.embed || "").split("?")[0];
  };

  // Content filters from Settings. Not applied to the Favorites view, so favorites never vanish.
  function passes(i) {
    if (i.type === "gallery" && !settings.showGalleries) return false;
    if (i.type === "video" && i.gif && !settings.showGifs) return false;
    if (i.embed && !settings.showEmbeds) return false;
    if (settings.nsfw === "hide" && i.nsfw) return false;
    if ((i.score || 0) < settings.minScore) return false;
    if (settings.minWidth && !i.embed && i.w && i.w < settings.minWidth) return false;
    if (blockedAuthors.length && blockedAuthors.includes(String(i.author || "").toLowerCase())) return false;
    if (blockedWords.length) {
      const t = String(i.title || "").toLowerCase();
      if (blockedWords.some((w) => t.includes(w))) return false;
    }
    return true;
  }

  function visible() {
    const pool = state.favView ? Object.values(state.favs) : state.items;
    const keys = new Set();
    return pool.filter((i) => {
      if (state.filter === "video" ? i.type !== "video" : state.filter === "image" && i.type === "video") return false;
      if (!state.showHidden && state.hidden.has(i.id)) return false;
      if (!state.favView) {
        if (!passes(i)) return false;
        if (settings.dedupe) {
          const k = mediaKey(i);
          if (k && k !== "") {
            if (keys.has(k)) return false;
            keys.add(k);
          }
        }
      }
      return true;
    });
  }

  // Masonry: real column elements that only ever grow downward. Each card goes into the shortest column,
  // so the wall scrolls vertically and cards never jump between columns as more posts load.
  function buildColumns() {
    ui.grid.innerHTML = "";
    ui.wall = el("div", "mz-wall");
    ui.cols_ = [];
    ui.colH = [];
    for (let i = 0; i < state.cols; i++) {
      const c = el("div", "mz-col");
      ui.wall.appendChild(c);
      ui.cols_.push(c);
      ui.colH.push(0);
    }
    ui.grid.appendChild(ui.wall);
    ui.grid.appendChild(ui.more);
  }
  // Every card in a column has the same width, so its height is proportional to its ratio.
  // Picking the shortest column from these estimates avoids forcing a layout for every card.
  function shortestColumn(ratio) {
    let bi = 0;
    for (let i = 1; i < ui.colH.length; i++) if (ui.colH[i] < ui.colH[bi]) bi = i;
    ui.colH[bi] += ratio + 0.02;
    return ui.cols_[bi];
  }
  function applyCols() {
    if (ui.grid) render();
  }
  function setStatus(t) {
    ui.statusMessage.textContent = t;
    syncStatusVisibility();
  }
  function setNextFrameStatus(t) {
    ui.nextFrame.textContent = t;
    syncStatusVisibility();
  }
  function syncStatusVisibility() {
    ui.status.style.display = ui.statusMessage.textContent || ui.nextFrame.textContent ? "flex" : "none";
  }

  function syncHeader() {
    ui.root.querySelectorAll(".mz-seg button").forEach((b) => b.classList.toggle("on", b.dataset.v === state.filter));
    ui.root.querySelector(".mz-favs span").textContent = Object.keys(state.favs).length;
    ui.root.querySelector(".mz-favs").classList.toggle("on", state.favView);
    ui.root.querySelector(".mz-showhid span").textContent = state.hidden.size;
    ui.root.querySelector(".mz-showhid").classList.toggle("on", state.showHidden);
    ui.turboBtn.classList.toggle("on", state.turbo);
    ui.time.style.display = state.sort === "top" ? "" : "none";
    ui.cols.value = state.cols;
  }

  function cardRatio(it) {
    if (settings.cardShape === "square") return 1;
    if (settings.cardShape === "wide") return 0.5625;
    const r = it.w && it.h ? it.h / it.w : 1;
    return settings.cardShape === "natural" ? Math.min(6, Math.max(0.15, r)) : Math.min(2.2, Math.max(0.4, r));
  }

  function updateMore() {
    if (!ui.more) return;
    const show = !settings.autoLoad && !state.done && !state.favView && state.items.length > 0;
    ui.more.style.display = show ? "block" : "none";
    ui.more.textContent = state.loading ? "Loading…" : "Load more posts";
  }

  function render(append) {
    syncHeader();
    const list = visible();
    ui.count.textContent = `${list.length} posts · ∞ unlimited`;
    if (!ui.wall || ui.cols_.length !== state.cols) append = false;
    const existing = append ? new Set([...ui.wall.querySelectorAll(".mz-card")].map((c) => c.dataset.id)) : null;
    if (!append) buildColumns();
    list.forEach((it) => {
      if (existing?.has(it.id)) return;
      const card = el(
        "figure",
        "mz-card" +
          (state.hidden.has(it.id) ? " is-hidden" : "") +
          (settings.dimSeen && state.seen.has(it.id) ? " mz-seen" : "") +
          (settings.nsfw === "blur" && it.nsfw ? " mz-blur" : "")
      );
      card.dataset.id = it.id;
      const ratio = cardRatio(it);
      card.style.aspectRatio = `1 / ${ratio}`;
      const badge =
        it.type === "gallery"
          ? `<em>▦ ${it.slides.length}</em>`
          : it.type === "video"
          ? `<em>${it.gif ? "GIF" : "▶"}</em>`
          : "";
      card.innerHTML = `${
        it.thumb ? `<img loading="lazy" src="${esc(it.thumb)}" alt="">` : `<div class="mz-ph">${esc(it.title)}</div>`
      }${badge}
        <figcaption><b>${esc(it.title)}</b><span>${esc(it.sub)}</span></figcaption>
        <div class="mz-cardtools"><button data-a="fav">${state.favs[it.id] ? "♥" : "♡"}</button><button data-a="hide">${
        state.hidden.has(it.id) ? "↺" : "✕"
      }</button></div>`;
      card.onclick = (e) => {
        const a = e.target.dataset.a;
        if (a === "fav") {
          e.stopPropagation();
          toggleFav(it);
          e.target.textContent = state.favs[it.id] ? "♥" : "♡";
          return;
        }
        if (a === "hide") {
          e.stopPropagation();
          hide(it);
          return;
        }
        show(visible().findIndex((x) => x.id === it.id));
      };
      shortestColumn(ratio).appendChild(card);
    });
    updateMore();
    if (!list.length && !state.loading)
      setStatus(state.favView ? "No favorites yet. Tap ♡ on any post." : "No media found for this filter.");
  }

  function hide(it) {
    if (!it) return;
    state.hidden.has(it.id) ? state.hidden.delete(it.id) : state.hidden.add(it.id);
    store.set("mz_hidden", [...state.hidden].slice(-5000));
    render();
  }
  function toggleFav(it) {
    if (!it) return;
    if (state.favs[it.id]) delete state.favs[it.id];
    else state.favs[it.id] = it;
    store.set("mz_favs", state.favs);
    ui.root.querySelector(".mz-favs span").textContent = Object.keys(state.favs).length;
    if (state.index >= 0)
      ui.root.querySelector(".mz-fav").textContent = state.favs[it.id] ? "♥ Favorited" : "♡ Favorite";
  }

  // ---------- Viewer ----------
  let slide = 0;
  function show(i, keepSlide) {
    const list = visible();
    if (i < 0 || i >= list.length) return;
    state.index = i;
    if (!keepSlide) slide = 0;
    setZoom(1);
    const it = list[i];
    ui.viewer.classList.add("open");
    ui.stage.innerHTML = "";
    markSeen(it);
    let node;
    if (it.type === "gallery") {
      const s = it.slides[slide];
      node = s.kind === "video" ? mediaVideo(s.src, true) : img(s.src);
      const dots = el("div", "mz-dots", it.slides.map((_, k) => `<i class="${k === slide ? "on" : ""}"></i>`).join(""));
      ui.stage.appendChild(dots);
    } else if (it.type === "image") node = img(it.full || it.thumb);
    else if (it.embed) {
      node = el("iframe", "mz-embed");
      node.src = it.embed;
      node.allow = "autoplay; fullscreen";
      node.allowFullscreen = true;
    } else node = mediaVideo(it.video, it.gif, it.audio);
    node.classList.add("mz-media");
    ui.stage.prepend(node);
    ui.info.innerHTML = `<a href="${esc(it.permalink)}" target="_blank" rel="noreferrer"><b>${esc(it.title)}</b></a>
      <span>${esc(it.sub)} · posted by u/${esc(it.author)}</span>
      <span>${it.type.toUpperCase()}${it.type === "gallery" ? ` ${slide + 1}/${it.slides.length}` : ""}${
      it.w > 100 ? ` · ${it.w}×${it.h}` : ""
    } · ${i + 1}/${list.length} (∞)</span>`;
    ui.root.querySelector(".mz-fav").textContent = state.favs[it.id] ? "♥ Favorited" : "♡ Favorite";
    ui.root.querySelector(".mz-hide").textContent = state.hidden.has(it.id) ? "Unhide" : "Hide";
    // Unlimited pre-fetching as user approaches the end of currently loaded items
    if (i > list.length - 10) loadMore();
    list.slice(i + 1, i + 1 + settings.preload).forEach((n) => {
      if (n?.type === "image") new Image().src = n.full;
    });
    armSlideshowForCurrentMedia();
  }

  function markSeen(it) {
    if (!it || state.seen.has(it.id)) return;
    state.seen.add(it.id);
    if (state.seen.size > 6000) state.seen = new Set([...state.seen].slice(-5000));
    store.set("mz_seen", [...state.seen]);
    if (settings.dimSeen) ui.grid.querySelector(`.mz-card[data-id="${CSS.escape(it.id)}"]`)?.classList.add("mz-seen");
  }

  function downloadCurrent() {
    const it = visible()[state.index];
    if (!it) return;
    let url = it.full || it.video || it.thumb;
    if (it.type === "gallery" && it.slides?.[slide]) url = it.slides[slide].src;
    if (!url) return;
    let extension = "";
    try {
      extension = new URL(url).pathname.match(/\.(jpe?g|png|webp|gif|mp4|webm)$/i)?.[0] || "";
    } catch {}
    const filename = extension
      ? `Mosaic/${(it.subreddit || "reddit").replace(/[^A-Za-z0-9_-]+/g, "_")}-${it.id}${extension}`
      : undefined;
    chrome.runtime.sendMessage({ type: "mosaic-download", url, filename }, (result) => {
      if (chrome.runtime.lastError || !result?.ok) {
        setStatus("Couldn't start the download. Check the extension's Downloads permission.");
        return;
      }
      setStatus("Download started.");
    });
  }

  function img(src) {
    const m = el("img");
    m.src = src;
    m.draggable = false;
    return m;
  }
  function mediaVideo(src, gif, audio) {
    const v = el("video");
    v.src = src;
    v.autoplay = settings.autoplay;
    v.preload = settings.autoplay ? "auto" : "metadata";
    v.loop = !!gif || settings.loopVideo;
    v.playsInline = true;
    v.controls = !gif;
    v.muted = !!gif || settings.startMuted;
    if (!gif) v.volume = Math.min(1, Math.max(0, settings.volume / 100));
    if (audio?.length) {
      const a = el("audio");
      let n = 0;
      a.volume = v.volume;
      a.muted = v.muted;
      a.src = audio[0];
      a.onerror = () => {
        if (++n < audio.length) a.src = audio[n];
      };
      const sync = () => {
        if (Math.abs(a.currentTime - v.currentTime) > 0.3) a.currentTime = v.currentTime;
      };
      v.onplay = () => {
        sync();
        a.play().catch(() => {});
      };
      v.onpause = () => a.pause();
      v.onseeked = sync;
      v.ontimeupdate = sync;
      v.onvolumechange = () => {
        a.volume = v.volume;
        a.muted = v.muted;
        rememberVolume(v);
      };
      v.addEventListener("ended", () => a.pause());
      v.__audio = a;
      v.appendChild(a);
    }
    if (!audio?.length && !gif) v.onvolumechange = () => rememberVolume(v);
    return v;
  }
  let volTimer = null;
  function rememberVolume(v) {
    if (!settings.rememberVolume || v.muted) return;
    clearTimeout(volTimer);
    volTimer = setTimeout(() => {
      settings.volume = Math.round(v.volume * 100);
      saveSettings();
    }, 400);
  }
  function stopMedia() {
    ui.stage.querySelectorAll("video").forEach((v) => {
      v.pause();
      v.__audio?.pause();
    });
    ui.stage.innerHTML = "";
  }
  function step(d) {
    const it = visible()[state.index];
    if (it?.type === "gallery") {
      const ns = slide + d;
      if (ns >= 0 && ns < it.slides.length) {
        slide = ns;
        stopMedia();
        return show(state.index, true);
      }
    }
    const ni = state.index + d;
    if (ni >= 0 && ni < visible().length) {
      stopMedia();
      show(ni);
    }
  }
  function closeViewer() {
    stopMedia();
    ui.viewer.classList.remove("open");
    state.index = -1;
    if (state.slideshow) toggleSlideshow();
    if (document.fullscreenElement) document.exitFullscreen();
  }
  function slideshowTick() {
    const list = visible();
    const cur = list[state.index];
    if (cur?.type === "gallery" && slide < cur.slides.length - 1) return step(1);
    const eligible = (x) => x && !(settings.slideshowSkipVideos && x.type === "video");
    let ni = state.index + 1;
    while (list[ni] && !eligible(list[ni])) ni++;
    if (!list[ni]) {
      if (!state.done && !state.favView) return loadMore(); // unlimited: wait for the next page
      if (!settings.slideshowLoop) return toggleSlideshow();
      ni = list.findIndex(eligible);
      if (ni < 0) return toggleSlideshow();
    }
    stopMedia();
    show(ni);
  }
  function clearSlideshowTimer() {
    if (!state.slideshow) return;
    if (state.slideshow.timer) clearTimeout(state.slideshow.timer);
    if (state.slideshow.countdown) clearInterval(state.slideshow.countdown);
    state.slideshow.timer = null;
    state.slideshow.countdown = null;
    state.slideshow.nextAt = null;
  }
  function formatCountdown(ms) {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes).padStart(2, "0")} minute${minutes === 1 ? "" : "s"} ${String(seconds % 60).padStart(2, "0")} second${seconds % 60 === 1 ? "" : "s"}`;
  }
  function updateImageCountdown() {
    if (!state.slideshow?.nextAt) return;
    setNextFrameStatus(`Next Frame in: ${formatCountdown(state.slideshow.nextAt - Date.now())}`);
  }
  function scheduleSlideshowTick() {
    if (!state.slideshow) return;
    clearSlideshowTimer();
    const duration = Math.max(1, settings.slideshowSeconds) * 1000;
    state.slideshow.nextAt = Date.now() + duration;
    updateImageCountdown();
    state.slideshow.countdown = setInterval(updateImageCountdown, 250);
    state.slideshow.timer = setTimeout(() => {
      clearSlideshowTimer();
      slideshowTick();
    }, duration);
  }
  function armSlideshowForCurrentMedia() {
    if (!state.slideshow) return;
    const video = ui.stage.querySelector("video.mz-media");
    if (!video) return scheduleSlideshowTick();
    clearSlideshowTimer();
    // A slideshow video must be allowed to finish once, even when the user's
    // normal video preference is to loop it. The next slide is scheduled only
    // after this exact video ends; manual next/previous controls still work.
    video.loop = false;
    const updateVideoCountdown = () => {
      if (Number.isFinite(video.duration)) setNextFrameStatus(`Next Frame in: ${formatCountdown((video.duration - video.currentTime) * 1000)}`);
      else setNextFrameStatus("Next Frame: when video ends");
    };
    updateVideoCountdown();
    video.addEventListener("loadedmetadata", updateVideoCountdown);
    video.addEventListener("timeupdate", updateVideoCountdown);
    video.addEventListener(
      "ended",
      () => {
        if (state.slideshow && ui.stage.querySelector("video.mz-media") === video) {
          setNextFrameStatus("");
          slideshowTick();
        }
      },
      { once: true }
    );
  }
  function toggleSlideshow() {
    const b = ui.root.querySelector(".mz-play");
    if (state.slideshow) {
      clearSlideshowTimer();
      state.slideshow = null;
      setNextFrameStatus("");
      b.textContent = "▶ Slideshow";
      return;
    }
    b.textContent = "❚❚ Pause";
    state.slideshow = { timer: null, countdown: null, nextAt: null };
    armSlideshowForCurrentMedia();
  }
  function setZoom(z) {
    state.zoom = z;
    if (z === 1) {
      state.panX = 0;
      state.panY = 0;
    }
    ui.zoomIn.value = z;
    applyZoom();
  }
  function applyZoom() {
    const m = ui.stage.querySelector("img.mz-media");
    if (m) m.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
    ui.stage.style.cursor = state.zoom > 1 ? "grab" : "";
  }

  // ---------- Settings panel ----------
  function sanitizeSettings(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    for (const k of Object.keys(DEFAULTS)) if (typeof raw[k] === typeof DEFAULTS[k]) out[k] = raw[k];
    if (out.theme && out.theme !== "custom" && !THEMES[out.theme]) delete out.theme;
    if (out.customAccent && !/^#[0-9a-f]{6}$/i.test(out.customAccent)) delete out.customAccent;
    return out;
  }

  let saveTimer = null;
  function saveSettings() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.set("mz_settings", settings), 250);
  }

  function compileLists() {
    const split = (t) =>
      String(t || "")
        .split(/[,\n]/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean);
    blockedWords = split(settings.blockedWords);
    blockedAuthors = split(settings.blockedAuthors).map((a) => a.replace(/^\/?u\//, ""));
  }

  function applyLook() {
    const [a, b] =
      settings.theme === "custom"
        ? [settings.customAccent, settings.customAccent]
        : (THEMES[settings.theme] || THEMES.crimson).slice(1);
    const black = settings.darkness === "black";
    for (const n of [ui.root, ui.launch]) {
      n.style.setProperty("--mz-accent", a);
      n.style.setProperty("--mz-accent-b", b);
      n.style.setProperty("--mz-on-accent", isLight(a) ? "#15110a" : "#ffffff");
      n.style.setProperty("--mz-bg", black ? "#000" : "#0b0a10");
      n.style.setProperty("--mz-panel", black ? "#0a0a0c" : "#121019");
      n.style.setProperty("--mz-gap", settings.gap + "px");
      n.style.setProperty("--mz-radius", settings.radius + "px");
    }
    ui.root.classList.toggle("mz-cap-always", settings.captions === "always");
    ui.root.classList.toggle("mz-cap-never", settings.captions === "never");
    ui.root.classList.toggle("mz-no-badges", !settings.badges);
    ui.root.classList.toggle("mz-no-hoverzoom", !settings.hoverZoom);
    ui.viewer.classList.toggle("mz-no-info", !settings.showInfo);
    ui.stage.classList.toggle("fit-cover", settings.fit === "cover");
    ui.launch.className = "mz-launch mz-pos-" + settings.launcher;
    ui.zoomIn.max = settings.maxZoom;
    if (state.zoom > settings.maxZoom) setZoom(settings.maxZoom);
  }

  function applyFx(fx) {
    if (!fx) return;
    for (const f of fx.split(",")) {
      if (f === "look") applyLook();
      else if (f === "lists") compileLists();
      else if (f === "render") render();
      else if (f === "more") updateMore();
      else if (f === "ui") syncHeader();
      else if (f === "launcher") checkSubredditRoute(true);
      else if (f === "slideshow" && state.slideshow) {
        toggleSlideshow();
        toggleSlideshow();
      }
    }
  }

  const SCHEMA = [
    {
      group: "Appearance",
      items: [
        { k: "theme", label: "Accent theme", type: "theme", fx: "look" },
        { k: "customAccent", label: "Custom accent color", type: "color", fx: "look", showIf: (s) => s.theme === "custom" },
        { k: "darkness", label: "Background", type: "select", fx: "look", options: [["normal", "Dark"], ["black", "Pure black (OLED)"]] },
      ],
    },
    {
      group: "Wall layout",
      items: [
        {
          label: "Columns", desc: "How many columns the wall uses.", type: "range", min: 1, max: 12, step: 1, fx: "render",
          get: () => state.cols, set: (v) => { state.cols = v; savePrefs(); },
        },
        { k: "gap", label: "Spacing", type: "range", min: 0, max: 30, step: 1, unit: "px", fx: "look" },
        { k: "radius", label: "Corner roundness", type: "range", min: 0, max: 28, step: 1, unit: "px", fx: "look" },
        {
          k: "cardShape", label: "Card shape", desc: "Smart keeps each post's shape within sensible limits. Natural never crops.",
          type: "select", fx: "render",
          options: [["smart", "Smart (limited crop)"], ["natural", "Natural (no crop)"], ["square", "Square"], ["wide", "Wide 16:9"]],
        },
        {
          k: "captions", label: "Titles on cards", type: "select", fx: "look",
          options: [["hover", "Show on hover"], ["always", "Always show"], ["never", "Never show"]],
        },
        { k: "badges", label: "Type badges", desc: "The GIF, video and gallery labels.", type: "toggle", fx: "look" },
        { k: "hoverZoom", label: "Zoom cards on hover", type: "toggle", fx: "look" },
        { k: "dimSeen", label: "Dim posts I've opened", desc: "Helps you spot what you haven't looked at yet.", type: "toggle", fx: "render" },
      ],
    },
    {
      group: "Content filters",
      items: [
        {
          k: "nsfw", label: "NSFW posts", desc: "Blurred cards clear up when you hover over them.",
          type: "select", fx: "render", options: [["show", "Show"], ["blur", "Blur in the wall"], ["hide", "Hide"]],
        },
        { k: "minScore", label: "Minimum score", desc: "Hide posts with fewer upvotes than this.", type: "number", min: 0, max: 1000000, step: 10, fx: "render" },
        { k: "minWidth", label: "Minimum image width", desc: "Hide low resolution media. 0 turns this off.", type: "number", min: 0, max: 8000, step: 100, unit: "px", fx: "render" },
        { k: "showGalleries", label: "Show galleries", type: "toggle", fx: "render" },
        { k: "showGifs", label: "Show GIFs", type: "toggle", fx: "render" },
        { k: "showEmbeds", label: "Show YouTube and Vimeo", type: "toggle", fx: "render" },
        { k: "dedupe", label: "Hide duplicate media", desc: "Skips crossposts that point at the same image or video.", type: "toggle", fx: "render" },
        {
          k: "blockedWords", label: "Blocked words", desc: "Hide posts whose title contains any of these. Separate with commas.",
          type: "textarea", placeholder: "spoiler, meme, ad", fx: "lists,render",
        },
        {
          k: "blockedAuthors", label: "Blocked users", desc: "Hide posts from these users. Separate with commas.",
          type: "textarea", placeholder: "username1, username2", fx: "lists,render",
        },
      ],
    },
    {
      group: "Loading",
      items: [
        {
          k: "pageSize", label: "Posts per request", desc: "Applies to the next page that loads.", type: "select", fx: "",
          options: [[25, "25"], [50, "50"], [100, "100 (fastest)"]], num: true,
        },
        { k: "autoLoad", label: "Load more as I scroll", desc: "Turn off to get a Load more button instead.", type: "toggle", fx: "more" },
        { k: "prefetch", label: "Start loading early", desc: "How far before the bottom the next page starts loading.", type: "range", min: 400, max: 4000, step: 100, unit: "px", fx: "" },
        { k: "useLogin", label: "Use my Reddit login", desc: "Needed for private feeds and to see your own NSFW settings.", type: "toggle", fx: "" },
      ],
    },
    {
      group: "Viewer",
      items: [
        { k: "fit", label: "Fit media", type: "select", fx: "look", options: [["contain", "Fit inside screen"], ["cover", "Fill screen (crops)"]] },
        {
          k: "wheelAction", label: "Mouse wheel", type: "select", fx: "",
          options: [["navigate", "Next / previous post"], ["zoom", "Zoom"], ["none", "Do nothing"]],
        },
        { k: "maxZoom", label: "Maximum zoom", type: "range", min: 2, max: 10, step: 1, unit: "×", fx: "look" },
        { k: "preload", label: "Preload upcoming images", desc: "Loads the next few images ahead of time so they open instantly.", type: "range", min: 0, max: 6, step: 1, fx: "" },
        { k: "showInfo", label: "Show title and details", type: "toggle", fx: "look" },
        { k: "backdropClose", label: "Click empty space to close", type: "toggle", fx: "" },
      ],
    },
    {
      group: "Video playback",
      items: [
        { k: "autoplay", label: "Autoplay videos", type: "toggle", fx: "" },
        { k: "startMuted", label: "Start muted", type: "toggle", fx: "" },
        { k: "volume", label: "Default volume", type: "range", min: 0, max: 100, step: 5, unit: "%", fx: "" },
        { k: "rememberVolume", label: "Remember volume", desc: "Saves the volume you set on the video player.", type: "toggle", fx: "" },
        { k: "loopVideo", label: "Loop videos", type: "toggle", fx: "" },
      ],
    },
    {
      group: "Slideshow",
      items: [
        { k: "slideshowSeconds", label: "Seconds per slide", type: "range", min: 1, max: 30, step: 1, unit: "s", fx: "slideshow" },
        { k: "slideshowSkipVideos", label: "Skip videos", type: "toggle", fx: "" },
        { k: "slideshowLoop", label: "Loop back to the start", desc: "Otherwise the slideshow stops when the feed ends.", type: "toggle", fx: "" },
      ],
    },
    {
      group: "Launcher and behavior",
      items: [
        {
          label: "Turbo mode", desc: "Open Mosaic automatically on supported Reddit pages.", type: "toggle", fx: "ui",
          get: () => state.turbo, set: (v) => { state.turbo = v; savePrefs(); },
        },
        {
          k: "launcher", label: "Launcher button", desc: "Where the Mosaic button sits on Reddit pages.", type: "select", fx: "look,launcher",
          options: [["bottom-right", "Bottom right"], ["bottom-left", "Bottom left"], ["top-right", "Top right"], ["top-left", "Top left"], ["hidden", "Hidden (use Alt+M or the toolbar icon)"]],
        },
      ],
    },
    {
      group: "Your data",
      items: [
        {
          type: "action", label: "Backup and restore",
          desc: "Export your settings, favorites, hidden posts and watchlist to a file, or restore from one.",
          buttons: () => [
            { label: "⬇ Export backup", run: exportData },
            { label: "⬆ Import backup", run: pickImport },
          ],
        },
        {
          type: "action", label: "Clean up", desc: "Remove saved data. This can't be undone.",
          buttons: () => [
            { label: `Clear hidden (${state.hidden.size})`, danger: true, run: () => clearData("hidden") },
            { label: `Clear viewed (${state.seen.size})`, danger: true, run: () => clearData("seen") },
            { label: `Clear favorites (${Object.keys(state.favs).length})`, danger: true, run: () => clearData("favs") },
          ],
        },
        {
          type: "action", label: "Reset", desc: "Put every setting back to its default. Favorites and hidden posts are kept.",
          buttons: () => [{ label: "↺ Reset all settings", danger: true, run: resetSettings }],
        },
      ],
    },
  ];

  const settingsOpen = () => !!ui.root && ui.root.classList.contains("mz-settings-open");

  function toggleSettings(force) {
    const open = force === undefined ? !settingsOpen() : force;
    if (open === settingsOpen()) return;
    if (open) {
      ui.setSearch.value = "";
      buildSettingsBody();
    }
    ui.root.classList.toggle("mz-settings-open", open);
  }

  function buildSettingsBody() {
    const body = ui.setBody;
    const scroll = body.scrollTop;
    body.innerHTML = "";
    ui.rows = [];
    for (const g of SCHEMA) {
      const sec = el("section", "mz-group");
      sec.appendChild(el("h3", null, esc(g.group)));
      sec._rows = [];
      for (const it of g.items) {
        const wide = it.type === "textarea" || it.type === "action" || it.type === "theme";
        const row = el("div", "mz-row" + (wide ? " wide" : ""));
        row._it = it;
        row._cond = true;
        row._match = true;
        row._search = `${it.label} ${it.desc || ""} ${g.group}`.toLowerCase();
        row.appendChild(el("div", "mz-rowtxt", `<b>${esc(it.label)}</b>${it.desc ? `<small>${esc(it.desc)}</small>` : ""}`));
        const ctl = el("div", "mz-ctl");
        row.appendChild(ctl);
        buildControl(it, ctl);
        sec.appendChild(row);
        sec._rows.push(row);
        ui.rows.push(row);
      }
      body.appendChild(sec);
    }
    body.appendChild(el("div", "mz-empty", "No settings match your search."));
    body.lastChild.style.display = "none";
    ui.emptyMsg = body.lastChild;
    refreshVisibility();
    body.scrollTop = scroll;
  }

  function buildControl(it, ctl) {
    const get = () => (it.get ? it.get() : settings[it.k]);
    const commit = (v) => {
      if (it.set) it.set(v);
      else settings[it.k] = v;
      saveSettings();
      applyFx(it.fx);
      refreshVisibility();
    };
    const fmt = (v) => `${v}${it.unit || ""}`;
    switch (it.type) {
      case "toggle": {
        const l = el("label", "mz-switch", '<input type="checkbox"><i></i>');
        const inp = l.firstChild;
        inp.checked = !!get();
        inp.onchange = () => commit(inp.checked);
        ctl.appendChild(l);
        break;
      }
      case "select": {
        const s = el("select");
        s.innerHTML = it.options.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("");
        s.value = String(get());
        s.onchange = () => commit(it.num ? +s.value : s.value);
        ctl.appendChild(s);
        break;
      }
      case "range": {
        const inp = el("input");
        inp.type = "range";
        inp.min = it.min;
        inp.max = it.max;
        inp.step = it.step;
        inp.value = get();
        const out = el("output", null, fmt(get()));
        // Layout changes rebuild the wall, so apply them on release instead of on every tick.
        const heavy = /render/.test(it.fx || "");
        inp.oninput = () => {
          out.textContent = fmt(inp.value);
          if (!heavy) commit(+inp.value);
        };
        if (heavy) inp.onchange = () => commit(+inp.value);
        ctl.append(inp, out);
        break;
      }
      case "number": {
        const inp = el("input");
        inp.type = "number";
        inp.min = it.min;
        inp.max = it.max;
        inp.step = it.step;
        inp.value = get();
        inp.onchange = () => {
          const v = Math.min(it.max, Math.max(it.min, Math.round(+inp.value || 0)));
          inp.value = v;
          commit(v);
        };
        ctl.appendChild(inp);
        if (it.unit) ctl.appendChild(el("output", null, it.unit));
        break;
      }
      case "textarea": {
        const ta = el("textarea");
        ta.value = get();
        ta.placeholder = it.placeholder || "";
        ta.spellcheck = false;
        ta.onchange = () => commit(ta.value);
        ctl.appendChild(ta);
        break;
      }
      case "color": {
        const inp = el("input");
        inp.type = "color";
        inp.value = get();
        inp.oninput = () => commit(inp.value);
        ctl.appendChild(inp);
        break;
      }
      case "theme": {
        const wrap = el("div", "mz-swatches");
        const entries = [
          ...Object.entries(THEMES).map(([id, [n, a, b]]) => [id, n, `linear-gradient(135deg, ${a}, ${b})`]),
          ["custom", "Custom color", "conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)"],
        ];
        for (const [id, name, bg] of entries) {
          const b = el("button", "mz-swatch" + (get() === id ? " on" : ""));
          b.type = "button";
          b.title = name;
          b.style.background = bg;
          b.onclick = () => {
            wrap.querySelectorAll(".mz-swatch").forEach((x) => x.classList.remove("on"));
            b.classList.add("on");
            commit(id);
          };
          wrap.appendChild(b);
        }
        ctl.appendChild(wrap);
        break;
      }
      case "action": {
        for (const b of it.buttons()) {
          const btn = el("button", "mz-btn" + (b.danger ? " danger" : ""), esc(b.label));
          btn.type = "button";
          btn.onclick = b.run;
          ctl.appendChild(btn);
        }
        break;
      }
    }
  }

  function updateRowVisibility(row) {
    row.style.display = row._cond && row._match ? "" : "none";
  }

  function refreshVisibility() {
    for (const row of ui.rows) {
      if (row._it.showIf) {
        row._cond = !!row._it.showIf(settings);
        updateRowVisibility(row);
      }
    }
    applySearch();
  }

  function applySearch() {
    if (!ui.rows) return;
    const q = ui.setSearch.value.trim().toLowerCase();
    let any = false;
    ui.setBody.querySelectorAll(".mz-group").forEach((sec) => {
      let shown = 0;
      for (const row of sec._rows) {
        row._match = !q || row._search.includes(q);
        updateRowVisibility(row);
        if (row._cond && row._match) shown++;
      }
      sec.style.display = shown ? "" : "none";
      if (shown) any = true;
    });
    if (ui.emptyMsg) ui.emptyMsg.style.display = any ? "none" : "block";
  }

  function toast(msg) {
    const t = el("div", "mz-toast", esc(msg));
    ui.root.appendChild(t);
    setTimeout(() => t.remove(), 2700);
  }

  // ---------- Backup, restore, reset ----------
  function persistAll() {
    store.set("mz_settings", settings);
    savePrefs();
    store.set("mz_favs", state.favs);
    store.set("mz_hidden", [...state.hidden].slice(-5000));
    store.set("mz_watchlist", state.watchlist);
    store.set("mz_seen", [...state.seen]);
  }

  function exportData() {
    const data = {
      app: "mosaic-gx",
      version: 2,
      exportedAt: new Date().toISOString(),
      settings,
      prefs: { filter: state.filter, sort: state.sort, time: state.time, cols: state.cols, turbo: state.turbo },
      favs: state.favs,
      hidden: [...state.hidden],
      watchlist: state.watchlist,
      seen: [...state.seen],
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `mosaic-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("Backup downloaded");
  }

  function pickImport() {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "application/json,.json";
    inp.onchange = () => inp.files[0] && importData(inp.files[0]);
    inp.click();
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(String(reader.result));
        if (d?.app !== "mosaic-gx") throw new Error("not a Mosaic backup");
        Object.assign(settings, sanitizeSettings(d.settings));
        if (d.prefs && typeof d.prefs === "object") {
          for (const k of ["filter", "sort", "time"]) if (typeof d.prefs[k] === "string") state[k] = d.prefs[k];
          if (Number.isInteger(d.prefs.cols)) state.cols = Math.min(12, Math.max(1, d.prefs.cols));
          if (typeof d.prefs.turbo === "boolean") state.turbo = d.prefs.turbo;
        }
        if (d.favs && typeof d.favs === "object") Object.assign(state.favs, d.favs);
        if (Array.isArray(d.hidden)) d.hidden.forEach((x) => state.hidden.add(String(x)));
        if (Array.isArray(d.seen)) d.seen.forEach((x) => state.seen.add(String(x)));
        if (Array.isArray(d.watchlist)) {
          for (const w of d.watchlist) if (typeof w === "string" && !state.watchlist.includes(w)) state.watchlist.push(w);
        }
        persistAll();
        compileLists();
        applyLook();
        checkSubredditRoute(true);
        ui.sort.value = state.sort;
        ui.time.value = state.time;
        syncWatchlistUI();
        render();
        buildSettingsBody();
        toast("Backup imported");
      } catch (err) {
        toast("That file isn't a valid Mosaic backup");
      }
    };
    reader.readAsText(file);
  }

  function clearData(what) {
    const names = { hidden: "hidden posts", seen: "viewed history", favs: "favorites" };
    if (!confirm(`Clear all ${names[what]}? This can't be undone.`)) return;
    if (what === "hidden") {
      state.hidden.clear();
      store.set("mz_hidden", []);
    } else if (what === "seen") {
      state.seen.clear();
      store.set("mz_seen", []);
    } else {
      state.favs = {};
      store.set("mz_favs", {});
    }
    render();
    buildSettingsBody();
    toast(`Cleared ${names[what]}`);
  }

  function resetSettings() {
    if (!confirm("Reset every setting to its default?")) return;
    Object.assign(settings, DEFAULTS);
    state.cols = 4;
    state.turbo = false;
    persistAll();
    compileLists();
    applyLook();
    checkSubredditRoute(true);
    render();
    buildSettingsBody();
    toast("Settings reset to defaults");
  }

  // ---------- Open / close & route watcher ----------
  function reload() {
    state.items = [];
    state.seenIds = new Set();
    state.after = null;
    state.pagesLoaded = 0;
    state.done = false;
    ui.grid.scrollTop = 0;
    render();
    loadMore();
  }

  function openWall(forcedSub) {
    const sub = forcedSub || currentSubredditFromUrl() || state.subreddit;
    if (!sub) {
      alert("Open a subreddit, a custom feed (reddit.com/user/name/m/feed) or a user page first.");
      return;
    }
    state.subreddit = sub;
    ui.subInput.value = sub;
    syncWatchlistUI();
    if (!state.open) {
      state.open = true;
      state.favView = false;
      ui.root.classList.add("open");
      document.documentElement.classList.add("mz-lock");
    }
    applyCols();
    reload();
  }

  function closeWall() {
    toggleSettings(false);
    closeViewer();
    state.open = false;
    ui.root.classList.remove("open");
    document.documentElement.classList.remove("mz-lock");
  }

  // Remember what this script wrote, so the storage listener below can tell its own writes
  // from changes made in the toolbar popup.
  const ownPrefs = new Set();
  function savePrefs() {
    const prefs = { filter: state.filter, sort: state.sort, time: state.time, cols: state.cols, turbo: state.turbo };
    ownPrefs.add(JSON.stringify(prefs));
    if (ownPrefs.size > 30) ownPrefs.delete(ownPrefs.values().next().value);
    store.set("mz_prefs", prefs);
  }

  // Quick settings changed in the popup: apply them to the wall right away.
  function onPrefsChanged(next) {
    if (!next || typeof next !== "object" || !ui.root) return;
    if (ownPrefs.has(JSON.stringify(next))) return;
    const reloadNeeded = (next.sort && next.sort !== state.sort) || (next.time && next.time !== state.time);
    if (["all", "image", "video"].includes(next.filter)) state.filter = next.filter;
    if (["hot", "new", "top", "rising"].includes(next.sort)) state.sort = next.sort;
    if (["hour", "day", "week", "month", "year", "all"].includes(next.time)) state.time = next.time;
    if (Number.isInteger(next.cols)) state.cols = Math.min(12, Math.max(1, next.cols));
    if (typeof next.turbo === "boolean") state.turbo = next.turbo;
    ui.sort.value = state.sort;
    ui.time.value = state.time;
    if (state.open) {
      if (reloadNeeded) reload();
      else render();
    } else syncHeader();
    if (settingsOpen()) buildSettingsBody();
  }

  // Watch URL changes in Reddit's SPA so the launcher only shows on supported listing pages
  let lastPath = "";
  function checkSubredditRoute(force) {
    if (!force && location.pathname === lastPath) return;
    lastPath = location.pathname;
    const sub = currentSubredditFromUrl();
    if (sub && settings.launcher !== "hidden") {
      ui.launch.style.display = "flex";
      ui.launchLabel.textContent = `Mosaic · ${sub}`;
    } else {
      ui.launch.style.display = "none";
    }
    if (sub && !force && state.turbo && !state.open) openWall(sub);
  }

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.altKey && e.key.toLowerCase() === "m") {
        if (!currentSubredditFromUrl() && !state.open) return;
        e.preventDefault();
        state.open ? closeWall() : openWall();
        return;
      }
      if (!state.open) return;
      if (e.key === "Escape" && settingsOpen()) {
        toggleSettings(false);
        return;
      }
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      const inViewer = state.index >= 0;
      if (e.key.toLowerCase() === "s" && !e.ctrlKey && !e.metaKey && !e.altKey) toggleSettings();
      else if (e.key === "Escape") inViewer ? closeViewer() : closeWall();
      else if (inViewer && (e.key === "ArrowRight" || e.key === "d")) step(1);
      else if (inViewer && (e.key === "ArrowLeft" || e.key === "a")) step(-1);
      else if (inViewer && e.key === " ") {
        e.preventDefault();
        toggleSlideshow();
      } else if (inViewer && e.key === "f") ui.root.querySelector(".mz-full").click();
      else if (inViewer && e.key === "h") ui.root.querySelector(".mz-hide").click();
      else if (inViewer && e.key === "l") toggleFav(visible()[state.index]);
      else if (inViewer && (e.key === "+" || e.key === "=")) setZoom(Math.min(settings.maxZoom, state.zoom + 0.5));
      else if (inViewer && e.key === "-") setZoom(Math.max(1, state.zoom - 0.5));
      else if (e.key === "1") {
        state.filter = "all";
        render();
      } else if (e.key === "2") {
        state.filter = "image";
        render();
      } else if (e.key === "3") {
        state.filter = "video";
        render();
      }
    },
    true
  );

  // Messages from the toolbar popup.
  chrome.runtime.onMessage.addListener((m, _sender, sendResponse) => {
    if (m?.type !== "mosaic-open") return;
    if (!ui.root) {
      sendResponse({ ok: false, error: "loading" });
      return;
    }
    const src = m.source ? parseSource(m.source, true) : null;
    openWall(src ? src.label : undefined);
    if (m.settings) toggleSettings(true);
    sendResponse({ ok: true });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.mz_prefs) onPrefsChanged(changes.mz_prefs.newValue);
  });

  (async () => {
    const prefs = await store.get("mz_prefs", {});
    Object.assign(state, prefs);
    Object.assign(settings, sanitizeSettings(await store.get("mz_settings", {})));
    state.seen = new Set(await store.get("mz_seen", []));
    state.hidden = new Set(await store.get("mz_hidden", []));
    state.favs = await store.get("mz_favs", {});
    state.watchlist = (await store.get("mz_watchlist", state.watchlist)).map((n) => (n.includes("/") ? n : `r/${n}`));
    buildUI();
    compileLists();
    applyLook();
    ui.sort.value = state.sort;
    ui.time.value = state.time;
    ui.cols.value = state.cols;
    syncWatchlistUI();
    checkSubredditRoute();
    setInterval(checkSubredditRoute, 600);

    // The popup asked to open a source in this tab and the page had to load first.
    const pend = await store.get("mz_pending", null);
    if (pend && Date.now() - pend.ts < 30000) {
      store.set("mz_pending", null);
      const src = parseSource(pend.source, true);
      if (src && !(state.open && state.subreddit === src.label)) openWall(src.label);
      if (pend.settings) toggleSettings(true);
    }
  })();
})();
