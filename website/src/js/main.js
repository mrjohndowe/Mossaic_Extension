/* ═══════════════════════════════════════════════════════════════
   MOSAIC FOR REDDIT — landing page behaviour
   Vanilla ES modules. No dependencies.
   ═══════════════════════════════════════════════════════════════ */

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ─── media data ─────────────────────────────────────────────── */
const px = (id, w, h, ext = "jpeg") =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.${ext}?auto=compress&cs=tinysrgb&fit=crop&w=${w}&h=${h}`;

const TILES = [
  { id: 39902833, r: 0.68, type: "image",   sub: "r/EarthPorn",           title: "Rocky peaks pushing through the mist",        votes: "12.4k", comments: 428 },
  { id: 13590914, r: 0.67, type: "image",   sub: "r/pics",                title: "Downtown crossing, ten minutes after rain",   votes: "8.1k",  comments: 211 },
  { id: 14595972, r: 0.78, type: "gallery", sub: "r/Art",                 title: "Fluid acrylic study — process in slide 4",    votes: "6.7k",  comments: 183, slides: 4 },
  { id: 16061367, r: 0.67, type: "gif",     sub: "r/travel",              title: "València at 17°, looping",                    votes: "5.2k",  comments: 96  },
  { id: 30486228, r: 0.56, type: "image",   sub: "r/oddlysatisfying",     title: "Paint splatter, extreme macro",               votes: "4.9k",  comments: 142 },
  { id: 19367169, r: 1.62, type: "video",   sub: "r/NatureIsFuckingLit",  title: "Two goats working a misty hillside",          votes: "9.3k",  comments: 307 },
  { id: 40019067, r: 0.76, type: "image",   sub: "r/blade_runner",        title: "Neon wash on a wet Hong Kong street",         votes: "7.8k",  comments: 254 },
  { id: 31023734, r: 0.57, type: "gallery", sub: "r/AbstractArt",         title: "Six panels, one colour argument",             votes: "3.4k",  comments: 88,  slides: 6 },
  { id: 10856032, r: 0.68, type: "image",   sub: "r/MadeMeSmile",         title: "Cow, fog, absolutely no concerns",            votes: "11.2k", comments: 361 },
  { id: 19133646, r: 0.75, type: "gif",     sub: "r/mildlyinteresting",   title: "Signage glowing, animated",                   votes: "2.1k",  comments: 47  },
  { id: 38332829, r: 0.67, type: "image",   sub: "r/UrbanHell",           title: "Orange wall against a grey afternoon",        votes: "3.9k",  comments: 129 },
  { id: 29511840, r: 0.67, type: "image",   sub: "r/EarthPorn",           title: "Autumn ridgeline, Italian Alps",              votes: "14.7k", comments: 402 },
  { id: 16415242, r: 0.76, type: "gallery", sub: "r/Art",                 title: "Bold strokes, three canvases",                votes: "2.8k",  comments: 74,  slides: 3 },
  { id: 1722380,  r: 1.44, type: "image",   sub: "r/graffiti",            title: "Shutter mural under warm street light",       votes: "1.9k",  comments: 52  },
  { id: 30874923, r: 0.56, type: "image",   sub: "r/AbstractArt",         title: "Blue against orange, expressionist",          votes: "4.2k",  comments: 118 },
  { id: 26732100, r: 0.67, type: "gif",     sub: "r/LiminalSpace",        title: "Empty alley, 2am, humming neon",              votes: "6.4k",  comments: 233 },
  { id: 19020563, r: 0.86, type: "video",   sub: "r/Switzerland",         title: "Snow line above Hergiswil",                   votes: "5.6k",  comments: 141, ext: "png" },
  { id: 30680067, r: 0.56, type: "gallery", sub: "r/Art",                 title: "Vivid brushwork, five slides",                votes: "3.1k",  comments: 92,  slides: 5 },
  { id: 30588447, r: 1.5,  type: "image",   sub: "r/streetphotography",   title: "Electric shop closing time",                  votes: "2.4k",  comments: 63  },
  { id: 10798742, r: 0.66, type: "image",   sub: "r/fog",                 title: "Peak, cloud, bare foreground trees",          votes: "7.1k",  comments: 187 },
  { id: 14930345, r: 1.5,  type: "image",   sub: "r/EarthPorn",           title: "Fog settling over the cliffs",                votes: "4.6k",  comments: 111 },
  { id: 38757792, r: 1.48, type: "video",   sub: "r/mountaineering",      title: "Green slopes, low cloud, slow pan",           votes: "3.7k",  comments: 98  },
  { id: 30641513, r: 0.67, type: "image",   sub: "r/Tokyo",               title: "Silhouettes on a quiet Tokyo street",         votes: "8.9k",  comments: 276 },
  { id: 16470356, r: 0.75, type: "image",   sub: "r/Art",                 title: "Acrylic close-up, marked NSFW by mod",        votes: "1.4k",  comments: 39, nsfw: true },
  { id: 31023734, r: 0.6,  type: "gif",     sub: "r/AbstractArt",         title: "Swirl loop, marked NSFW by mod",              votes: "1.1k",  comments: 28, nsfw: true },
];

const TYPE_LABEL = { image: "IMG", gallery: "GALLERY", gif: "GIF", video: "VIDEO" };
const safe = t => t.filter(x => !x.nsfw);

/* ─── tile factory ───────────────────────────────────────────── */
function makeTile(t, i, opts = {}) {
  const el = document.createElement("figure");
  el.className = "tile" + (t.nsfw ? " is-nsfw" : "");
  el.tabIndex = 0;
  el.dataset.type = t.type;
  el.dataset.index = i;
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", `${t.title} — ${t.sub}, ${TYPE_LABEL[t.type]}. Open in viewer.`);

  const tw = opts.thumbW || 460;
  const th = Math.round(tw / t.r);

  el.innerHTML = `
    <img class="tile__img" src="${px(t.id, tw, th, t.ext)}" width="${tw}" height="${th}"
         alt="${t.title}" loading="lazy" decoding="async" draggable="false" />
    <span class="tile__type" data-t="${t.type}">${TYPE_LABEL[t.type]}</span>
    ${t.slides ? `<span class="tile__badge">1/${t.slides}</span>` : ""}
    ${t.type === "video" || t.type === "gif" ? `<span class="tile__play"><i></i></span>` : ""}
    ${t.nsfw ? `<span class="tile__badge" data-b="nsfw" style="top:auto;bottom:8px;right:8px;color:#FF8A6B">NSFW</span>` : ""}
    <figcaption class="tile__over">
      <span class="tile__sub">${t.sub}</span>
      <span class="tile__title">${t.title}</span>
      <span class="tile__stats"><span>▲ ${t.votes}</span><span>💬 ${t.comments}</span></span>
    </figcaption>`;

  if (!REDUCED) el.style.animationDelay = `${Math.min(i * 34, 620)}ms`;

  const img = el.querySelector("img");
  img.addEventListener("error", () => {
    img.remove();
    el.style.aspectRatio = `1 / ${Math.max(0.7, t.r).toFixed(2)}`;
    el.style.background = `linear-gradient(135deg,#26313A,#161C21)`;
  });
  return el;
}

