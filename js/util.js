/* Shared helpers: math, easing, colour, canvas paths, save data. */
(function () {
  'use strict';
  const JT = window.JT = window.JT || {};
  const U = JT.U = {};

  U.TAU = Math.PI * 2;
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.pick = arr => arr[(Math.random() * arr.length) | 0];

  U.ease = {
    inQuad: t => t * t,
    outQuad: t => 1 - (1 - t) * (1 - t),
    inCubic: t => t * t * t,
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: (t, s) => { s = s === undefined ? 1.70158 : s; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); },
    outElastic: t => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (U.TAU / 3)) + 1),
    outBounce: t => {
      const n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
      if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
      return n * (t -= 2.625 / d) * t + 0.984375;
    }
  };

  // ---------- colour ----------
  const parsed = new Map();
  function parse(hex) {
    let v = parsed.get(hex);
    if (!v) {
      let s = hex.slice(1);
      if (s.length === 3) s = s.replace(/./g, '$&$&');
      const n = parseInt(s, 16);
      v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      parsed.set(hex, v);
    }
    return v;
  }
  const h2 = n => (n < 16 ? '0' : '') + n.toString(16);
  U.mix = function (a, b, t) {
    const A = parse(a), B = parse(b);
    return '#' + h2(Math.round(A[0] + (B[0] - A[0]) * t)) + h2(Math.round(A[1] + (B[1] - A[1]) * t)) + h2(Math.round(A[2] + (B[2] - A[2]) * t));
  };
  const shades = new Map();
  // amt < 0 darkens toward black, amt > 0 lightens toward white
  U.shade = function (hex, amt) {
    const k = hex + amt;
    let v = shades.get(k);
    if (!v) { v = amt < 0 ? U.mix(hex, '#000000', -amt) : U.mix(hex, '#ffffff', amt); shades.set(k, v); }
    return v;
  };
  U.lum = function (hex) { const A = parse(hex); return (A[0] * 0.3 + A[1] * 0.59 + A[2] * 0.11) / 255; };
  // WCAG 2 relative luminance and contrast ratio (1..21)
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  U.relLum = function (hex) { const A = parse(hex); return 0.2126 * lin(A[0]) + 0.7152 * lin(A[1]) + 0.0722 * lin(A[2]); };
  U.contrast = function (a, b) { const x = U.relLum(a), y = U.relLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  U.rgba = function (hex, a) { const A = parse(hex); return 'rgba(' + A[0] + ',' + A[1] + ',' + A[2] + ',' + a + ')'; };

  // rounded rectangle path (begins a new path)
  U.rr = function (ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // ---------- save data ----------
  const KEY = 'jellytangle.v1';
  // Levels that went in after players had saves, as [the save version that has it, its index]: the rainbow as level
  // 2, then level 16 without mixing as level 23. A save from before one moves past it on load (insertLevel).
  const INSERTED = [[2, 1], [3, 22]];
  const VERSION = 3;
  function defaults() {
    return {
      v: VERSION,               // level numbering (INSERTED)
      level: 0,                 // next level to play (0-based)
      coins: 100,
      boosters: { hint: 0, pick: 0, slot: 0 },
      unlocked: {},             // booster name -> true once its unlock popup was shown
      album: [],                // finished picture keys
      stars: {},                // level index -> best stars
      best: {},                 // level index -> fastest winning time, in ms of play (paused time does not count)
      claimed: [],              // album pages whose reward was paid
      seenIntro: [],            // mechanic intros already shown
      tips: {},                 // one-time tips already shown
      // English by default; langPicked: the player chose a language in Settings (only then is lang kept on load)
      settings: { sfx: true, music: true, haptic: true, lang: 'en', langPicked: false, fps: false, symbols: false },
      // cheat panel switches that last (js/cheat.js): game speed, no lost stars, boosters never used up, worm numbers,
      // parts of the screen hidden for recordings (hide: name -> true)
      cheat: { speed: 1, noMiss: false, infinite: false, ids: false, hide: {} }
    };
  }
  // A new level went in at index at. Progress on the levels from there on moves up one. The next level to play
  // moves too, unless it was the one at that index: then the player meets the new level next.
  function insertLevel(d, at) {
    const up = o => { const n = {}; for (const k in o) n[+k >= at ? +k + 1 : k] = o[k]; return n; };
    if (d.level > at) d.level++;
    d.stars = up(d.stars || {}); d.best = up(d.best || {});
  }
  const Save = JT.Save = {
    data: defaults(),
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const d = JSON.parse(raw), base = defaults();
          Save.data = Object.assign(base, d);
          Save.data.boosters = Object.assign(defaults().boosters, d.boosters || {});
          Save.data.settings = Object.assign(defaults().settings, d.settings || {});
          // saves from before English became the default all hold lang: 'vi', picked or not: keep only a picked one
          if (!Save.data.settings.langPicked) Save.data.settings.lang = 'en';
          Save.data.cheat = Object.assign(defaults().cheat, d.cheat || {});
          // a save from before a level went in (no v: before the rainbow): the levels after it are one number higher
          // now, so stars, best times and the next level move up with them
          const v = d.v || 1;
          if (v < VERSION) {
            for (const [since, at] of INSERTED) if (v < since) insertLevel(Save.data, at);
            Save.data.v = VERSION; Save.save();
          }
        }
      } catch (e) { Save.data = defaults(); }
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(Save.data)); } catch (e) { /* storage unavailable */ } },
    // progress goes, settings and cheat switches stay
    reset() { const s = Save.data.settings, c = Save.data.cheat; Save.data = defaults(); Save.data.settings = s; Save.data.cheat = c; Save.save(); },
    totalStars() { let n = 0; for (const k in Save.data.stars) n += Save.data.stars[k]; return n; }
  };
})();
