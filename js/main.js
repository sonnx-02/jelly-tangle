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
  const App = JT.App = { W: 0, H: 0, state: 'boot', cur: 0, COST: { heart: 80, slot: 100, pick: 120 }, PAGE_COINS: 150 };
  let world, wctx, fx, fctx, last = 0, bgCv = null, homeT = 0, fxDirty = false;

  App.resize = function () {
    const app = document.getElementById('app'), r = app.getBoundingClientRect();
    if (!r.width || !r.height) return;
    App.W = r.width; App.H = r.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    R.dpr = dpr;
    for (const cv of [world, fx]) { cv.width = Math.round(App.W * dpr); cv.height = Math.round(App.H * dpr); }
    wctx.setTransform(dpr, 0, 0, dpr, 0, 0); fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    app.style.setProperty('--u', (App.W / 100) + 'px');
    R.clearCache(); bgCv = null;
    if (App.state === 'game') G.layout();
  };

  // ---------- home scene: candy worms strolling behind the menu ----------
  const strollers = [];
  function initHome() {
    const keys = ['K', 'O', 'Y', 'G', 'B', 'P', 'S', 'R'];
    for (let i = 0; i < 7; i++) {
      strollers.push({ c: keys[i], y: 0.1 + i * 0.13 + U.rand(-0.02, 0.02), dir: i % 2 ? 1 : -1, speed: U.rand(0.02, 0.036), len: U.rand(0.34, 0.6),
        off: Math.random(), amp: U.rand(0.012, 0.026), ph: U.rand(0, 6), blink: U.rand(500, 3000) });
    }
  }
  function drawHome(ctx, t) {
    const W = App.W, H = App.H, w = W * 0.085;
    if (!bgCv) {
      bgCv = document.createElement('canvas'); bgCv.width = Math.round(W * R.dpr); bgCv.height = Math.round(H * R.dpr);
      const c = bgCv.getContext('2d'); c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); R.background(c, W, H);
    }
    ctx.drawImage(bgCv, 0, 0, W, H);
    for (const s of strollers) {
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
    const busy = FX.busy();
    if (busy || fxDirty) { fctx.clearRect(0, 0, App.W, App.H); if (busy) FX.drawTop(fctx); fxDirty = !!busy; }
  };
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = now - last; last = now;
    if (dt <= 0) return;
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
    UI.curtain(() => { App.state = 'home'; UI.showHome(); });
  };
  App.onWin = function (res) {
    const idx = App.cur, L = JT.Levels.get(idx), key = L.pic.key, d = Save.data;
    const stars = U.clamp(res.hearts, 1, 3), newPic = !d.album.includes(key);
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
  // continue after a fail: 'slot' | 'heart' | 'pick'
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
    else if (act === 'heart') G.addHeart();
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
    world = document.getElementById('world'); fx = document.getElementById('fx');
    wctx = world.getContext('2d'); fctx = fx.getContext('2d');
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
    const ready = () => {
      if (App.state !== 'boot') return;
      App.state = 'home';
      UI.showHome(); UI.setBoosters();
      const bootEl = document.getElementById('boot');
      bootEl.classList.add('done');
      setTimeout(() => bootEl.remove(), 700);
      last = performance.now();
      requestAnimationFrame(frame);
      setTimeout(() => JT.Levels.get(Save.data.level), 60);   // warm the level cache while the menu is up
    };
    if (document.fonts && document.fonts.ready) {
      Promise.all([document.fonts.load('800 20px "Baloo 2"'), document.fonts.load('900 20px Nunito')]).then(ready, ready);
      setTimeout(ready, 1800);
    } else ready();
  }

  // Hooks for automated playtests: drive the loop without requestAnimationFrame.
  JT.Debug = {
    advance(ms) { let t = ms; while (t > 0) { const d = Math.min(16, t); App.step(d); t -= d; } return G.debug.state(); },
    play(steps, gap) {
      for (let i = 0; i < steps; i++) {
        if (G.status() !== 'play') break;
        const id = G.debug.suggest();
        if (id < 0) break;
        G.tapWorm(id);
        JT.Debug.advance(gap || 1500);
      }
      return G.debug.state();
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