/* ─── walls ──────────────────────────────────────────────────── */
const FEED = safe(TILES);                       // 23 items shown in the hero wall
const wallGrid = $("#wallGrid");
const wallTiles = [];

FEED.forEach((t, i) => {
  const el = makeTile(t, i);
  wallGrid.appendChild(el);
  wallTiles.push(el);
});

const baWall = $("#baWall");
FEED.slice(0, 14).forEach((t, i) => {
  const el = makeTile(t, i, { thumbW: 300 });
  el.tabIndex = -1;
  el.removeAttribute("role");
  baWall.appendChild(el);
});

const pwall = $("#pwall");
TILES.forEach((t, i) => {
  const el = makeTile(t, i, { thumbW: 340 });
  el.tabIndex = -1;
  el.removeAttribute("role");
  pwall.appendChild(el);
});

/* ─── filters ────────────────────────────────────────────────── */
const chips = $$("#filters .chip");
const countEl = $("#tileCount");
let activeFilter = "all";

chips.forEach(chip => {
  chip.addEventListener("click", () => {
    chips.forEach(c => c.classList.remove("is-on"));
    chip.classList.add("is-on");
    activeFilter = chip.dataset.filter;

    let shown = 0;
    wallTiles.forEach(el => {
      const match = activeFilter === "all" || el.dataset.type === activeFilter;
      el.classList.toggle("is-hidden", !match);
      if (match) {
        shown++;
        if (!REDUCED) {
          el.style.animation = "none";
          void el.offsetWidth;
          el.style.animation = "";
          el.style.animationDelay = `${Math.min(shown * 22, 400)}ms`;
        }
      }
    });
    countEl.textContent = shown;
    toast(`${shown} ${activeFilter === "all" ? "items" : TYPE_LABEL[activeFilter] + " items"} in view`);
  });
});

