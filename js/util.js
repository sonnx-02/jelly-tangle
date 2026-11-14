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
  function defaults() {
    return {
      level: 0,                 // next level to play (0-based)
      coins: 100,
      boosters: { hint: 0, pick: 0, slot: 0 },
      unlocked: {},             // booster name -> true once its unlock popup was shown
      album: [],                // finished picture keys
      stars: {},                // level index -> best stars
      claimed: [],              // album pages whose reward was paid
      seenIntro: [],            // mechanic intros already shown
      tips: {},                 // one-time tips already shown
      settings: { sfx: true, music: true, haptic: true, lang: 'vi', fps: false }
    };
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
        }
      } catch (e) { Save.data = defaults(); }
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(Save.data)); } catch (e) { /* storage unavailable */ } },
    reset() { const s = Save.data.settings; Save.data = defaults(); Save.data.settings = s; Save.save(); },
    totalStars() { let n = 0; for (const k in Save.data.stars) n += Save.data.stars[k]; return n; }
  };
})();
