/* Drawing primitives. Everything is procedural Canvas 2D: glossy gummy worms, jelly blobs, jelly tiles,
   cream panels and the chocolate tray. One light direction (top-left) is used everywhere. */
(function () {
  'use strict';
  const JT = window.JT, U = JT.U, C = JT.Core;
  const R = JT.Render = { dpr: 1, fontGen: 0 };   // fontGen bumps when web fonts arrive, so cached text is redrawn
  const INK = R.INK = '#4a2617';
  const TAU = U.TAU;
  R.COL = k => C.PALETTE[k].hex;
  R.WRAP = '#cfc9dd';
  // One outline family for every candy: the colour's own dark shade pulled halfway to the ink brown. Each object
  // used to get its own shaded rim plus glossy streaks, which read as generated; a shared outline reads as drawn.
  const rims = new Map();
  const rimOf = R.rimOf = hex => { let v = rims.get(hex); if (!v) { v = U.mix(U.shade(hex, -0.42), INK, 0.5); rims.set(hex, v); } return v; };

  // ---------- scene ----------
  R.background = function (ctx, W, H) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#ffe7c6'); g.addColorStop(0.5, '#ffcbd0'); g.addColorStop(1, '#ffa6c7');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const glow = (x, y, r, c) => {
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    glow(W * 0.08, H * 0.06, W * 0.8, 'rgba(255,255,255,0.55)');
    glow(W * 1.0, H * 0.5, W * 0.7, 'rgba(255,236,190,0.4)');
    glow(W * 0.15, H * 1.0, W * 0.8, 'rgba(255,110,170,0.28)');
    // polka dots
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    const s = W / 8;
    for (let y = -1; y * s * 0.86 < H + s; y++) {
      for (let x = -1; x * s < W + s; x++) {
        ctx.beginPath(); ctx.arc(x * s + (y % 2 ? s / 2 : 0), y * s * 0.86, s * 0.1, 0, TAU); ctx.fill();
      }
    }
  };

  // cream card with a 3D lip and soft shadow
  R.panel = function (ctx, x, y, w, h, r, o) {
    o = o || {};
    const lip = o.lip === undefined ? Math.max(3, h * 0.03) : o.lip;
    ctx.save();
    ctx.shadowColor = 'rgba(150,60,50,0.32)'; ctx.shadowBlur = o.blur || 18; ctx.shadowOffsetY = lip + 4;
    U.rr(ctx, x, y, w, h, r); ctx.fillStyle = o.lipColor || '#e6c8a0'; ctx.fill();
    ctx.restore();
    U.rr(ctx, x, y + lip, w, h, r); ctx.fillStyle = o.lipColor || '#e6c8a0'; ctx.fill();
    U.rr(ctx, x, y, w, h, r); ctx.fillStyle = o.fill || '#fff7e8'; ctx.fill();
    ctx.save(); U.rr(ctx, x, y, w, h, r); ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(0.18, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(240,200,150,0.18)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.restore();
  };

  // the chocolate box the worms sit in
  R.tray = function (ctx, x, y, w, h, pad, cell, cols, rows) {
    const r = Math.min(cell * 0.55, 26);
    R.panel(ctx, x, y, w, h, r, { lip: Math.max(4, cell * 0.12) });
    const ix = x + pad, iy = y + pad, iw = w - pad * 2, ih = h - pad * 2, ir = Math.max(6, r - pad);
    U.rr(ctx, ix - 3, iy - 3, iw + 6, ih + 6, ir + 3); ctx.fillStyle = '#2c160d'; ctx.fill();
    U.rr(ctx, ix, iy, iw, ih, ir); ctx.fillStyle = '#3b2015'; ctx.fill();
    // chocolate-bar squares
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const px = ix + cx * cell, py = iy + cy * cell, m = Math.max(1, cell * 0.045);
        U.rr(ctx, px + m, py + m, cell - 2 * m, cell - 2 * m, cell * 0.2); ctx.fillStyle = '#4b2a1b'; ctx.fill();
        U.rr(ctx, px + m, py + m, cell - 2 * m, (cell - 2 * m) * 0.5, cell * 0.2); ctx.fillStyle = 'rgba(255,220,180,0.05)'; ctx.fill();
      }
    }
    // inner shadow at the top edge
    ctx.save(); U.rr(ctx, ix, iy, iw, ih, ir); ctx.clip();
    const g = ctx.createLinearGradient(0, iy, 0, iy + cell * 0.5);
    g.addColorStop(0, 'rgba(0,0,0,0.38)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(ix, iy, iw, cell * 0.5);
    ctx.restore();
  };

  // ---------- jelly tile (one painted picture cell), cached per colour and size ----------
  const tiles = new Map();
  R.tile = function (key, size) {
    const px = Math.max(6, Math.round(size * R.dpr));
    const id = key + px;
    let cv = tiles.get(id);
    if (cv) return cv;
    cv = document.createElement('canvas'); cv.width = cv.height = px;
    const c = cv.getContext('2d'), hex = R.COL(key);
    const m = px * 0.035, s = px - m * 2, r = s * 0.27;
    // a jelly cube: flat colour on a darker base, one soft light edge on top, no gloss pill
    U.rr(c, m, m, s, s, r); c.fillStyle = U.shade(hex, -0.28); c.fill();
    U.rr(c, m, m, s, s * 0.88, r); c.fillStyle = hex; c.fill();
    const g = c.createLinearGradient(0, m, 0, m + s * 0.88);
    g.addColorStop(0, 'rgba(255,255,255,0.24)'); g.addColorStop(0.35, 'rgba(255,255,255,0)');
    U.rr(c, m, m, s, s * 0.88, r); c.fillStyle = g; c.fill();
    tiles.set(id, cv);
    return cv;
  };
  R.clearCache = function () { tiles.clear(); };

  // a whole picture, used by previews (home card, album, win popup). painted: fn(i) -> bool, or true
  R.picture = function (ctx, pic, x, y, cellPx, painted) {
    for (let i = 0; i < pic.total; i++) {
      const cx = x + (i % pic.w) * cellPx, cy = y + ((i / pic.w) | 0) * cellPx;
      if (painted === true || (painted && painted(i))) ctx.drawImage(R.tile(pic.cells[i], cellPx), cx, cy, cellPx, cellPx);
      else R.socket(ctx, cx, cy, cellPx, R.COL(pic.cells[i]), false);
    }
  };
  // an empty picture cell: a socket with a seed dot of its target colour (hex null: a closed ring, no dot)
  R.socket = function (ctx, x, y, s, hex, active) {
    const m = s * 0.06;
    U.rr(ctx, x + m, y + m, s - 2 * m, s - 2 * m, s * 0.24);
    ctx.fillStyle = active ? '#fffdf6' : '#dcc5a2'; ctx.fill();
    if (!hex) return;
    const r = s * (active ? 0.27 : 0.2);
    ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, r, 0, TAU);
    ctx.fillStyle = active ? hex : U.mix(hex, '#dcc5a2', 0.18); ctx.fill();
    if (active) { ctx.lineWidth = Math.max(1, s * 0.05); ctx.strokeStyle = U.shade(hex, -0.22); ctx.stroke(); }
  };

  // ---------- gummy worm ----------
  // pts: screen points tail..head. o: { hex, w, glow, wrap, flash }
  R.worm = function (ctx, pts, o) {
    const n = pts.length;
    if (n < 2) return;
    const w = o.w, hex = o.hex, ga = ctx.globalAlpha;
    const trace = (ox, oy) => {
      ctx.beginPath(); ctx.moveTo(pts[0].x + ox, pts[0].y + oy);
      for (let i = 1; i < n; i++) ctx.lineTo(pts[i].x + ox, pts[i].y + oy);
    };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (o.glow) {
      trace(0, 0); ctx.strokeStyle = 'rgba(255,255,255,' + o.glow + ')'; ctx.lineWidth = w * 1.55; ctx.stroke();
      trace(0, 0); ctx.strokeStyle = 'rgba(255,214,60,' + o.glow + ')'; ctx.lineWidth = w * 1.3; ctx.stroke();
    }
    const rim = Math.max(1.5, w * 0.1);
    trace(0, w * 0.18); ctx.strokeStyle = 'rgba(15,4,0,0.28)'; ctx.lineWidth = w; ctx.stroke();          // drop shadow
    if (U.lum(hex) < 0.47) { trace(0, 0); ctx.strokeStyle = 'rgba(255,232,210,0.4)'; ctx.lineWidth = w + Math.max(2, w * 0.14); ctx.stroke(); }  // dark candy needs an edge on chocolate
    trace(0, 0); ctx.strokeStyle = rimOf(hex); ctx.lineWidth = w; ctx.stroke();                             // outline
    trace(0, -rim * 0.45); ctx.strokeStyle = hex; ctx.lineWidth = w - rim * 2; ctx.stroke();                // body
    if (o.wrap) {                                                                                           // foil stripes
      ctx.lineCap = 'butt'; ctx.setLineDash([w * 0.28, w * 0.34]);
      trace(0, -rim * 0.45); ctx.strokeStyle = '#eeeaf7'; ctx.lineWidth = w - rim * 2; ctx.stroke();
      ctx.setLineDash([]); ctx.lineCap = 'round';
    }
    ctx.globalAlpha = ga * 0.35;
    trace(-w * 0.04, -w * 0.16); ctx.strokeStyle = U.shade(hex, 0.4); ctx.lineWidth = w * 0.28; ctx.stroke(); // one soft light band
    ctx.globalAlpha = ga;
    if (o.flash > 0) { trace(0, 0); ctx.strokeStyle = 'rgba(255,70,90,' + o.flash + ')'; ctx.lineWidth = w * 1.02; ctx.stroke(); }
  };

  // worm head with eyes. ang: facing. o: { hex, blink(0..1 closed), sleepy, wrap, dizzy, flash }
  R.head = function (ctx, x, y, ang, r, o) {
    const hex = o.hex, rim = Math.max(1.5, r * 0.16);
    ctx.fillStyle = 'rgba(15,4,0,0.3)'; ctx.beginPath(); ctx.arc(x, y + r * 0.3, r, 0, TAU); ctx.fill();
    ctx.fillStyle = rimOf(hex); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = hex; ctx.beginPath(); ctx.arc(x, y - rim * 0.4, r - rim, 0, TAU); ctx.fill();
    ctx.fillStyle = U.rgba(U.shade(hex, 0.4), 0.4); ctx.beginPath(); ctx.ellipse(x - r * 0.24, y - r * 0.44, r * 0.32, r * 0.15, -0.5, 0, TAU); ctx.fill();
    if (o.flash > 0) { ctx.fillStyle = 'rgba(255,70,90,' + o.flash + ')'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    if (o.wrap) return;
    const fx = Math.cos(ang), fy = Math.sin(ang), lx = -fy, ly = fx;
    const er = r * 0.34, closed = o.blink || 0;
    for (let s = -1; s <= 1; s += 2) {
      const ex = x + lx * r * 0.4 * s + fx * r * 0.14, ey = y + ly * r * 0.4 * s + fy * r * 0.14 - rim * 0.3;
      if (closed > 0.6 || o.sleepy) {
        ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.2, r * 0.14); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(ex - fx * er * 0.45, ey - fy * er * 0.45, er * 0.72, ang - 1.05, ang + 1.05); ctx.stroke();
      } else {
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + fx * er * 0.34, ey + fy * er * 0.34, er * 0.56, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex + fx * er * 0.2 - er * 0.18, ey + fy * er * 0.2 - er * 0.22, er * 0.2, 0, TAU); ctx.fill();
      }
    }
  };

  // spinning arrow ring around a dizzy worm's head
  R.spinRing = function (ctx, x, y, r, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(t);
    ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      const a0 = k * Math.PI + 0.35, a1 = a0 + Math.PI * 0.72;
      ctx.beginPath(); ctx.arc(0, 0, r, a0, a1);
      ctx.strokeStyle = INK; ctx.lineWidth = Math.max(3, r * 0.3); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.5, r * 0.15); ctx.stroke();
      const hx = Math.cos(a1) * r, hy = Math.sin(a1) * r, s = r * 0.3;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(a1 + Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(-s, -s * 0.2); ctx.lineTo(s, -s * 0.2); ctx.lineTo(0, s * 1.2); ctx.closePath();
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, r * 0.08); ctx.lineJoin = 'round'; ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  };

  // number drawn on a worm or badge
  R.label = function (ctx, str, x, y, size, fill, stroke) {
    ctx.font = '800 ' + size + 'px "Baloo 2", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2.5, size * 0.3); ctx.strokeStyle = stroke || INK; ctx.strokeText(str, x, y + size * 0.07);
    ctx.fillStyle = fill || '#ffffff'; ctx.fillText(str, x, y + size * 0.07);
  };

  // ---------- jelly blob (a worm rolled up on the tray) ----------
  // o: { hex, sx, sy, emo: 'happy'|'sleep'|'shoot'|'sad'|'none', noShadow }
  R.blob = function (ctx, x, y, r, o) {
    const hex = o.hex, rim = Math.max(1.5, r * 0.09);
    ctx.save(); ctx.translate(x, y);
    if (!o.noShadow) { ctx.fillStyle = 'rgba(120,60,30,0.22)'; ctx.beginPath(); ctx.ellipse(0, r * 0.9, r * 0.8, r * 0.2, 0, 0, TAU); ctx.fill(); }
    ctx.translate(0, r); ctx.scale(o.sx || 1, o.sy || 1); ctx.translate(0, -r);   // squash from the base
    // flat jelly: outline, body colour, a darker belly, one small highlight (no radial gloss)
    ctx.fillStyle = rimOf(hex); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.fillStyle = hex; ctx.beginPath(); ctx.arc(0, -rim * 0.5, r - rim, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(0, -rim * 0.5, r - rim, 0, TAU); ctx.clip();
    ctx.fillStyle = U.rgba(U.shade(hex, -0.3), 0.35); ctx.beginPath(); ctx.ellipse(0, r * 0.62, r * 1.05, r * 0.5, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.5, r * 0.2, r * 0.09, -0.65, 0, TAU); ctx.fill();
    const emo = o.emo || 'happy';
    if (emo !== 'none') {
      const ey = -r * 0.14, ex = r * 0.34, er = r * 0.23;
      ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.4, r * 0.09);
      for (let s = -1; s <= 1; s += 2) {
        if (emo === 'sleep') { ctx.beginPath(); ctx.arc(ex * s, ey - er * 0.2, er * 0.7, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
        else if (emo === 'shoot') { ctx.beginPath(); ctx.arc(ex * s, ey + er * 0.5, er * 0.7, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); }
        else {
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex * s, ey, er, 0, TAU); ctx.fill();
          ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex * s, ey + (emo === 'sad' ? er * 0.3 : -er * 0.28), er * 0.56, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex * s - er * 0.2, ey + (emo === 'sad' ? er * 0.05 : -er * 0.5), er * 0.2, 0, TAU); ctx.fill();
        }
      }
      const my = r * 0.26;
      if (emo === 'shoot') { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, my, r * 0.13, r * 0.16, 0, 0, TAU); ctx.fill(); }
      else if (emo === 'sad') { ctx.beginPath(); ctx.arc(0, my + r * 0.16, r * 0.17, 1.2 * Math.PI, 1.8 * Math.PI); ctx.stroke(); }
      else if (emo === 'sleep') { ctx.beginPath(); ctx.moveTo(-r * 0.08, my); ctx.lineTo(r * 0.08, my); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(0, my - r * 0.06, r * 0.17, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    }
    ctx.restore();
  };

  // count pill under a blob
  R.pill = function (ctx, str, x, y, h) {
    ctx.font = '800 ' + (h * 0.78) + 'px "Baloo 2", system-ui, sans-serif';
    const w = Math.max(h * 1.5, ctx.measureText(str).width + h * 0.8);
    U.rr(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fillStyle = INK; ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(str, x, y + h * 0.06);
  };

  R.coin = function (ctx, x, y, r, spin) {
    const sx = spin === undefined ? 1 : Math.max(0.25, Math.abs(Math.cos(spin)));
    ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1);
    ctx.fillStyle = '#c47d0a'; ctx.beginPath(); ctx.arc(0, r * 0.12, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffc93c'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffe58a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffc93c'; ctx.beginPath(); ctx.arc(0, r * 0.06, r * 0.6, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.38, r * 0.26, r * 0.12, -0.6, 0, TAU); ctx.fill();
    ctx.restore();
  };

  // ---------- tutorial hand ----------
  // The glove picture (assets/hand.png, 115 x 145, finger up and to the left). It is resampled once per size into a
  // cached canvas with its soft shadow baked in, so a frame only copies pixels; tipX/tipY is the fingertip in it.
  const HAND = { img: new Image(), w: 115, h: 145, tipX: 15, tipY: 6, cv: null, px: 0, k: 1, pad: 0 };
  HAND.img.src = 'assets/hand.png';
  function handSprite(h) {
    const px = Math.max(8, Math.round(h * R.dpr));   // glove height in device pixels
    if (HAND.cv && HAND.px === px) return HAND.cv;
    const k = px / HAND.h, pad = Math.ceil(px * 0.1), cv = HAND.cv || (HAND.cv = document.createElement('canvas'));
    cv.width = Math.ceil(HAND.w * k) + pad * 2; cv.height = px + pad * 2;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.shadowColor = 'rgba(60,20,10,0.3)'; c.shadowBlur = px * 0.05; c.shadowOffsetX = px * 0.015; c.shadowOffsetY = px * 0.04;
    c.drawImage(HAND.img, pad, pad, HAND.w * k, px);
    HAND.px = px; HAND.k = k; HAND.pad = pad;
    return cv;
  }
  // (x, y) is the fingertip, h the glove's height; press 0..1 squashes it a little towards the fingertip
  R.hand = function (ctx, x, y, h, press) {
    if (!HAND.img.complete || !HAND.img.naturalWidth) return;   // still loading: no hand this frame
    const cv = handSprite(h), sc = (1 - press * 0.1) / R.dpr;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.drawImage(cv, -(HAND.pad + HAND.tipX * HAND.k), -(HAND.pad + HAND.tipY * HAND.k));
    ctx.restore();
  };
})();