/* ─── lightbox ───────────────────────────────────────────────── */
const lb      = $("#lb");
const lbImg   = $("#lbImg");
const lbSub   = $("#lbSub");
const lbAuth  = $("#lbAuthor");
const lbTitle = $("#lbTitle");
const lbMeta  = $("#lbMeta");
const lbCount = $("#lbCount");
const lbBar   = $("#lbBar");
const lbHint  = $("#lbHint");

let lbList = [];
let lbIndex = 0;
let lbZoom = 1;
let lbSlideTimer = null;
let lbLastFocus = null;

const visibleTiles = () => wallTiles.filter(el => !el.classList.contains("is-hidden"));

function openLightbox(tileEl) {
  lbList = visibleTiles();
  lbIndex = lbList.indexOf(tileEl);
  if (lbIndex < 0) lbIndex = 0;
  lbLastFocus = document.activeElement;

  lb.hidden = false;
  requestAnimationFrame(() => lb.classList.add("is-open"));
  document.body.style.overflow = "hidden";
  renderLightbox();
  setTimeout(() => lbHint.classList.add("is-gone"), 3200);
  $("#lbClose").focus();
}

function closeLightbox() {
  stopSlideshow();
  lb.classList.remove("is-open");
  if (document.fullscreenElement) document.exitFullscreen?.();
  setTimeout(() => { lb.hidden = true; document.body.style.overflow = ""; }, 260);
  lbLastFocus?.focus?.();
}

function renderLightbox(dir = 0) {
  const el = lbList[lbIndex];
  if (!el) return;
  const t = FEED[+el.dataset.index];
  const w = 1400, h = Math.round(w / t.r);

  lbImg.classList.add("is-swap");
  setTimeout(() => {
    lbImg.src = px(t.id, w, h, t.ext);
    lbImg.alt = t.title;
    lbImg.classList.remove("is-swap");
  }, REDUCED ? 0 : 160);

  lbSub.textContent   = t.sub;
  lbAuth.textContent  = "u/" + (t.sub.replace("r/", "").toLowerCase().replace(/[^a-z]/g, "") || "redditor");
  lbTitle.textContent = t.title;
  lbMeta.textContent  = `${TYPE_LABEL[t.type]}${t.slides ? " · " + t.slides + " slides" : ""} · ${w} × ${h} · ▲ ${t.votes} · 💬 ${t.comments}`;
  lbCount.textContent = `${lbIndex + 1} / ${lbList.length}`;
  lbBar.style.width   = `${((lbIndex + 1) / lbList.length) * 100}%`;
  setZoom(1);
  if (dir) nudge(dir);
}

function nudge(dir) {
  lbImg.animate?.(
    [{ transform: `translateX(${dir * 26}px)`, opacity: 0 }, { transform: "none", opacity: 1 }],
    { duration: REDUCED ? 0 : 340, easing: "cubic-bezier(.16,1,.3,1)" }
  );
}

function step(d) {
  lbIndex = (lbIndex + d + lbList.length) % lbList.length;
  renderLightbox(d);
}

