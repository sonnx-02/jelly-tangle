/* Particles, floating texts and coin flights. Two particle layers: "world" (drawn inside the game canvas,
   shakes with it) and "top" (drawn on the overlay canvas, above popups). Times are in ms, speeds in px/ms. */
(function () {
  'use strict';
  const JT = window.JT, U = JT.U, E = U.ease;

  function Layer() { this.p = []; }
  Layer.prototype.add = function (o) { o.age = 0; o.rot = o.rot || 0; this.p.push(o); return o; };
  Layer.prototype.update = function (dt) {
    const a = this.p; let n = 0;
    for (let i = 0; i < a.length; i++) {
      const q = a[i];
      if (q.delay > 0) { q.delay -= dt; a[n++] = q; continue; }
      q.age += dt;
      if (q.age >= q.life) continue;
      if (q.g) q.vy += q.g * dt;
      if (q.drag) { const k = Math.pow(q.drag, dt / 16); q.vx *= k; q.vy *= k; }
      q.x += (q.vx || 0) * dt; q.y += (q.vy || 0) * dt;
      if (q.vr) q.rot += q.vr * dt;
      a[n++] = q;
    }
    a.length = n;
  };
  Layer.prototype.draw = function (ctx) {
    const a = this.p;
    for (let i = 0; i < a.length; i++) {
      const q = a[i];
      if (q.delay > 0) continue;
      const t = q.age / q.life;
      const al = (q.alpha === undefined ? 1 : q.alpha) * (t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4);
      ctx.globalAlpha = al;
      if (q.shape === 'ring') {
        const r = U.lerp(q.r0, q.r1, E.outCubic(t));
        ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, U.TAU);
        ctx.strokeStyle = q.color; ctx.lineWidth = Math.max(0.5, q.size * (1 - t)); ctx.stroke();
      } else if (q.shape === 'rect') {
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
        ctx.scale(1, Math.cos(q.age * q.flip));
        ctx.fillStyle = q.color; ctx.fillRect(-q.size / 2, -q.size * 0.3, q.size, q.size * 0.6);
        ctx.restore();
      } else if (q.shape === 'star') {
        const s = q.size * (q.shrink ? 1 - t : 1);
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
        ctx.fillStyle = q.color; ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const ang = k * Math.PI / 2;
          ctx.lineTo(Math.cos(ang) * s, Math.sin(ang) * s);
          ctx.lineTo(Math.cos(ang + Math.PI / 4) * s * 0.3, Math.sin(ang + Math.PI / 4) * s * 0.3);
        }
        ctx.closePath(); ctx.fill(); ctx.restore();
      } else {
        const s = q.size * (q.shrink ? 1 - t * 0.8 : 1);
        ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(0.3, s), 0, U.TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };

  const FX = JT.FX = { world: new Layer(), top: new Layer(), texts: [], coins: [] };

  // a puff of round droplets
  FX.burst = function (layer, x, y, color, n, speed, size, opts) {
    opts = opts || {};
    for (let i = 0; i < n; i++) {
      const a = U.rand(0, U.TAU), v = speed * U.rand(0.35, 1);
      layer.add({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (opts.up || 0), g: opts.g === undefined ? 0.0011 : opts.g, drag: 0.94,
        life: U.rand(320, 620), size: size * U.rand(0.5, 1), color: color, shrink: true });
    }
  };
  FX.ring = function (layer, x, y, color, r0, r1, life, width) {
    layer.add({ shape: 'ring', x: x, y: y, color: color, r0: r0, r1: r1, life: life || 380, size: width || 4 });
  };
  FX.sparkles = function (layer, x, y, n, spread, color) {
    for (let i = 0; i < n; i++) {
      layer.add({ shape: 'star', x: x + U.rand(-spread, spread), y: y + U.rand(-spread, spread), vx: U.rand(-0.03, 0.03), vy: U.rand(-0.07, -0.01),
        life: U.rand(400, 800), size: U.rand(3, 7), color: color || '#ffffff', shrink: true, vr: U.rand(-0.004, 0.004), delay: U.rand(0, 160) });
    }
  };
  FX.confetti = function (x, y, n, angle, spread, power) {
    const CONFETTI = ['R', 'O', 'Y', 'G', 'B', 'P', 'K', 'S'].map(k => JT.Core.PALETTE[k].hex);   // the game's own candy colours
    for (let i = 0; i < n; i++) {
      const a = angle + U.rand(-spread, spread), v = power * U.rand(0.45, 1);
      FX.top.add({ shape: 'rect', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.0012, drag: 0.972,
        life: U.rand(1500, 2600), size: U.rand(7, 13), color: U.pick(CONFETTI), rot: U.rand(0, 6), vr: U.rand(-0.012, 0.012), flip: U.rand(0.006, 0.016), delay: U.rand(0, 120) });
    }
  };

  // floating text on the top layer
  FX.text = function (str, x, y, o) {
    o = o || {};
    FX.texts.push({ str: str, x: x, y: y, age: 0, life: o.life || 900, size: o.size || 20, fill: o.fill || '#ffffff', stroke: o.stroke || '#4a2617',
      rise: o.rise === undefined ? 30 : o.rise, pop: o.pop !== false, rot: o.rot || 0, delay: o.delay || 0 });
  };

  // coins that fly to the coin counter, then call cb once each
  FX.coinFly = function (x, y, n, cb) {
    const tgt = JT.UI.coinTarget();
    for (let i = 0; i < n; i++) {
      FX.coins.push({ x0: x, y0: y, x1: tgt.x, y1: tgt.y, cx: x + U.rand(-60, 60), cy: y - U.rand(30, 110), age: -i * 70, dur: U.rand(520, 680), r: tgt.r, cb: cb });
    }
  };

  FX.update = function (dt) {
    FX.world.update(dt); FX.top.update(dt);
    let n = 0;
    for (const t of FX.texts) {
      if (t.delay > 0) { t.delay -= dt; FX.texts[n++] = t; continue; }
      t.age += dt; if (t.age < t.life) FX.texts[n++] = t;
    }
    FX.texts.length = n;
    n = 0;
    for (const c of FX.coins) {
      c.age += dt;
      if (c.age >= c.dur) { if (c.cb) c.cb(); JT.UI.coinBump(); JT.Audio.coin(); continue; }
      FX.coins[n++] = c;
    }
    FX.coins.length = n;
  };

  FX.busy = function () { return FX.top.p.length || FX.texts.length || FX.coins.length; };

  FX.drawTop = function (ctx) {
    FX.top.draw(ctx);
    for (const c of FX.coins) {
      if (c.age < 0) continue;
      const p = c.age / c.dur, e = E.inOutCubic(p), a = 1 - e;
      const x = a * a * c.x0 + 2 * a * e * c.cx + e * e * c.x1, y = a * a * c.y0 + 2 * a * e * c.cy + e * e * c.y1;
      JT.Render.coin(ctx, x, y, c.r * (0.8 + 0.5 * Math.sin(p * Math.PI)), c.age * 0.012);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const t of FX.texts) {
      if (t.delay > 0) continue;
      const p = t.age / t.life;
      const sc = t.pop ? (t.age < 220 ? E.outBack(t.age / 220, 2.4) : 1) : 1;
      ctx.save();
      ctx.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      ctx.translate(t.x, t.y - t.rise * E.outCubic(p)); ctx.rotate(t.rot); ctx.scale(sc, sc);
      ctx.font = '800 ' + t.size + 'px "Baloo 2", system-ui, sans-serif';
      ctx.lineWidth = Math.max(3, t.size * 0.24); ctx.strokeStyle = t.stroke; ctx.strokeText(t.str, 0, 0);
      ctx.fillStyle = t.fill; ctx.fillText(t.str, 0, 0);
      ctx.restore();
    }
  };
})();
