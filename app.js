/* ============================================================
   ProjectBySketch — about me
   Draggable desktop icons, tabbed pages, a live theme editor and
   a soft, synthesised background loop (no audio files needed).
   ============================================================ */

(function () {
  "use strict";

  var THEME_KEY = "pbs.theme.v1";
  var ICON_KEY = "pbs.icons.v1";
  var RICKROLL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

  var root = document.documentElement;
  var body = document.body;

  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }
  function $$(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }

  /* ---------- tiny storage helpers ---------- */

  function readStore(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* private mode — just skip persistence */
    }
  }

  /* ---------- colour helpers ---------- */

  function hexToRgb(hex) {
    var h = String(hex || "").replace("#", "").trim();
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return { r: 168, g: 85, b: 247 };
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function darken(hex, amount) {
    var c = hexToRgb(hex);
    return (
      "rgb(" +
      Math.round(c.r * (1 - amount)) +
      "," +
      Math.round(c.g * (1 - amount)) +
      "," +
      Math.round(c.b * (1 - amount)) +
      ")"
    );
  }

  function alpha(hex, a) {
    var c = hexToRgb(hex);
    return "rgba(" + c.r + "," + c.g + "," + c.b + "," + a + ")";
  }

  /* ============================================================
     THEME
     ============================================================ */

  var SWATCHES = [
    { name: "Purple", hex: "#a855f7" },
    { name: "Violet", hex: "#8b5cf6" },
    { name: "Indigo", hex: "#6366f1" },
    { name: "Pink", hex: "#ec4899" },
    { name: "Cyan", hex: "#06b6d4" },
    { name: "Teal", hex: "#14b8a6" },
    { name: "Lime", hex: "#84cc16" },
    { name: "Amber", hex: "#f59e0b" },
    { name: "Red", hex: "#ef4444" }
  ];

  var theme = readStore(THEME_KEY, {});
  var state = {
    accent: typeof theme.accent === "string" ? theme.accent : "#a855f7",
    bg: theme.bg === "velvet" || theme.bg === "light" ? theme.bg : "deep",
    stars: theme.stars !== false,
    bob: theme.bob !== false,
    music: theme.music !== false
  };

  function applyTheme() {
    root.style.setProperty("--accent", state.accent);
    root.style.setProperty("--accent-2", darken(state.accent, 0.34));
    root.style.setProperty("--accent-soft", alpha(state.accent, 0.18));
    root.setAttribute("data-bg", state.bg);

    body.classList.toggle("no-stars", !state.stars);
    body.classList.toggle("bob", state.bob);

    var custom = $("#customColor");
    if (custom) custom.value = /^#[0-9a-f]{6}$/i.test(state.accent) ? state.accent : "#a855f7";

    $$(".swatch").forEach(function (btn) {
      btn.classList.toggle(
        "is-active",
        btn.getAttribute("data-hex").toLowerCase() === state.accent.toLowerCase()
      );
      btn.setAttribute("aria-pressed", btn.classList.contains("is-active") ? "true" : "false");
    });

    $$("[data-bg-choice]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-bg-choice") === state.bg);
    });

    var starsToggle = $("#starsToggle");
    if (starsToggle) starsToggle.checked = state.stars;
    var bobToggle = $("#bobToggle");
    if (bobToggle) bobToggle.checked = state.bob;

    writeStore(THEME_KEY, state);
  }

  function buildSwatches() {
    var wrap = $("#swatches");
    if (!wrap) return;
    var frag = document.createDocumentFragment();
    SWATCHES.forEach(function (sw) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch";
      btn.setAttribute("data-hex", sw.hex);
      btn.setAttribute("title", sw.name);
      btn.setAttribute("aria-label", sw.name);
      btn.setAttribute("aria-pressed", "false");
      btn.style.background = "linear-gradient(145deg, " + sw.hex + ", " + darken(sw.hex, 0.3) + ")";
      btn.addEventListener("click", function () {
        state.accent = sw.hex;
        applyTheme();
      });
      frag.appendChild(btn);
    });
    wrap.appendChild(frag);
  }

  /* ============================================================
     STARS
     ============================================================ */

  function buildStars() {
    var wrap = $("#stars");
    if (!wrap) return;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < 46; i++) {
      var s = document.createElement("span");
      var size = (1.4 + Math.random() * 2.2).toFixed(1);
      s.className = "star";
      s.style.left = (Math.random() * 100).toFixed(2) + "%";
      s.style.top = (Math.random() * 100).toFixed(2) + "%";
      s.style.width = size + "px";
      s.style.height = size + "px";
      s.style.animationDelay = (-Math.random() * 6).toFixed(2) + "s";
      s.style.animationDuration = (3.5 + Math.random() * 4).toFixed(2) + "s";
      frag.appendChild(s);
    }
    wrap.appendChild(frag);
  }

  /* ============================================================
     BACKGROUND MUSIC — a soft, gently-swinging loop built with
     the Web Audio API. Nothing is downloaded, nothing is copied.
     ============================================================ */

  var Music = (function () {
    var LEVEL = 0.55; // overall loudness — deliberately "slightly playing"
    var BPM = 96;
    var EIGHTH = 60 / BPM / 2;
    var LOOKAHEAD = 0.3;
    var TICK = 25;

    var BARS = [
      { bass: 41, notes: [65, 69, 72, 76] }, // Fmaj7
      { bass: 43, notes: [67, 71, 74, 77] }, // G7
      { bass: 40, notes: [64, 67, 71, 74] }, // Em7
      { bass: 45, notes: [69, 72, 76, 79] }  // Am7
    ];
    var ARP = [0, 1, 2, 3, 2, 1, 3, 2];

    var ctx = null;
    var master = null;
    var timer = null;
    var playing = false;
    var step = 0;
    var nextTime = 0;

    function mtof(m) {
      return 440 * Math.pow(2, (m - 69) / 12);
    }

    function ensureCtx() {
      if (ctx) return ctx;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.0001;
      master.connect(ctx.destination);
      return ctx;
    }

    function voice(freq, at, dur, peak, type) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(at);
      osc.stop(at + dur + 0.06);
    }

    function scheduleStep(index, at) {
      var bar = BARS[Math.floor(index / 8) % BARS.length];
      var pos = index % 8;
      var swing = pos % 2 === 1 ? EIGHTH * 0.16 : 0;
      var time = at + swing;

      // melody / arpeggio
      voice(mtof(bar.notes[ARP[pos]]), time, 0.62, 0.075, "sine");

      // sparse bell an octave up on the downbeat
      if (pos === 0) {
        voice(mtof(bar.notes[3] + 12), time + EIGHTH * 0.5, 1.1, 0.03, "sine");
      }

      // upright-ish bass
      if (pos === 0) {
        voice(mtof(bar.bass), time, 1.05, 0.085, "triangle");
      } else if (pos === 4) {
        voice(mtof(bar.bass), time, 0.7, 0.06, "triangle");
      } else if (pos === 6) {
        voice(mtof(bar.bass + 7), time, 0.45, 0.05, "triangle");
      }
    }

    function scheduler() {
      if (!ctx) return;
      while (nextTime < ctx.currentTime + LOOKAHEAD) {
        scheduleStep(step, nextTime);
        nextTime += EIGHTH;
        step = (step + 1) % 32;
      }
    }

    function start() {
      if (playing) return;
      if (!ensureCtx()) return;
      if (ctx.state === "suspended" && ctx.resume) ctx.resume();
      playing = true;
      step = 0;
      nextTime = ctx.currentTime + 0.12;
      var now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(0.0001, now);
      master.gain.linearRampToValueAtTime(LEVEL, now + 1.6);
      timer = window.setInterval(scheduler, TICK);
    }

    function stop() {
      if (!playing) return;
      playing = false;
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
      if (!ctx) return;
      var now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
      master.gain.linearRampToValueAtTime(0.0001, now + 0.45);
    }

    return { start: start, stop: stop, isPlaying: function () { return playing; } };
  })();

  function paintMusicUI() {
    var on = state.music;
    var btn = $("#musicToggle");
    if (btn) {
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.classList.toggle("is-muted", !on);
    }
    var label = $("#musicLabel");
    if (label) label.textContent = on ? "Music on" : "No music";
    var ico = $("#musicIcon");
    if (ico) ico.textContent = on ? "♫" : "🔇";
  }

  function setMusic(on) {
    state.music = !!on;
    writeStore(THEME_KEY, state);
    if (state.music) Music.start();
    else Music.stop();
    paintMusicUI();
  }

  function toggleMusic() {
    setMusic(!state.music);
  }

  function isMusicToggle(el) {
    if (!el || !el.closest) return false;
    return !!el.closest("#musicToggle, [data-action='music']");
  }

  function unlockAudio(e) {
    if (e && isMusicToggle(e.target)) return;
    document.removeEventListener("pointerdown", unlockAudio);
    document.removeEventListener("keydown", unlockAudio);
    document.removeEventListener("touchstart", unlockAudio);
    if (state.music) Music.start();
  }

  /* ============================================================
     TABS
     ============================================================ */

  var tabButtons = $$(".tab");
  var panels = $$(".panel");

  function activateTab(name) {
    tabButtons.forEach(function (btn) {
      var on = btn.getAttribute("data-tab") === name;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    panels.forEach(function (panel) {
      panel.classList.toggle("is-active", panel.getAttribute("data-panel") === name);
    });
    return name;
  }

  function openRickroll() {
    var win = window.open(RICKROLL, "_blank", "noopener,noreferrer");
    if (win) win.opener = null;
  }

  function goToTab(name, opts) {
    activateTab(name);
    // "When I'm not coding" is a rickroll — fired from the click itself
    // so the browser treats it as a real user gesture.
    if (name === "notcoding" && !(opts && opts.silent)) openRickroll();
    if (opts && opts.scroll) {
      var target = $("#tabs");
      if (target && target.scrollIntoView) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      goToTab(btn.getAttribute("data-tab"), { silent: false });
    });
  });

  /* ============================================================
     DESKTOP ICONS — drag, drop, remember, tap to open
     ============================================================ */

  var desk = $("#desk");
  var icons = $$(".icon", desk);
  var savedPositions = readStore(ICON_KEY, {});

  function deskBounds(icon) {
    return {
      maxX: Math.max(0, desk.clientWidth - icon.offsetWidth),
      maxY: Math.max(0, desk.clientHeight - icon.offsetHeight)
    };
  }

  function place(icon, x, y) {
    var b = deskBounds(icon);
    var cx = Math.min(Math.max(x, 0), b.maxX);
    var cy = Math.min(Math.max(y, 0), b.maxY);
    icon.style.left = cx + "px";
    icon.style.top = cy + "px";
  }

  function layoutIcons() {
    if (!desk || !icons.length) return;

    var w = desk.clientWidth;
    var iconW = icons[0].offsetWidth || 86;
    var iconH = icons[0].offsetHeight || 96;
    var pad = 10;
    var gapX = 4;
    var gapY = 10;

    var cols = Math.max(1, Math.floor((w - pad * 2 + gapX) / (iconW + gapX)));
    cols = Math.min(cols, icons.length);
    var rows = Math.ceil(icons.length / cols);

    var needed = pad * 2 + rows * iconH + (rows - 1) * gapY;
    if (needed > desk.clientHeight) {
      desk.style.minHeight = needed + "px";
    }

    var gridW = cols * iconW + (cols - 1) * gapX;
    var offsetX = Math.max(pad, (w - gridW) / 2);

    icons.forEach(function (icon, i) {
      var saved = savedPositions[icon.getAttribute("data-key")];
      if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
        place(icon, saved.x, saved.y);
        return;
      }
      var col = i % cols;
      var row = Math.floor(i / cols);
      place(icon, offsetX + col * (iconW + gapX), pad + row * (iconH + gapY));
    });

    desk.classList.add("is-ready");
  }

  function savePositions() {
    var next = {};
    icons.forEach(function (icon) {
      next[icon.getAttribute("data-key")] = {
        x: parseFloat(icon.style.left) || 0,
        y: parseFloat(icon.style.top) || 0
      };
    });
    savedPositions = next;
    writeStore(ICON_KEY, next);
  }

  function clearPositions() {
    savedPositions = {};
    try {
      window.localStorage.removeItem(ICON_KEY);
    } catch (err) {
      /* ignore */
    }
    desk.style.minHeight = "";
    layoutIcons();
  }

  var suppressClickUntil = 0;

  function attachDrag(icon) {
    icon.addEventListener("pointerdown", function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      var startX = e.clientX;
      var startY = e.clientY;
      var rect = icon.getBoundingClientRect();
      var deskRect = desk.getBoundingClientRect();
      var grabX = e.clientX - rect.left;
      var grabY = e.clientY - rect.top;
      var moved = false;
      var pid = e.pointerId;

      try {
        icon.setPointerCapture(pid);
      } catch (err) {
        /* some browsers refuse; dragging still works via the listeners */
      }

      function onMove(ev) {
        if (ev.pointerId !== pid) return;
        var dx = ev.clientX - startX;
        var dy = ev.clientY - startY;
        if (!moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

        if (!moved) {
          moved = true;
          icon.classList.add("is-dragging");
          desk.classList.add("grabbing");
        }

        var x = ev.clientX - deskRect.left - grabX;
        var y = ev.clientY - deskRect.top - grabY;
        place(icon, x, y);
        ev.preventDefault();
      }

      function onUp(ev) {
        if (ev.pointerId !== pid) return;
        icon.removeEventListener("pointermove", onMove);
        icon.removeEventListener("pointerup", onUp);
        icon.removeEventListener("pointercancel", onUp);
        icon.classList.remove("is-dragging");
        desk.classList.remove("grabbing");

        if (moved) {
          savePositions();
          // swallow the click that follows this drag
          suppressClickUntil = Date.now() + 400;
        }
      }

      icon.addEventListener("pointermove", onMove);
      icon.addEventListener("pointerup", onUp);
      icon.addEventListener("pointercancel", onUp);
    });

    icon.addEventListener("click", function (e) {
      if (Date.now() < suppressClickUntil) {
        e.preventDefault();
        e.stopPropagation();
        suppressClickUntil = 0;
        return;
      }

      var action = icon.getAttribute("data-action");

      if (action === "tab") {
        goToTab(icon.getAttribute("data-tab"), { silent: false, scroll: true });
      } else if (action === "link") {
        var href = icon.getAttribute("data-href");
        if (href) {
          var win = window.open(href, "_blank", "noopener,noreferrer");
          if (win) win.opener = null;
        }
      } else if (action === "theme") {
        openSheet();
      } else if (action === "music") {
        toggleMusic();
      }
    });
  }

  /* ============================================================
     THEME SHEET
     ============================================================ */

  var sheet = $("#themeSheet");

  function openSheet() {
    if (!sheet) return;
    sheet.classList.add("is-open");
    sheet.setAttribute("aria-hidden", "false");
    var btn = $("#themeToggle");
    if (btn) btn.setAttribute("aria-expanded", "true");
  }

  function closeSheet() {
    if (!sheet) return;
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
    var btn = $("#themeToggle");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function wireThemeControls() {
    var themeBtn = $("#themeToggle");
    if (themeBtn) {
      themeBtn.addEventListener("click", function () {
        if (sheet && sheet.classList.contains("is-open")) closeSheet();
        else openSheet();
      });
    }

    $$("[data-close]", sheet).forEach(function (el) {
      el.addEventListener("click", closeSheet);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeSheet();
    });

    var custom = $("#customColor");
    if (custom) {
      custom.addEventListener("input", function () {
        state.accent = custom.value;
        applyTheme();
      });
    }

    $$("[data-bg-choice]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.bg = btn.getAttribute("data-bg-choice");
        applyTheme();
      });
    });

    var starsToggle = $("#starsToggle");
    if (starsToggle) {
      starsToggle.addEventListener("change", function () {
        state.stars = starsToggle.checked;
        applyTheme();
      });
    }

    var bobToggle = $("#bobToggle");
    if (bobToggle) {
      bobToggle.addEventListener("change", function () {
        state.bob = bobToggle.checked;
        applyTheme();
      });
    }

    var resetTheme = $("#resetTheme");
    if (resetTheme) {
      resetTheme.addEventListener("click", function () {
        state.accent = "#a855f7";
        state.bg = "deep";
        state.stars = true;
        state.bob = true;
        applyTheme();
      });
    }

    var resetIcons = $("#resetIcons");
    if (resetIcons) {
      resetIcons.addEventListener("click", clearPositions);
    }

    var musicToggle = $("#musicToggle");
    if (musicToggle) {
      musicToggle.addEventListener("click", toggleMusic);
    }
  }

  /* ============================================================
     BOOT
     ============================================================ */

  function boot() {
    buildSwatches();
    buildStars();
    applyTheme();
    paintMusicUI();
    wireThemeControls();

    icons.forEach(attachDrag);
    layoutIcons();

    document.addEventListener("pointerdown", unlockAudio);
    document.addEventListener("keydown", unlockAudio);
    document.addEventListener("touchstart", unlockAudio, { passive: true });

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(layoutIcons, 120);
    });

    window.addEventListener("load", layoutIcons);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