function setZoom(z) {
  lbZoom = Math.min(4, Math.max(0.4, z));
  lbImg.style.transform = `scale(${lbZoom})`;
  lbImg.style.cursor = lbZoom > 1 ? "zoom-out" : "zoom-in";
}

function toggleSlideshow(force) {
  const on = force ?? !lbSlideTimer;
  if (on && !lbSlideTimer) {
    lb.classList.add("is-slide");
    $("#lbSlide").textContent = "❚❚";
    lbSlideTimer = setInterval(() => step(1), 4000);
    toast("Slideshow on — Space to pause");
  } else if (!on && lbSlideTimer) {
    stopSlideshow();
    toast("Slideshow paused");
  }
}
function stopSlideshow() {
  clearInterval(lbSlideTimer);
  lbSlideTimer = null;
  lb.classList.remove("is-slide");
  const b = $("#lbSlide"); if (b) b.textContent = "▶";
}

wallGrid.addEventListener("click", e => {
  const tile = e.target.closest(".tile");
  if (tile) openLightbox(tile);
});
wallGrid.addEventListener("keydown", e => {
  const tile = e.target.closest(".tile");
  if (tile && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openLightbox(tile); }
});

$("#lbPrev").onclick = () => step(-1);
$("#lbNext").onclick = () => step(1);
$("#lbClose").onclick = closeLightbox;
$("#lbZoomIn").onclick = () => setZoom(lbZoom + 0.35);
$("#lbZoomOut").onclick = () => setZoom(lbZoom - 0.35);
$("#lbFit").onclick = () => { setZoom(1); toast("Fit to screen"); };
$("#lbSlide").onclick = () => toggleSlideshow();
$("#lbFull").onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else lb.requestFullscreen?.();
};
lb.addEventListener("click", e => { if (e.target === lb || e.target.id === "lbStage") closeLightbox(); });
lbImg.addEventListener("click", () => setZoom(lbZoom > 1 ? 1 : 2));
$("#lbStage").addEventListener("wheel", e => {
  e.preventDefault();
  setZoom(lbZoom + (e.deltaY < 0 ? 0.22 : -0.22));
}, { passive: false });

/* ─── global keyboard ────────────────────────────────────────── */
document.addEventListener("keydown", e => {
  if (lb.hidden === false) {
    switch (e.key) {
      case "ArrowRight": e.preventDefault(); step(1);  break;
      case "ArrowLeft":  e.preventDefault(); step(-1); break;
      case "Escape":     closeLightbox(); break;
      case " ":          e.preventDefault(); toggleSlideshow(); break;
      case "+": case "=": setZoom(lbZoom + 0.35); break;
      case "-": case "_": setZoom(lbZoom - 0.35); break;
      case "f": case "F":
        document.fullscreenElement ? document.exitFullscreen?.() : lb.requestFullscreen?.();
        break;
    }
    return;
  }
  if (e.key === "Escape" && mobileNav.classList.contains("is-open")) closeMobile();
});

/* ─── toast ──────────────────────────────────────────────────── */
const toastEl = $("#toast");
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 2200);
}

/* ─── scroll progress · sticky bar · to-top ──────────────────── */
const bar = $("#progress"), topbar = $("#topbar"), toTop = $("#toTop");
let raf = false;
function onScroll() {
  if (raf) return;
  raf = true;
  requestAnimationFrame(() => {
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = `${h > 0 ? (scrollY / h) * 100 : 0}%`;
    topbar.classList.toggle("is-stuck", scrollY > 24);
    toTop.classList.toggle("is-on", scrollY > 700);
    raf = false;
  });
}
addEventListener("scroll", onScroll, { passive: true });
onScroll();
toTop.onclick = () => scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" });

/* ─── reveal on scroll ───────────────────────────────────────── */
const revealIO = new IntersectionObserver((entries, obs) => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add("is-in");
    obs.unobserve(en.target);
  });
}, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
$$(".reveal, .never").forEach(el => revealIO.observe(el));

