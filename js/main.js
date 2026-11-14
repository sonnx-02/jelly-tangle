/* App shell: boot, resize, main loop, screen flow, economy. */
(function () {
  'use strict';
  const JT = window.JT, U = JT.U, C = JT.Core, R = JT.Render, A = JT.Audio, FX = JT.FX, G = JT.Game, UI = JT.UI, Save = JT.Save;
  const T = (k, v) => JT.I18n.t(k, v);

  // unlock: 0-based level where the booster appears; grant: free uses on unlock; pack/price: shop offer
  JT.BOOST = {
    hint: { unlock: 2, grant: 3, pack: 3, price: 60 },
    pick: { unlock: 4, grant: 2, pack: 2, price: 120 },
    slot: { unlock: 6, grant: 2, pack: 1, price: 100 }
  };
  // scale: the most device pixels per CSS pixel the canvases may use; the frame meter below can lower it
  const App = JT.App = { W: 0, H: 0, state: 'boot', cur: 0, scale: 2.5, COST: { slot: 100, pick: 120 }, PAGE_COINS: 150 };
  let world, wctx, fx, fctx, fpsEl, last = 0, bgCv = null, homeT = 0, fxDirty = false, fxShown = true;

  App.resize = function () {
    const app = document.getElementById('app'), r = app.getBoundingClientRect();
    if (!r.width || !r.height) return;
    App.W = r.width; App.H = r.height;
    const dpr = Math.min(window.devicePixelRatio || 1, App.scale);
    R.dpr = dpr;
    for (const cv of [world, fx]) { cv.width = Math.round(App.W * dpr); cv.height = Math.round(App.H * dpr); }
    wctx.setTransform(dpr, 0, 0, dpr, 0, 0); fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    app.style.setProperty('--u', (App.W / 100) + 'px');
    R.clearCache(); bgCv = null;
    if (App.state === 'game') G.layout();
  };

  // ---------- home scene: candy worms strolling behind the menu ----------
  const strollers = [];
  // The worms stroll below the logo only, so it keeps a clean backdrop; they fill the gap under it and peek out
  // around the level card. Lanes further down are "nearer": a little bigger and faster. A lane is a fraction
  // between the logo's bottom edge (measured, it differs per screen shape) and the bottom of the screen.
  let laneTop = 0.3;
  function initHome() {
    const keys = ['K', 'O', 'Y', 'G', 'B', 'P', 'S', 'R'];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const near = i / (n - 1);
      strollers.push({ c: keys[i], lane: (i + 0.5) / n + U.rand(-0.02, 0.02), dir: i % 2 ? 1 : -1, speed: U.rand(0.018, 0.03) * (0.85 + near * 0.3), len: U.rand(0.34, 0.6),
        scale: 0.86 + near * 0.22, off: Math.random(), amp: U.rand(0.008, 0.016), ph: U.rand(0, 6), blink: U.rand(500, 3000) });
    }
  }
  function measureLanes() {
    const app = document.getElementById('app').getBoundingClientRect(), lg = document.getElementById('logo').getBoundingClientRect();
    if (lg.height && app.height) laneTop = U.clamp((lg.bottom - app.top) / app.height + 0.035, 0.15, 0.6);
  }
  // the home backdrop follows the album page of the next level, like the level itself
  function homeBg() { const k = C.levelCfg(Save.data.level).pic, pg = C.ALBUM.find(p => p.pics.includes(k)); return pg ? pg.bg : C.ALBUM[0].bg; }
  function drawHome(ctx, t) {
    const W = App.W, H = App.H;
    if (!bgCv) {
      bgCv = document.createElement('canvas'); bgCv.width = Math.round(W * R.dpr); bgCv.height = Math.round(H * R.dpr);
      const c = bgCv.getContext('2d'); c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); R.background(c, W, H, homeBg());
      measureLanes();
    }
    ctx.drawImage(bgCv, 0, 0, W, H);
    for (const s of strollers) {
      const w = W * 0.085 * s.scale;
      s.y = laneTop + s.lane * (0.985 - laneTop);
      const body = W * s.len, span = W + body + w * 4, prog = (t * s.speed * 0.001 + s.off) % 1;
      const hx = s.dir > 0 ? -w * 2 + prog * span : W + w * 2 - prog * span;
      const pts = [], n = 24;
      for (let k = 0; k <= n; k++) {
        const x = hx - s.dir * body * (1 - k / n);
        pts.push({ x: x, y: H * s.y + Math.sin(x * 0.02 + s.ph + t * 0.0022) * H * s.amp });
      }
      const hex = R.COL(s.c);
      R.worm(ctx, pts, { hex: hex, w: w });
      const a = pts[n], b = pts[n - 2];
      R.head(ctx, a.x, a.y, Math.atan2(a.y - b.y, a.x - b.x), w * 0.62, { hex: hex, blink: (t + s.blink) % 3400 < 140 ? 1 : 0 });
    }
  }

  // ---------- loop ----------
  App.step = function (dt) {
    FX.update(dt);
    if (App.state === 'game') { G.update(dt); G.draw(wctx); }
    else if (App.state === 'home') { homeT += dt; drawHome(wctx, homeT); }
    const busy = !!FX.busy();
    if (busy || fxDirty) { fctx.clearRect(0, 0, App.W, App.H); if (busy) FX.drawTop(fctx); fxDirty = busy; }
    // an empty full-screen layer still costs the compositor a blend every frame: take it out while nothing flies
    if (busy !== fxShown) { fxShown = busy; fx.style.visibility = busy ? 'visible' : 'hidden'; }
  };

  // ---------- frame pacing ----------
  // The loop runs on requestAnimationFrame, so it already ticks at whatever rate the browser grants the page
  // (60, 90, 120 Hz) and every motion is scaled by real elapsed time. A page cannot ask for a refresh rate; what it
  // controls is whether a frame is cheap enough to arrive on time. The meter watches frame intervals: when too many
  // are late it lowers the canvas resolution one notch, and keeps the change only if that actually helped.
  const RATES = [30, 45, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240];
  const pace = { buf: new Float32Array(120), n: 0, i: 0, best: Infinity, mode: 'watch', lateBefore: 0, prevScale: 0, evalAt: 0, fps: 0, hz: 0 };
  const cfgFps = () => !!Save.data.settings.fps;
  function paceReset(now, hold) { pace.n = 0; pace.i = 0; pace.evalAt = now + (hold || 0); }
  function setScale(v, now) { App.scale = v; App.resize(); paceReset(now, 1200); }
  function paceFrame(now, raw) {
    if (raw > 200) { paceReset(now, 500); return; }            // back from a hidden tab, or a one-off stall
    pace.buf[pace.i] = raw; pace.i = (pace.i + 1) % pace.buf.length;
    if (pace.n < pace.buf.length) pace.n++;
    if (pace.n < 20 || now < pace.evalAt) return;
    pace.evalAt = now + 500;
    const a = Array.prototype.slice.call(pace.buf, 0, pace.n).sort((x, y) => x - y);
    let sum = 0;
    for (let k = 0; k < a.length; k++) sum += a[k];
    const fast = a[Math.floor(a.length * 0.1)];                // the display's own interval shows in the fastest frames
    if (fast > 2 && fast < pace.best) pace.best = fast;
    pace.fps = Math.round(1000 * a.length / sum);
    const rate = 1000 / pace.best;
    pace.hz = RATES.reduce((b, r) => (Math.abs(r - rate) < Math.abs(b - rate) ? r : b), RATES[0]);
    if (cfgFps()) fpsEl.textContent = pace.fps + ' fps / ' + pace.hz + ' Hz / ' + (Math.round(R.dpr * 10) / 10) + 'x';
    if (pace.n < pace.buf.length || pace.mode === 'locked' || App.state === 'boot') return;
    let late = 0;
    for (let k = 0; k < a.length; k++) if (a[k] > pace.best * 1.5) late++;
    late /= a.length;
    if (pace.mode === 'trial') {
      if (late < pace.lateBefore * 0.65) pace.mode = 'watch';                   // lower resolution helped: keep it
      else { pace.mode = 'locked'; setScale(pace.prevScale, now); }             // it did not: restore the sharp picture
      return;
    }
    if (late > 0.3) {
      const cur = R.dpr, next = cur > 2 ? 2 : cur > 1.5 ? 1.5 : 0;
      if (!next) { pace.mode = 'locked'; return; }
      pace.lateBefore = late; pace.prevScale = App.scale; pace.mode = 'trial';
      setScale(next, now);
    }
  }
  App.showFps = function (on) { fpsEl.classList.toggle('hidden', !on); if (on) fpsEl.textContent = '...'; };
  App.pace = pace;

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = now - last; last = now;
    if (dt <= 0) return;
    paceFrame(now, dt);
    if (dt > 50) dt = 50;
    App.step(dt);
  }

  // ---------- flow ----------
  App.startLevel = function (idx) {
    UI.closeModal();
    UI.curtain(() => {
      App.state = 'game'; App.cur = idx;
      const L = JT.Levels.get(idx), d = Save.data;
      UI.showGame(); UI.setLevel(idx, L); UI.setCoins(d.coins);
      const queue = [];
      for (const k in JT.BOOST) {
        if (!d.unlocked[k] && idx >= JT.BOOST[k].unlock) {
          d.unlocked[k] = true; d.boosters[k] += JT.BOOST[k].grant;
          queue.push(cb => UI.unlock(k, cb));
        }
      }
      const intro = L.meta.intro;
      if (intro && !d.seenIntro.includes(intro)) { d.seenIntro.push(intro); queue.push(cb => UI.intro(intro, cb)); }
      Save.save();
      UI.setBoosters();
      G.start(idx);
      G.paused = true;
      const next = () => {
        if (queue.length) { queue.shift()(next); return; }
        G.paused = false;
        if (L.meta.band === 'hard') UI.banner(T('hard'));
      };
      setTimeout(next, 330);
    });
  };
  App.goHome = function () {
    UI.closeModal();
    UI.curtain(() => { App.state = 'home'; bgCv = null; UI.showHome(); });
  };
  App.onWin = function (res) {
    const idx = App.cur, L = JT.Levels.get(idx), key = L.pic.key, d = Save.data;
    // stars count blocked taps (there are no hearts): none = 3, one or two = 2, three or more = 1
    const stars = res.misses === 0 ? 3 : res.misses <= 2 ? 2 : 1, newPic = !d.album.includes(key);
    if (newPic) d.album.push(key);
    d.stars[idx] = Math.max(d.stars[idx] || 0, stars);
    if (idx === d.level) d.level = idx + 1;
    const reward = 20 + stars * 5;
    d.coins += reward;
    const page = C.ALBUM.find(p => p.pics.includes(key)), n = page.pics.filter(k => d.album.includes(k)).length;
    let pageBonus = false;
    if (n === page.pics.length && !d.claimed.includes(page.key)) {
      d.claimed.push(page.key); d.coins += App.PAGE_COINS;
      for (const k in d.boosters) d.boosters[k]++;
      pageBonus = true;
    }
    Save.save();
    UI.setCoins(d.coins); UI.setBoosters();
    UI.win({ idx: idx, pic: L.pic, stars: stars, coins: reward + res.bonus, page: page, n: n, newPic: newPic, pageBonus: pageBonus });
    FX.confetti(App.W / 2, App.H * 0.3, 40, -Math.PI / 2, Math.PI, 0.7);
  };
  App.onFail = function (reason) { UI.fail(reason); };
  // continue after a fail: 'slot' | 'pick'
  App.continueWith = function (act, free) {
    const d = Save.data;
    if (!free) {
      if (d.coins < App.COST[act]) return;
      d.coins -= App.COST[act];
    } else if (act === 'slot') d.boosters.slot--;
    Save.save(); UI.setCoins(d.coins); UI.setBoosters();
    UI.closeModal();
    G.resume();
    if (act === 'slot') G.addSlot();
    else { if (!free) { d.boosters.pick++; Save.save(); UI.setBoosters(); } G.setPick(true); }
  };
  App.addCoins = function (n) { Save.data.coins += n; Save.save(); UI.setCoins(Save.data.coins); };
  App.spendBooster = function (k) { const b = Save.data.boosters; b[k] = Math.max(0, b[k] - 1); Save.save(); UI.setBoosters(); };
  App.buyBooster = function (k) {
    const d = Save.data, b = JT.BOOST[k];
    if (d.coins < b.price) return;
    d.coins -= b.price; d.boosters[k] += b.pack;
    Save.save(); UI.setCoins(d.coins); UI.setBoosters();
  };

  // ---------- boot ----------
  function boot() {
    Save.load();
    R.symbols = !!Save.data.settings.symbols;
    world = document.getElementById('world'); fx = document.getElementById('fx');
    wctx = world.getContext('2d', { alpha: false });   // the scene always fills the canvas: an opaque surface composites faster
    fctx = fx.getContext('2d');
    fpsEl = document.getElementById('fps');
    UI.init();
    App.resize();
    initHome();
    window.addEventListener('resize', App.resize);
    window.addEventListener('orientationchange', () => setTimeout(App.resize, 200));
    world.addEventListener('pointerdown', e => {
      if (App.state !== 'game') return;
      const r = world.getBoundingClientRect();
      G.pointerDown(e.clientX - r.left, e.clientY - r.top);
      e.preventDefault();
    });
    document.addEventListener('pointerdown', () => A.unlock(), { passive: true });
    document.addEventListener('keydown', () => A.unlock());
    document.addEventListener('contextmenu', e => e.preventDefault());
    App.showFps(cfgFps());
    const t0 = performance.now();
    const ready = () => {
      if (App.state !== 'boot') return;
      // the loop is already running with nothing to draw: give the meter a moment to see the bare refresh rate
      if (pace.n < 24 && performance.now() - t0 < 700) { setTimeout(ready, 50); return; }
      App.state = 'home';
      UI.showHome(); UI.setBoosters();
      const bootEl = document.getElementById('boot');
      bootEl.classList.add('done');
      setTimeout(() => bootEl.remove(), 700);
      setTimeout(() => JT.Levels.get(Save.data.level), 60);   // warm the level cache while the menu is up
    };
    last = performance.now();
    requestAnimationFrame(frame);
    if (document.fonts && document.fonts.ready) {
      const fontsIn = () => { R.fontGen++; ready(); };
      Promise.all([document.fonts.load('800 20px "Baloo 2"'), document.fonts.load('900 20px Nunito')]).then(fontsIn, ready);
      document.fonts.ready.then(() => { R.fontGen++; });
      setTimeout(ready, 1800);
    } else ready();
  }

  // Hooks for automated playtests: drive the loop without requestAnimationFrame.
  JT.Debug = {
    advance(ms) { let t = ms; while (t > 0) { const d = Math.min(16, t); App.step(d); t -= d; } return G.debug.state(); },
    tick(now) { frame(now); },   // one real loop iteration at a chosen timestamp: lets a test feed the frame meter any cadence
    // follow the hint like a player would, waiting when the hint says to wait (a jelly still has to free its slot)
    play(steps, gap) {
      for (let i = 0; i < steps; i++) {
        if (G.status() !== 'play') break;
        const p = G.debug.plan();
        if (p.wait) { JT.Debug.advance(gap || 1500); continue; }
        if (p.id < 0) break;
        G.tapWorm(p.id);
        JT.Debug.advance(gap || 1500);
      }
      return G.debug.state();
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