/* ─── animated counters ──────────────────────────────────────── */
const countIO = new IntersectionObserver((entries, obs) => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    const el = en.target;
    const target = +el.dataset.count;
    const suffix = el.dataset.suffix || "";
    if (REDUCED || target === 0) { el.textContent = target + suffix; obs.unobserve(el); return; }
    const t0 = performance.now(), dur = 1100;
    const tick = now => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    obs.unobserve(el);
  });
}, { threshold: 0.5 });
$$("[data-count]").forEach(el => countIO.observe(el));

/* ─── before / after drag ────────────────────────────────────── */
const ba = $("#ba"), baHandle = $("#baHandle");
let dragging = false;

function setPos(clientX) {
  const rect = ba.getBoundingClientRect();
  const p = Math.min(96, Math.max(4, ((clientX - rect.left) / rect.width) * 100));
  ba.style.setProperty("--pos", p + "%");
  baHandle.setAttribute("aria-valuenow", Math.round(p));
}
ba.addEventListener("pointerdown", e => {
  dragging = true; ba.setPointerCapture(e.pointerId); setPos(e.clientX);
  ba.style.cursor = "ew-resize";
});
ba.addEventListener("pointermove", e => { if (dragging) setPos(e.clientX); });
["pointerup", "pointercancel"].forEach(ev =>
  ba.addEventListener(ev, () => { dragging = false; ba.style.cursor = ""; }));
baHandle.addEventListener("keydown", e => {
  const cur = parseFloat(getComputedStyle(ba).getPropertyValue("--pos")) || 50;
  if (e.key === "ArrowLeft")  { e.preventDefault(); ba.style.setProperty("--pos", Math.max(4, cur - 4) + "%"); }
  if (e.key === "ArrowRight") { e.preventDefault(); ba.style.setProperty("--pos", Math.min(96, cur + 4) + "%"); }
});
ba.style.setProperty("--pos", "50%");

/* ─── viewer: scroll-driven stage ────────────────────────────── */
const vstage = $("#vstage"), vImg = $("#vImg"), vZoom = $("#vZoom"), vMode = $("#vMode");
const vIdx = $("#vIdx"), vSub = $("#vSub"), vMeta = $("#vMeta"), vBar = $("#vBar");
const vPlay = $("#vPlay"), vScreen = $("#vstage .vstage__screen");

const SCENES = {
  open:  { mode: "FIT",       zoom: null, sub: "r/EarthPorn",          idx: "04 / 20", meta: "3024 × 4032 · i.redd.it", play: false, full: false, nav: false, run: false },
  keys:  { mode: "FIT",       zoom: null, sub: "r/pics",               idx: "05 / 20", meta: "3629 × 5444 · i.redd.it", play: false, full: false, nav: true,  run: false },
  zoom:  { mode: "1:1 PIXELS",zoom: 180,  sub: "r/UrbanHell",          idx: "06 / 20", meta: "4640 × 6960 · original",  play: false, full: true,  nav: false, run: false },
  slide: { mode: "SLIDESHOW", zoom: null, sub: "r/EarthPorn",          idx: "07 / 20", meta: "4s interval · autoplay",  play: false, full: false, nav: false, run: true },
  video: { mode: "VIDEO 1.25×",zoom: null,sub: "r/Tokyo",              idx: "08 / 20", meta: "v.redd.it · muted · loop",play: true,  full: false, nav: false, run: false },
};

function applyScene(name) {
  const s = SCENES[name]; if (!s) return;
  vMode.textContent = s.mode;
  vSub.textContent = s.sub;
  vIdx.textContent = s.idx;
  vMeta.textContent = s.meta;
  vPlay.hidden = !s.play;
  vstage.classList.toggle("is-full", s.full);
  vstage.classList.toggle("is-nav", s.nav);
  $(".vslideshow").classList.toggle("is-run", s.run);
  vBar.style.width = s.run ? "" : `${(parseInt(s.idx) / 20) * 100}%`;
  if (s.zoom) { vZoom.textContent = s.zoom + "%"; vZoom.classList.add("is-on"); vImg.style.transform = `scale(${s.zoom / 100})`; }
  else { vZoom.classList.remove("is-on"); vImg.style.transform = ""; }
  $$(".vtool").forEach(t => t.classList.remove("is-hot"));
  if (name === "zoom") $('[data-tool="zoomin"]')?.classList.add("is-hot");
  if (name === "open") $('[data-tool="fit"]')?.classList.add("is-hot");
  if (name === "keys") { vImg.style.transform = ""; }
}

const steps = $$(".step");
const stepIO = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    steps.forEach(s => s.classList.remove("is-active"));
    en.target.classList.add("is-active");
    const img = en.target.dataset.img;
    if (img && vImg.src !== img) {
      vImg.style.opacity = 0;
      setTimeout(() => { vImg.src = img; vImg.style.opacity = 1; }, REDUCED ? 0 : 180);
    }
    applyScene(en.target.dataset.step);
  });
}, { threshold: 0.5, rootMargin: "-20% 0px -30% 0px" });
steps.forEach(s => stepIO.observe(s));
applyScene("open");

/* viewer mock controls */
const vSceneImgs = Object.values(SCENES).map((_, i) => steps[i]?.dataset.img).filter(Boolean);
let vI = 0;
function vStep(d) {
  vI = (vI + d + vSceneImgs.length) % vSceneImgs.length;
  vImg.style.opacity = 0;
  setTimeout(() => { vImg.src = vSceneImgs[vI]; vImg.style.opacity = 1; }, REDUCED ? 0 : 160);
  vIdx.textContent = String(4 + vI).padStart(2, "0") + " / 20";
  vstage.classList.add("is-nav");
  setTimeout(() => vstage.classList.remove("is-nav"), 700);
}
$("#vPrev").onclick = () => vStep(-1);
$("#vNext").onclick = () => vStep(1);
$$(".vtool").forEach(t => t.addEventListener("click", () => {
  const k = t.dataset.tool;
  t.classList.add("is-hot"); setTimeout(() => t.classList.remove("is-hot"), 500);
  if (k === "zoomin")  { const z = Math.min(300, (parseFloat(vZoom.textContent) || 100) + 25); vZoom.textContent = z + "%"; vZoom.classList.add("is-on"); vImg.style.transform = `scale(${z / 100})`; }
  if (k === "zoomout") { const z = Math.max(50, (parseFloat(vZoom.textContent) || 100) - 25);  vZoom.textContent = z + "%"; vZoom.classList.add("is-on"); vImg.style.transform = `scale(${z / 100})`; }
  if (k === "fit")     { vZoom.classList.remove("is-on"); vImg.style.transform = ""; vMode.textContent = "FIT"; }
  if (k === "full")    { vstage.classList.toggle("is-full"); vMode.textContent = vstage.classList.contains("is-full") ? "FULLSCREEN" : "FIT"; }
}));

/* ─── keyboard shortcut demo ─────────────────────────────────── */
const keylist = $("#keylist");
const keyRows = $$("#keylist li");
const keyCap = $("#keyCap"), keyAct = $("#keyAct");
let keysInView = false;

new IntersectionObserver(en => { keysInView = en[0].isIntersecting; }, { threshold: 0.25 })
  .observe($("#keys"));

const KEYMAP = {
  ArrowLeft:  "Previous media",
  ArrowRight: "Next media",
  Escape:     "Close viewer",
  KeyF:       "Toggle fullscreen",
  Equal:      "Zoom in",
  NumpadAdd:  "Zoom in",
  Minus:      "Zoom out",
  NumpadSubtract: "Zoom out",
  Space:      "Play / pause slideshow",
};

addEventListener("keydown", e => {
  if (!keysInView || !lb.hidden || e.metaKey || e.ctrlKey || e.altKey) return;
  const action = KEYMAP[e.code];
  if (!action) return;
  if (e.code === "Space") e.preventDefault();

  const row = keyRows.find(r => r.dataset.key === e.code ||
    (e.code === "NumpadAdd" && r.dataset.key === "Equal") ||
    (e.code === "NumpadSubtract" && r.dataset.key === "Minus"));
  if (row) {
    row.classList.remove("is-hit"); void row.offsetWidth; row.classList.add("is-hit");
    setTimeout(() => row.classList.remove("is-hit"), 900);
  }
  keyCap.textContent = row ? row.querySelector(".keycap").textContent : e.key;
  keyAct.textContent = action;
  keyCap.classList.add("is-flash");
  setTimeout(() => keyCap.classList.remove("is-flash"), 400);
});

/* ─── tuning panel ───────────────────────────────────────────── */
const pwrap = $("#pwallWrap"), launchFab = $("#launchFab");
const DEFAULTS = { cols: 4, gap: 8, rad: 6, autoplay: true, mute: true, loop: false,
                   infinite: true, badges: true, nsfw: false, launch: "float" };

function bindRange(id, valId, suffix, apply) {
  const input = $("#" + id), out = $("#" + valId);
  const run = () => { out.textContent = input.value + suffix; apply(+input.value); };
  input.addEventListener("input", run);
  run();
  return input;
}
const colsInput = bindRange("cols", "colsVal", "",  v => pwrap.style.setProperty("--cols", v));
const gapInput  = bindRange("gap",  "gapVal",  "px", v => pwrap.style.setProperty("--gap", v + "px"));
const radInput  = bindRange("rad",  "radVal",  "px", v => pwrap.style.setProperty("--rad", v + "px"));

$$(".sw").forEach(sw => sw.addEventListener("click", () => {
  const on = !sw.classList.contains("is-on");
  sw.classList.toggle("is-on", on);
  sw.setAttribute("aria-pressed", String(on));
  const k = sw.dataset.sw;

  if (k === "infinite") pwrap.classList.toggle("no-infinite", !on);
  if (k === "badges")   pwrap.classList.toggle("no-badges", !on);
  if (k === "nsfw")     { pwrap.classList.toggle("nsfw", on); toast(on ? "NSFW tiles shown" : "NSFW tiles hidden"); }
  if (k === "autoplay") pwrap.classList.toggle("no-autoplay", !on);
  if (k === "mute")     toast(on ? "Video muted" : "Video unmuted");
  if (k === "loop")     toast(on ? "Looping enabled" : "Looping disabled");
}));

$$("#launcher .radio").forEach(r => r.addEventListener("click", () => {
  $$("#launcher .radio").forEach(x => { x.classList.remove("is-on"); x.setAttribute("aria-pressed", "false"); });
  r.classList.add("is-on"); r.setAttribute("aria-pressed", "true");
  launchFab.dataset.mode = r.dataset.launch;
  toast(`Launcher: ${r.textContent.trim().toLowerCase()}`);
}));

$("#resetTune").onclick = () => {
  colsInput.value = DEFAULTS.cols; gapInput.value = DEFAULTS.gap; radInput.value = DEFAULTS.rad;
  [colsInput, gapInput, radInput].forEach(i => i.dispatchEvent(new Event("input")));
  $$(".sw").forEach(sw => {
    const on = DEFAULTS[sw.dataset.sw];
    sw.classList.toggle("is-on", on);
    sw.setAttribute("aria-pressed", String(on));
  });
  pwrap.classList.toggle("no-infinite", !DEFAULTS.infinite);
  pwrap.classList.toggle("no-badges", !DEFAULTS.badges);
  pwrap.classList.toggle("nsfw", DEFAULTS.nsfw);
  pwrap.classList.toggle("no-autoplay", !DEFAULTS.autoplay);
  $$("#launcher .radio").forEach(x => {
    const on = x.dataset.launch === DEFAULTS.launch;
    x.classList.toggle("is-on", on); x.setAttribute("aria-pressed", String(on));
  });
  launchFab.dataset.mode = DEFAULTS.launch;
  toast("Settings reset to defaults");
};
launchFab.dataset.mode = "float";

/* ─── install tabs + copy ────────────────────────────────────── */
const tabs = $$(".tab");
tabs.forEach(tab => tab.addEventListener("click", () => {
  tabs.forEach(t => { t.classList.remove("is-on"); t.setAttribute("aria-selected", "false"); });
  tab.classList.add("is-on"); tab.setAttribute("aria-selected", "true");
  $$(".tabpanel").forEach(p => p.classList.toggle("is-on", p.dataset.panel === tab.dataset.tab));
}));

$$(".copy").forEach(btn => btn.addEventListener("click", async () => {
  const text = btn.dataset.copy;
  try { await navigator.clipboard.writeText(text); }
  catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta);
          ta.select(); document.execCommand("copy"); ta.remove(); }
  const label = btn.querySelector("i");
  const old = label.textContent;
  label.textContent = "copied ✓";
  btn.classList.add("is-copied");
  toast(`Copied “${text}”`);
  setTimeout(() => { label.textContent = old; btn.classList.remove("is-copied"); }, 1800);
}));

/* ─── FAQ: single-open accordion ─────────────────────────────── */
const qs = $$("#faqList .q");
qs.forEach(q => q.addEventListener("toggle", () => {
  if (!q.open) return;
  qs.forEach(o => { if (o !== q) o.open = false; });
}));

/* ─── mobile nav ─────────────────────────────────────────────── */
const burger = $("#burger");
const mobileNav = $("#mobileNav");
function closeMobile() {
  mobileNav.classList.remove("is-open");
  burger.classList.remove("is-open");
  burger.setAttribute("aria-expanded", "false");
}
burger.addEventListener("click", () => {
  const open = !mobileNav.classList.contains("is-open");
  mobileNav.classList.toggle("is-open", open);
  burger.classList.toggle("is-open", open);
  burger.setAttribute("aria-expanded", String(open));
});
$$("#mobileNav a").forEach(a => a.addEventListener("click", closeMobile));

/* ─── smooth anchor offset for fixed bar ─────────────────────── */
$$('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
  const id = a.getAttribute("href");
  if (id.length < 2) return;
  const target = document.querySelector(id);
  if (!target) return;
  e.preventDefault();
  const y = target.getBoundingClientRect().top + scrollY - 78;
  scrollTo({ top: y, behavior: REDUCED ? "auto" : "smooth" });
  closeMobile();
}));

/* ─── gallery card: auto-cycle the stacked slides ────────────── */
const gstack = $("#galleryShot .gstack");
if (gstack && !REDUCED) {
  let g = 0;
  setInterval(() => {
    g = (g + 1) % 3;
    $$("img", gstack).forEach((img, i) => {
      const order = (i - g + 3) % 3;
      img.style.zIndex = String(3 - order);
      img.style.transform = order === 0
        ? "rotate(0deg) scale(1)"
        : order === 1 ? "translateX(-46%) rotate(-11deg) scale(.92)"
                      : "translateX(46%) rotate(11deg) scale(.92)";
    });
  }, 2600);
}

/* ─── hero wall: idle auto-scroll hint ───────────────────────── */
if (!REDUCED) {
  let nudged = false;
  const idle = setTimeout(() => {
    if (nudged || lb.hidden === false || wallGrid.matches(":hover")) return;
    nudged = true;
    wallGrid.scrollTo({ top: wallGrid.scrollHeight * 0.3, behavior: "smooth" });
    setTimeout(() => wallGrid.scrollTo({ top: 0, behavior: "smooth" }), 2200);
  }, 7000);
  wallGrid.addEventListener("pointerenter", () => { nudged = true; clearTimeout(idle); }, { once: true });
  wallGrid.addEventListener("wheel", () => { nudged = true; clearTimeout(idle); }, { once: true, passive: true });
}

/* ─── boot log ───────────────────────────────────────────────── */
console.log(
  "%cMosaic for Reddit%c  © 2026 John Dowe · proprietary · github.com/mrjohndowe/Mossaic_Extension",
  "background:#FF4A1C;color:#fff;padding:3px 8px;border-radius:3px;font-weight:700",
  "color:#9AA6B2"
);
