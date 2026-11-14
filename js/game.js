/* The play scene. Rules live in core.js and resolve instantly; this file turns each rule event into
   motion: worms slither out along their own body path, ball up at the tray edge, hop onto the rack,
   squirt droplets at the picture, and the picture fills ring by ring. */
(function () {
  'use strict';
  const JT = window.JT, U = JT.U, C = JT.Core, R = JT.Render, A = JT.Audio, FX = JT.FX, E = U.ease;
  const T = (k, v) => JT.I18n.t(k, v);
  const COL = R.COL;
  const TICK = 70, SHOT = 210, FLY = 330;
  const G = JT.Game = { paused: false };

  let L = null, S = null, idx = 0, lay = null, layVer = 0;
  let clock = 0, tickAcc = 0, status = 'idle', hearts = 3;
  let W = [], exits = [], balls = [], shots = [], sched = [], vis = [];
  let paintedAt = null, visLeft = null, visRing = 0, ringCells = null, ringColors = null;
  let ringFlash = -1e9, picPulse = -1e9, rackAlarm = -1e9, winT0 = -1;
  let revealed = null, rotAnim = {}, hintId = -1, handId = -1, pickMode = false;
  let lastInput = 0, nextWiggle = 0, shake = { t0: -1e9, amp: 0, dur: 1 };
  let extraSlots = 0, bonusCoins = 0, tut = null;
  let staticCv = null, unpCv = null, unpRing = -9, unpVer = -1;
  const tmpA = [], tmpB = [];

  const angleOf = d => Math.atan2(C.DIRS[d][1], C.DIRS[d][0]);
  const sx = x => lay.bx + (x + 0.5) * lay.cell, sy = y => lay.by + (y + 0.5) * lay.cell;
  const after = (ms, fn) => sched.push({ at: clock + ms, fn: fn });
  const isHidden = id => L.hoses[id].mystery && !revealed[id];
  const blobR = paint => lay.slotR * (0.76 + 0.24 * Math.min(1, paint / 18));
  const slotPos = i => ({ x: lay.rackX + lay.rackPad + lay.sw * (i + 0.5), y: lay.rackY + lay.rackH * 0.47 });
  const picCell = i => ({ x: lay.picX + (i % L.pic.w + 0.5) * lay.pc, y: lay.picY + (((i / L.pic.w) | 0) + 0.5) * lay.pc });
  function shakeIt(amp, dur) { shake = { t0: clock, amp: amp, dur: dur }; }
  function tip(key, ms) {
    const tips = JT.Save.data.tips;
    if (tips[key]) return;
    tips[key] = 1; JT.Save.save();
    JT.UI.toast(T(key), ms || 4200);
  }

  // ---------- worm paths (in cell units, corners rounded) ----------
  function buildPath(P, sharp) {
    const pts = [], cum = [], cellS = new Array(P.length).fill(0);
    let total = 0;
    const push = (x, y) => {
      if (pts.length) { const q = pts[pts.length - 1], d = Math.hypot(x - q.x, y - q.y); if (d < 1e-6) return; total += d; }
      pts.push({ x: x, y: y }); cum.push(total);
    };
    const line = (x, y) => {
      const q = pts[pts.length - 1], qx = q.x, qy = q.y, d = Math.hypot(x - qx, y - qy);
      const n = Math.max(1, Math.ceil(d / 0.125));
      for (let k = 1; k <= n; k++) push(qx + (x - qx) * k / n, qy + (y - qy) * k / n);
    };
    push(P[0][0], P[0][1]);
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], c = P[i + 1];
      const corner = c && i !== sharp && ((b[0] - a[0]) !== (c[0] - b[0]) || (b[1] - a[1]) !== (c[1] - b[1]));
      if (corner) {
        const m1x = (a[0] + b[0]) / 2, m1y = (a[1] + b[1]) / 2, m2x = (b[0] + c[0]) / 2, m2y = (b[1] + c[1]) / 2;
        const ox = m1x + (c[0] - b[0]) / 2, oy = m1y + (c[1] - b[1]) / 2;
        line(m1x, m1y);
        for (let k = 1; k <= 6; k++) {
          const ph = (k / 6) * Math.PI / 2;
          push(ox + (m1x - ox) * Math.cos(ph) + (m2x - ox) * Math.sin(ph), oy + (m1y - oy) * Math.cos(ph) + (m2y - oy) * Math.sin(ph));
          if (k === 3) cellS[i] = total;
        }
      } else { line(b[0], b[1]); cellS[i] = total; }
    }
    return { pts: pts, cum: cum, len: total, cellS: cellS };
  }
  function pointAt(path, s) {
    const pts = path.pts, cum = path.cum, n = pts.length;
    if (s <= 0) return pts[0];
    if (s >= path.len) return pts[n - 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const f = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
    return { x: pts[lo].x + (pts[hi].x - pts[lo].x) * f, y: pts[lo].y + (pts[hi].y - pts[lo].y) * f };
  }
  // screen points of the stretch [s0, s1] of a path
  function pathPts(path, s0, s1, out) {
    out.length = 0;
    const pts = path.pts, cum = path.cum;
    s0 = U.clamp(s0, 0, path.len); s1 = U.clamp(s1, 0, path.len);
    const a = pointAt(path, s0);
    out.push({ x: sx(a.x), y: sy(a.y) });
    for (let i = 0; i < pts.length; i++) {
      const c = cum[i];
      if (c <= s0 + 1e-4) continue;
      if (c >= s1 - 1e-4) break;
      out.push({ x: sx(pts[i].x), y: sy(pts[i].y) });
    }
    const b = pointAt(path, Math.max(s1, s0 + 0.01));
    out.push({ x: sx(b.x), y: sy(b.y) });
    return out;
  }
  function rayLen(h, dir) {
    const head = h.cells[h.cells.length - 1], d = C.DIRS[dir];
    let n = 0, x = head[0] + d[0], y = head[1] + d[1];
    while (x >= 0 && y >= 0 && x < L.cols && y < L.rows) { n++; x += d[0]; y += d[1]; }
    return n;
  }
  // the worm's body path extended straight out of the box in direction dir
  function exitPath(id, dir) {
    const h = L.hoses[id], d = C.DIRS[dir], hi = h.cells.length - 1, head = h.cells[hi], prev = h.cells[hi - 1];
    const rl = rayLen(h, dir);
    const cells = h.cells.map(c => [c[0], c[1]]);
    for (let k = 1; k <= rl + 3; k++) cells.push([head[0] + d[0] * k, head[1] + d[1] * k]);
    const straight = head[0] - prev[0] === d[0] && head[1] - prev[1] === d[1];
    const path = buildPath(cells, straight ? -1 : hi);
    path.headS = path.cellS[hi]; path.rl = rl;
    return path;
  }
  function wiggle(src, amp, phase) {
    const n = src.length, out = tmpB; out.length = 0;
    for (let i = 0; i < n; i++) {
      const a = src[i > 0 ? i - 1 : 0], b = src[i < n - 1 ? i + 1 : n - 1];
      let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const d = Math.sin(i * 0.5 - phase) * amp;
      out.push({ x: src[i].x - ty * d, y: src[i].y + tx * d });
    }
    return out;
  }

  // ---------- level setup ----------
  G.start = function (i) {
    idx = i; L = JT.Levels.get(i); S = C.newState(L);
    clock = 0; tickAcc = 0; status = 'play'; hearts = 3; G.paused = false;
    exits = []; balls = []; shots = []; sched = []; vis = new Array(S.slots.length).fill(null);
    paintedAt = new Float64Array(L.pic.total).fill(Infinity);
    visLeft = L.pic.ringSize.slice(); visRing = 0;
    ringFlash = picPulse = rackAlarm = -1e9; winT0 = -1;
    // the level clock restarts at 0, so every timestamp taken on the old clock has to be dropped with it
    shake = { t0: -1e9, amp: 0, dur: 1 };
    revealed = new Uint8Array(L.hoses.length); rotAnim = {};
    hintId = handId = -1; pickMode = false; lastInput = 0; nextWiggle = 2400; extraSlots = 0; bonusCoins = 0;
    FX.world.p.length = 0;
    const pic = L.pic;
    ringCells = []; for (let r = 0; r < pic.rings; r++) ringCells.push([]);
    for (let c = 0; c < pic.total; c++) ringCells[pic.layer[c]].push(c);
    ringColors = ringCells.map(cells => {
      const m = {}; for (const c of cells) m[pic.cells[c]] = (m[pic.cells[c]] || 0) + 1;
      return Object.keys(m).map(k => ({ c: k, n: m[k] })).sort((a, b) => b.n - a.n);
    });
    W = L.hoses.map((h, k) => {
      const path = buildPath(h.cells, -1);
      return { path: path, Lw: path.len, numS: path.cellS[Math.floor((h.len - 1) / 2)], pts: null, ver: -1,
        wig: -1e9, jig: -1e9, flash: -1e9, rev: -1e9, bump: null, blink: U.rand(600, 4000), blinkT: -1e9, born: 260 + k * 30, gone: -1 };
    });
    tut = idx === 0 && !JT.Save.data.tips.tut ? { step: 0 } : null;
    G.layout();
    checkReveals(true);
    JT.UI.setHearts(hearts);
  };

  G.layout = function () {
    if (!L) return;
    const Wd = JT.App.W, H = JT.App.H, u = Wd / 100;
    const top = JT.UI.playTop(), bot = JT.UI.playBottom(), A0 = bot - top;
    const slots = S.slots.length, pic = L.pic;
    const pad = 3 * u, gap = 2.6 * u, fp = 2.2 * u, trayPad = 2.4 * u;
    const sw = Math.min(15 * u, (Wd - 2 * pad - 4 * u) / slots);
    const rackH = U.clamp(sw * 1.16, 12 * u, 17 * u), rackW = sw * slots + 4 * u;
    const sideW = U.clamp(Wd * 0.29, 25 * u, 32 * u);
    let pc = Math.floor(Math.min((Wd - 2 * pad - sideW - gap - 2 * fp) / pic.w, (A0 * 0.36 - 2 * fp) / pic.h));
    pc = U.clamp(pc, 8, 30);
    let cell, picPH;
    for (;;) {
      picPH = pc * pic.h + 2 * fp;
      const availH = A0 - picPH - rackH - 2 * gap - 6 * u;
      cell = Math.min((Wd - 2 * pad - 2 * trayPad) / L.cols, (availH - 2 * trayPad) / L.rows, 15 * u);
      if (cell >= 7.4 * u || pc <= 9) break;
      pc--;
    }
    cell = Math.max(12, Math.floor(cell));
    const trayW = cell * L.cols + 2 * trayPad, trayH = cell * L.rows + 2 * trayPad;
    const total = picPH + rackH + trayH + 2 * gap + 4 * u;
    let y = top + Math.max(0, (A0 - total) * 0.4);
    const ppW = pc * pic.w + 2 * fp, ppX = (Wd - (ppW + gap + sideW)) / 2;
    lay = { W: Wd, H: H, u: u, pc: pc, ppX: ppX, ppY: y, ppW: ppW, ppH: picPH, picX: ppX + fp, picY: y + fp, picW: pc * pic.w, picH: pc * pic.h,
      sideX: ppX + ppW + gap, sideY: y, sideW: sideW, sideH: picPH };
    y += picPH + gap + 1.5 * u;
    lay.rackX = (Wd - rackW) / 2; lay.rackY = y; lay.rackW = rackW; lay.rackH = rackH; lay.sw = sw; lay.rackPad = 2 * u;
    lay.slotR = Math.min(sw * 0.4, rackH * 0.35);
    y += rackH + gap + 1.5 * u;
    lay.trayX = (Wd - trayW) / 2; lay.trayY = y; lay.trayW = trayW; lay.trayH = trayH; lay.trayPad = trayPad; lay.cell = cell;
    lay.bx = lay.trayX + trayPad; lay.by = y + trayPad; lay.lip = (trayPad + 2.4 * u) / cell;
    layVer++;
    buildStatic();
  };

  function buildStatic() {
    const dpr = R.dpr, u = lay.u;
    staticCv = staticCv || document.createElement('canvas');
    staticCv.width = Math.round(lay.W * dpr); staticCv.height = Math.round(lay.H * dpr);
    const c = staticCv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    R.background(c, lay.W, lay.H);
    R.panel(c, lay.ppX, lay.ppY, lay.ppW, lay.ppH, 4.6 * u);
    U.rr(c, lay.picX - 0.9 * u, lay.picY - 0.9 * u, lay.picW + 1.8 * u, lay.picH + 1.8 * u, 2.6 * u); c.fillStyle = '#e9d3b1'; c.fill();
    R.panel(c, lay.sideX, lay.sideY, lay.sideW, lay.sideH, 4.6 * u);
    R.panel(c, lay.rackX, lay.rackY, lay.rackW, lay.rackH, lay.rackH / 2);
    for (let i = 0; i < S.slots.length; i++) {
      const p = slotPos(i), r = lay.slotR * 1.08;
      c.fillStyle = '#e3c9a4'; c.beginPath(); c.arc(p.x, p.y + lay.slotR * 0.12, r, 0, U.TAU); c.fill();
      c.fillStyle = '#f3e2c6'; c.beginPath(); c.arc(p.x, p.y + lay.slotR * 0.12 + r * 0.1, r * 0.94, 0, U.TAU); c.fill();
    }
    R.tray(c, lay.trayX, lay.trayY, lay.trayW, lay.trayH, lay.trayPad, lay.cell, L.cols, L.rows);
  }
  function buildUnpainted() {
    const dpr = R.dpr, pc = lay.pc, pic = L.pic;
    unpCv = unpCv || document.createElement('canvas');
    unpCv.width = Math.round(lay.picW * dpr); unpCv.height = Math.round(lay.picH * dpr);
    const c = unpCv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, lay.picW, lay.picH);
    for (let i = 0; i < pic.total; i++) R.socket(c, (i % pic.w) * pc, ((i / pic.w) | 0) * pc, pc, COL(pic.cells[i]), pic.layer[i] === visRing);
    unpRing = visRing; unpVer = layVer;
  }

  // ---------- mystery + dizzy worms ----------
  function checkReveals(silent) {
    let any = false;
    for (const h of L.hoses) {
      if (!h.mystery || revealed[h.id] || S.removed[h.id]) continue;
      if (!C.isCovered(L, S, h.id) && C.rayCheck(L, S, h.id).free) {
        revealed[h.id] = 1; any = true;
        if (!silent) {
          W[h.id].rev = clock;
          const hd = h.cells[h.cells.length - 1];
          FX.burst(FX.world, sx(hd[0]), sy(hd[1]), '#f1eefa', 10, 0.28, lay.cell * 0.09);
          FX.sparkles(FX.world, sx(hd[0]), sy(hd[1]), 5, lay.cell * 0.5);
        }
      }
    }
    if (any && !silent) A.unwrap();
  }
  function headAngle(id) {
    const a = rotAnim[id];
    if (a) { const p = (clock - a.t0) / 280; if (p < 1) return a.from + (a.to - a.from) * E.outBack(p, 1.4); }
    return angleOf(C.curDir(L, S, id));
  }
  function noteRotations(before) {
    let turned = false;
    for (const h of L.hoses) {
      if (!h.rot || S.removed[h.id]) continue;
      const nd = C.curDir(L, S, h.id), od = before[h.id];
      if (nd === od) continue;
      const from = angleOf(od);
      let delta = ((nd - od + 4) % 4) * Math.PI / 2; if (delta > Math.PI) delta -= U.TAU;
      rotAnim[h.id] = { from: from, to: from + delta, t0: clock };
      turned = true;
    }
    if (turned) A.turn();
  }

  // ---------- input ----------
  function hitWorm(px, py) {
    const cell = lay.cell, fx = (px - lay.bx) / cell - 0.5, fy = (py - lay.by) / cell - 0.5;
    if (fx < -1.1 || fy < -1.1 || fx > L.cols + 0.1 || fy > L.rows + 0.1) return -1;
    const cx = Math.round(fx), cy = Math.round(fy);
    if (cx >= 0 && cy >= 0 && cx < L.cols && cy < L.rows) {
      const i = cy * L.cols + cx;
      if (S.occ2[i] !== -1) return S.occ2[i];
      if (S.occ[i] !== -1) return S.occ[i];
    }
    let best = -1, bd = 0.6 * 0.6;
    for (let id = 0; id < L.hoses.length; id++) {
      if (S.removed[id]) continue;
      const pts = W[id].path.pts;
      for (let k = 0; k < pts.length; k++) {
        const d = (pts[k].x - fx) * (pts[k].x - fx) + (pts[k].y - fy) * (pts[k].y - fy);
        if (d < bd) { bd = d; best = id; }
      }
    }
    return best;
  }
  G.pointerDown = function (px, py) {
    if (!L || status !== 'play' || G.paused) return;
    const id = hitWorm(px, py);
    if (id < 0) { if (pickMode && py > lay.trayY) G.setPick(false); return; }
    G.tapWorm(id);
  };
  G.tapWorm = function (id) {
    if (status !== 'play' || S.removed[id] || W[id].bump) return;
    lastInput = clock; hintId = handId = -1;
    if (pickMode) {
      if (!C.canPull(L, S, id)) { rackFull(id); return; }
      G.setPick(false);
      JT.App.spendBooster('pick');
      doPull(id, 'lift');
      return;
    }
    const top = C.coverOf(L, S, id);
    if (top >= 0) {
      W[id].jig = clock; W[top].flash = clock; W[top].jig = clock;
      A.full(); A.buzz(15); tip('tipCovered');
      return;
    }
    const rc = C.rayCheck(L, S, id);
    if (!rc.free) { bump(id, rc); return; }
    if (!C.canPull(L, S, id)) { rackFull(id); return; }
    doPull(id, 'slide');
  };

  function rackFull(id) {
    W[id].jig = clock; rackAlarm = clock;
    A.full(); A.buzz(20); tip('tipFull', 3200);
  }

  function bump(id, rc) {
    const dir = C.curDir(L, S, id), path = exitPath(id, dir);
    const amp = Math.max(0.2, rc.dist - 0.66), dur = 300 + amp * 60;
    W[id].bump = { t0: clock, dur: dur, amp: amp, path: path };
    after(dur * 0.42, () => {
      const b = W[rc.blocker]; b.flash = clock; b.jig = clock;
      const hp = pointAt(path, path.headS + amp + 0.36);
      FX.burst(FX.world, sx(hp.x), sy(hp.y), '#ffffff', 8, 0.3, lay.cell * 0.08);
      FX.ring(FX.world, sx(hp.x), sy(hp.y), '#ff5468', lay.cell * 0.1, lay.cell * 0.7, 320, 5);
      shakeIt(lay.u * 1.6, 260); A.bonk(); A.buzz(40);
    });
    after(dur, () => { W[id].bump = null; });
    hearts--;
    JT.UI.setHearts(hearts, true);
    const hd = L.hoses[id].cells[L.hoses[id].cells.length - 1];
    FX.text('-1', sx(hd[0]), sy(hd[1]) - lay.cell * 0.4, { size: lay.u * 6, fill: '#ff5468', stroke: '#fff', delay: dur * 0.42, rise: lay.u * 7 });
    if (hearts <= 0) lose('hearts');
    else tip('tipBlocked');
  }

  function doPull(id, mode) {
    const h = L.hoses[id], wv = W[id];
    const dir = C.curDir(L, S, id);
    const before = L.hoses.map(x => C.curDir(L, S, x.id));
    const hid = isHidden(id);
    let path, edgeS, dur, ex, ey;
    if (mode === 'lift') {
      path = wv.path; edgeS = wv.Lw / 2; dur = 420;
      const m = pointAt(path, edgeS); ex = sx(m.x); ey = sy(m.y) - lay.cell * 0.35;
    } else {
      path = exitPath(id, dir); edgeS = path.headS + path.rl + 0.5 + lay.lip; dur = 240 + edgeS * 30;
      const e = pointAt(path, edgeS); ex = sx(e.x); ey = sy(e.y);
    }
    const ev = C.pull(L, S, id, clock + dur + FLY);
    if (hid) revealed[id] = 1;
    exits.push({ id: id, mode: mode, path: path, Lw: wv.Lw, edgeS: edgeS, ex: ex, ey: ey, t0: clock, dur: dur, ev: ev, c: h.color, paint: h.paint, ang: angleOf(dir), popped: false, puff: 0 });
    noteRotations(before);
    checkReveals(false);
    A.whoosh(); A.buzz(8);
    if (tut && tut.step === 0) { tut.step = 1; JT.UI.toast(T('tut2'), 4200); }
  }

  // ---------- rack visuals ----------
  function inbound(slot, except) {
    return balls.some(b => b !== except && b.slot === slot) || exits.some(e => !e.ev.discarded && e.ev.slot === slot);
  }
  function land(b) {
    const i = b.slot, sl = S.slots[i], p = slotPos(i);
    const truth = sl ? sl.color : b.c;
    let v = vis[i];
    if (!v) {
      v = vis[i] = { c: b.c, paint: b.paint, born: clock, bumpT: -1e9, shotT: -1e9, mixT: -1e9, from: null };
      A.land(); A.buzz(10);
      FX.ring(FX.world, p.x, p.y, COL(b.c), lay.slotR * 0.6, lay.slotR * 1.7, 360, 5);
      FX.burst(FX.world, p.x, p.y + lay.slotR * 0.5, COL(b.c), 6, 0.22, lay.u * 1.1, { up: 0.1 });
    } else {
      v.paint += b.paint; v.bumpT = clock;
      if (truth === v.c && b.c === v.c) {
        A.merge(); A.buzz(12);
        FX.text('+' + b.paint, p.x, p.y - lay.slotR * 1.3, { size: lay.u * 5.4, fill: '#ffffff', stroke: U.shade(COL(v.c), -0.45), rise: lay.u * 6 });
        FX.ring(FX.world, p.x, p.y, '#ffffff', lay.slotR * 0.8, lay.slotR * 2, 420, 6);
        FX.sparkles(FX.world, p.x, p.y, 5, lay.slotR);
        tip('tipMerge');
      }
    }
    if (truth !== v.c) {
      v.from = v.c; v.c = truth; v.mixT = clock;
      A.mix();
      FX.text(JT.I18n.colorName(truth) + '!', p.x, p.y - lay.slotR * 1.3, { size: lay.u * 5.4, fill: COL(truth), stroke: R.INK, rise: lay.u * 6 });
      FX.burst(FX.world, p.x, p.y, COL(v.from), 7, 0.3, lay.u * 1.2);
      FX.burst(FX.world, p.x, p.y, COL(b.c), 7, 0.3, lay.u * 1.2);
    }
    if (sl && !inbound(i, b)) v.paint = sl.paint;
    if (sl && !C.hasDemand(L, S, sl.color)) tip('tipSleep');
  }
  function popBlob(i, toCoins) {
    const v = vis[i]; if (!v) return;
    vis[i] = null;
    const p = slotPos(i), hex = COL(v.c);
    FX.burst(FX.world, p.x, p.y, hex, 12, 0.34, lay.u * 1.5);
    FX.ring(FX.world, p.x, p.y, hex, lay.slotR * 0.4, lay.slotR * 1.6, 340, 5);
    A.pop(i);
    if (toCoins) giveCoins(p.x, p.y, 1);
  }
  function giveCoins(x, y, n) {
    bonusCoins += n;
    FX.coinFly(x, y, n, () => JT.App.addCoins(1));
  }

  // ---------- simulation tick ----------
  function tick() {
    const ev = C.paintStep(L, S, clock);
    for (const e of ev) {
      if (e.cell !== undefined) {
        const v = vis[e.slot], from = slotPos(e.slot), to = picCell(e.cell);
        if (v) { v.paint = Math.max(0, v.paint - 1); v.shotT = clock; }
        shots.push({ x0: from.x, y0: from.y - lay.slotR * 0.7, x1: to.x, y1: to.y, t0: clock, dur: SHOT, c: e.color, cell: e.cell, bend: U.rand(-1, 1) * lay.u * 2 });
        paintedAt[e.cell] = clock + SHOT;
      } else if (e.empty) popBlob(e.slot, false);
      else if (e.drained) { popBlob(e.slot, true); tip('tipDone'); }
    }
    if (S.left === 0) { status = 'won'; hintId = handId = -1; pickMode = false; JT.UI.setPick(false); return; }
    if (!ev.length && !pickMode) {
      const pending = S.slots.some(sl => sl && sl.ready > clock) || exits.length || balls.length;
      if (!pending && C.options(L, S).length === 0) lose(rackBlocked() ? 'rack' : 'stuck');
    }
  }
  // true when some worm could leave if only the rack had room
  function rackBlocked() {
    for (let id = 0; id < L.hoses.length; id++) {
      if (!S.removed[id] && !C.isCovered(L, S, id) && C.rayCheck(L, S, id).free && !C.canPull(L, S, id)) return true;
    }
    return false;
  }
  function lose(reason) {
    if (status !== 'play') return;
    status = 'lost'; hintId = handId = -1;
    if (reason !== 'hearts') { rackAlarm = clock; shakeIt(lay.u, 300); }
    after(reason === 'hearts' ? 700 : 500, () => { A.lose(); A.buzz([30, 60, 30]); });
    after(reason === 'hearts' ? 1000 : 800, () => JT.App.onFail(reason));
  }

  function onRingDone(r) {
    const pic = L.pic, cx = lay.picX + lay.picW / 2, cy = lay.picY + lay.picH / 2;
    if (visRing >= pic.rings) { beginWin(); return; }
    ringFlash = clock; picPulse = clock;
    A.ringDone(r); A.buzz(18);
    FX.text(U.pick(T('praise')), cx, cy, { size: lay.u * 8.5, fill: '#ffffff', stroke: '#e23f85', rot: U.rand(-0.12, 0.12), life: 1050, rise: lay.u * 5 });
    for (const c of ringCells[r]) {
      if (Math.random() < 0.3) { const p = picCell(c); FX.sparkles(FX.world, p.x, p.y, 1, lay.pc * 0.3, '#ffffff'); }
    }
    if (tut && tut.step < 2) { tut.step = 2; JT.UI.toast(T('tut3'), 4500); }
  }
  function beginWin() {
    const cx = lay.picX + lay.picW / 2, cy = lay.picY + lay.picH / 2;
    winT0 = clock; picPulse = clock;
    A.win(); A.buzz([20, 40, 20, 40, 60]);
    FX.confetti(cx, cy, 70, -Math.PI / 2, Math.PI, 0.95);
    FX.confetti(0, lay.H * 0.72, 45, -Math.PI / 3, 0.5, 1.35);
    FX.confetti(lay.W, lay.H * 0.72, 45, -Math.PI * 2 / 3, 0.5, 1.35);
    FX.text(T('winPraise'), lay.W / 2, cy, { size: lay.u * 11, fill: '#ffe14d', stroke: '#e23f85', life: 1500, rise: lay.u * 4, delay: 150 });
    let t = 520, k = 0;
    for (let id = 0; id < L.hoses.length; id++) {
      if (S.removed[id]) continue;
      const kk = k++;
      after(t, () => {
        const wv = W[id], m = pointAt(wv.path, wv.Lw / 2), hex = isHidden(id) ? R.WRAP : COL(L.hoses[id].color);
        wv.gone = clock; S.removed[id] = 1;
        FX.burst(FX.world, sx(m.x), sy(m.y), hex, 10, 0.32, lay.cell * 0.1);
        A.pop(kk); A.buzz(6);
        giveCoins(sx(m.x), sy(m.y), 2);
      });
      t += 90;
    }
    for (let i = 0; i < vis.length; i++) {
      if (!vis[i]) continue;
      after(t, () => popBlob(i, true));
      t += 90;
    }
    after(t + 750, () => JT.App.onWin({ hearts: hearts, bonus: bonusCoins }));
    if (tut) { JT.Save.data.tips.tut = 1; JT.Save.save(); tut = null; }
  }

  // ---------- frame update ----------
  G.update = function (dt) {
    if (!L || G.paused) return;
    clock += dt;
    for (let i = 0; i < sched.length;) {
      if (sched[i].at <= clock) { const f = sched[i].fn; sched.splice(i, 1); f(); } else i++;
    }
    // worms leaving the box
    let n = 0;
    for (const a of exits) {
      if (clock - a.t0 < a.dur) {
        a.puff -= dt;
        if (a.mode === 'slide' && a.puff <= 0 && clock - a.t0 > 100) {
          a.puff = 34;
          const q = clock - a.t0 < 90 ? 0 : (clock - a.t0 - 90) / (a.dur - 90), s = Math.max(0, a.edgeS * q * q * (1.6 - 0.6 * q));
          if (s < a.edgeS - 0.2) { const tp = pointAt(a.path, s); FX.world.add({ x: sx(tp.x), y: sy(tp.y), vx: 0, vy: 0, life: 300, size: lay.cell * 0.13, color: U.rgba(COL(a.c), 0.5), shrink: true }); }
        }
        exits[n++] = a; continue;
      }
      if (a.ev.discarded) {
        FX.burst(FX.world, a.ex, a.ey, '#ffd23f', 10, 0.3, lay.u * 1.3);
        A.pop(3); giveCoins(a.ex, a.ey, 2); tip('tipDone');
      } else balls.push({ x0: a.ex, y0: a.ey, slot: a.ev.slot, t0: a.t0 + a.dur, dur: FLY, c: a.c, paint: a.paint, trail: 0 });
    }
    exits.length = n;
    n = 0;
    for (const b of balls) {
      if (clock - b.t0 >= b.dur) { land(b); continue; }
      b.trail -= dt;
      if (b.trail <= 0) { b.trail = 26; const p = ballPos(b); FX.world.add({ x: p.x, y: p.y, vx: 0, vy: 0, life: 260, size: p.r * 0.55, color: U.rgba(COL(b.c), 0.45), shrink: true }); }
      balls[n++] = b;
    }
    balls.length = n;
    if (status === 'play') {
      tickAcc += dt;
      while (tickAcc >= TICK && status === 'play') { tickAcc -= TICK; tick(); }
    }
    // droplets landing
    n = 0;
    for (const s of shots) {
      if (clock - s.t0 < s.dur) { shots[n++] = s; continue; }
      const ly = L.pic.layer[s.cell];
      visLeft[ly]--;
      A.paint(1 - visLeft[ly] / L.pic.ringSize[ly]);
      const hex = COL(s.c);
      FX.ring(FX.world, s.x1, s.y1, hex, lay.pc * 0.3, lay.pc * 0.85, 240, 3);
      for (let k = 0; k < 2; k++) {
        const a = U.rand(0, U.TAU);
        FX.world.add({ x: s.x1, y: s.y1, vx: Math.cos(a) * 0.1, vy: Math.sin(a) * 0.1, drag: 0.9, life: 260, size: lay.pc * 0.13, color: hex, shrink: true });
      }
    }
    shots.length = n;
    while (visRing < L.pic.rings && visLeft[visRing] === 0) { visRing++; onRingDone(visRing - 1); }

    if (status !== 'play') return;
    // idle life: a free worm wiggles now and then; early levels get a pointing hand
    if (clock > nextWiggle) {
      nextWiggle = clock + U.rand(2200, 3800);
      const opts = C.options(L, S);
      if (opts.length && !exits.length) W[U.pick(opts)].wig = clock;
    }
    if (tut && tut.step === 0 && clock > 1100 && !tut.shown) { tut.shown = true; handId = suggest(); JT.UI.toast(T('tut1'), 0); }
    else if (idx < 3 && handId < 0 && hintId < 0 && clock - lastInput > (tut ? 2600 : 5500) && clock > 1500 && !exits.length && !balls.length) handId = suggest();
  };

  function suggest() {
    const sol = C.solve(L, 6000, S);
    if (sol && sol.length) return sol[0];
    return -1;
  }

  // ---------- boosters ----------
  G.useHint = function () {
    if (status !== 'play') return false;
    const id = suggest();
    if (id < 0) { JT.UI.toast(T('noHint'), 3000); return false; }
    hintId = id; handId = id; W[id].wig = clock; lastInput = clock;
    A.hint();
    return true;
  };
  G.setPick = function (on) {
    if (status !== 'play') on = false;
    pickMode = !!on; hintId = handId = -1;
    JT.UI.setPick(pickMode);
    if (pickMode) JT.UI.toast(T('tipPick'), 0); else JT.UI.toast('', 0);
    return pickMode;
  };
  G.pickMode = () => pickMode;
  G.canAddSlot = () => extraSlots < 2;
  G.addSlot = function () {
    if (extraSlots >= 2) return false;
    extraSlots++; S.slots.push(null); vis.push(null);
    G.layout();
    const p = slotPos(S.slots.length - 1);
    FX.ring(FX.world, p.x, p.y, '#3fdc86', lay.slotR * 0.5, lay.slotR * 2, 500, 6);
    FX.sparkles(FX.world, p.x, p.y, 8, lay.slotR);
    A.merge();
    return true;
  };
  G.addHeart = function () { hearts = Math.max(1, hearts + 1); JT.UI.setHearts(hearts); };
  G.resume = function () { if (status === 'lost') { status = 'play'; tickAcc = 0; lastInput = clock; } };
  G.status = () => status;
  G.level = () => idx;

  // ---------- drawing ----------
  function drawPicture(ctx) {
    const pc = lay.pc, pic = L.pic, x0 = lay.picX, y0 = lay.picY;
    if (unpRing !== visRing || unpVer !== layVer) buildUnpainted();
    const pt = clock - picPulse;
    ctx.save();
    if (pt < 420) {
      const k = 1 + 0.035 * Math.sin(Math.PI * pt / 420), cx = x0 + lay.picW / 2, cy = y0 + lay.picH / 2;
      ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy);
    }
    ctx.drawImage(unpCv, x0, y0, lay.picW, lay.picH);
    // the active ring: a soft band and a runner light
    if (visRing < pic.rings) {
      const r = visRing, a = x0 + (r + 0.5) * pc, b = y0 + (r + 0.5) * pc, ww = (pic.w - 2 * r - 1) * pc, hh = (pic.h - 2 * r - 1) * pc;
      const per = 2 * (ww + hh);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      U.rr(ctx, a, b, ww, hh, pc * 0.35);
      const ft = clock - ringFlash;
      if (ft < 500) { ctx.strokeStyle = 'rgba(255,255,255,' + (0.85 * (1 - ft / 500)) + ')'; ctx.lineWidth = pc * 1.05; ctx.stroke(); }
      ctx.setLineDash([per * 0.14, per * 0.86]); ctx.lineDashOffset = -((clock * 0.00042 * per) % per);
      ctx.strokeStyle = 'rgba(255,90,150,0.85)'; ctx.lineWidth = pc * 0.2; ctx.stroke();
      ctx.setLineDash([]);
    }
    for (let i = 0; i < pic.total; i++) {
      const t = clock - paintedAt[i];
      if (t < 0) continue;
      const cx = i % pic.w, cy = (i / pic.w) | 0;
      let sc = t < 280 ? E.outBack(t / 280, 3) : 1;
      if (winT0 >= 0) { const wt = clock - winT0 - (cx + cy) * 28; if (wt > 0 && wt < 340) sc *= 1 + 0.3 * Math.sin(Math.PI * wt / 340); }
      const spr = R.tile(pic.cells[i], pc);
      if (sc === 1) ctx.drawImage(spr, x0 + cx * pc, y0 + cy * pc, pc, pc);
      else { const s = pc * sc; ctx.drawImage(spr, x0 + cx * pc + (pc - s) / 2, y0 + cy * pc + (pc - s) / 2, s, s); }
    }
    if (winT0 >= 0) {            // glossy sweep across the finished picture
      const wt = (clock - winT0 - 250) / 700;
      if (wt > 0 && wt < 1) {
        ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, lay.picW, lay.picH); ctx.clip();
        const gx = x0 - lay.picW * 0.6 + wt * lay.picW * 2.2;
        const g = ctx.createLinearGradient(gx, y0, gx + lay.picW * 0.5, y0 + lay.picH * 0.5);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(x0, y0, lay.picW, lay.picH); ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawSide(ctx) {
    const x = lay.sideX, y = lay.sideY, w = lay.sideW, h = lay.sideH, u = lay.u, pic = L.pic;
    const ring = Math.min(visRing, pic.rings - 1), cx = x + w / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#b3855c'; ctx.font = '900 ' + (3.1 * u) + 'px Nunito, system-ui, sans-serif';
    ctx.fillText(T('ring').toUpperCase() + ' ' + Math.min(visRing + 1, pic.rings) + '/' + pic.rings, cx, y + 4.6 * u);
    // ring pips
    const pw = Math.min(3.6 * u, (w - 5 * u) / pic.rings);
    for (let r = 0; r < pic.rings; r++) {
      const px = cx + (r - (pic.rings - 1) / 2) * pw, py = y + 8.6 * u;
      ctx.beginPath(); ctx.arc(px, py, r === visRing ? pw * 0.4 : pw * 0.28, 0, U.TAU);
      ctx.fillStyle = r < visRing ? '#3fdc86' : r === visRing ? '#ff6aa6' : '#e3caa6'; ctx.fill();
    }
    // colours the active ring still needs
    const list = ringColors[ring], left = {};
    for (const c of ringCells[ring]) if (paintedAt[c] > clock) left[pic.cells[c]] = (left[pic.cells[c]] || 0) + 1;
    const cols = list.length > 4 ? 2 : 1, rows = Math.ceil(list.length / cols);
    const nextH = ring + 1 < pic.rings ? 9.5 * u : 2 * u;
    const top = y + 12 * u, areaH = h - 12 * u - nextH;
    const rowH = Math.min(cols === 1 ? 9.5 * u : 7 * u, areaH / rows), cw = (w - 3 * u) / cols, ts = Math.min(rowH * 0.72, cols === 1 ? 6.4 * u : 5 * u);
    const y0 = top + (areaH - rowH * rows) / 2;
    ctx.font = '800 ' + (ts * 0.9) + 'px "Baloo 2", system-ui, sans-serif';
    for (let k = 0; k < list.length; k++) {
      const col = k % cols, row = (k / cols) | 0, n = left[list[k].c] || 0;
      const mx = x + 1.5 * u + col * cw + cw / 2, my = y0 + row * rowH + rowH / 2;
      const tx = mx - (ts * 0.5 + ts * 0.9);
      ctx.globalAlpha = n ? 1 : 0.32;
      ctx.drawImage(R.tile(list[k].c, ts), tx, my - ts / 2, ts, ts);
      ctx.textAlign = 'left';
      if (n) { ctx.fillStyle = R.INK; ctx.fillText('×' + n, tx + ts * 1.2, my + ts * 0.07); }
      else {
        ctx.strokeStyle = '#1ea65a'; ctx.lineWidth = ts * 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.moveTo(tx + ts * 1.3, my); ctx.lineTo(tx + ts * 1.55, my + ts * 0.25); ctx.lineTo(tx + ts * 2.0, my - ts * 0.28); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    if (ring + 1 < pic.rings) {
      const ny = y + h - 8.2 * u;
      ctx.strokeStyle = '#ecd7b6'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 3 * u, ny - 0.6 * u); ctx.lineTo(x + w - 3 * u, ny - 0.6 * u); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillStyle = '#c29f79'; ctx.font = '900 ' + (2.5 * u) + 'px Nunito, system-ui, sans-serif';
      ctx.fillText(T('nextRing').toUpperCase(), cx, ny + 1.5 * u);
      const nl = ringColors[ring + 1], ds = Math.min(3.4 * u, (w - 4 * u) / nl.length);
      for (let k = 0; k < nl.length; k++) ctx.drawImage(R.tile(nl[k].c, ds * 0.86), cx + (k - (nl.length - 1) / 2) * ds - ds * 0.43, ny + 3.6 * u, ds * 0.86, ds * 0.86);
    }
  }

  function drawRack(ctx) {
    const u = lay.u, n = S.slots.length, R0 = lay.slotR;
    const landing = status === 'play' ? C.landingSlot(S) : -1;
    let free = 0; for (let i = 0; i < n; i++) if (!S.slots[i]) free++;
    const at = clock - rackAlarm;
    const alarm = at < 500 ? 1 - at / 500 : 0;
    const danger = status === 'lost' ? 1 : free === 0 ? 0.55 + 0.35 * Math.sin(clock * 0.012) : free === 1 ? 0.2 + 0.15 * Math.sin(clock * 0.006) : 0;
    const glow = Math.max(alarm, danger);
    if (glow > 0.02) {
      U.rr(ctx, lay.rackX - 1, lay.rackY - 1, lay.rackW + 2, lay.rackH + 2, lay.rackH / 2);
      ctx.strokeStyle = 'rgba(255,70,95,' + glow + ')'; ctx.lineWidth = 0.9 * u; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,70,95,' + glow * 0.3 + ')'; ctx.lineWidth = 2.4 * u; ctx.stroke();
    }
    const ox = alarm > 0 ? Math.sin(at * 0.08) * u * 0.9 * alarm : 0;
    for (let i = 0; i < n; i++) {
      const p = slotPos(i), v = vis[i];
      if (!v) {
        if (i === landing && !inbound(i)) {
          const bob = Math.sin(clock * 0.008) * u * 0.7, ay = lay.rackY - 1.2 * u + bob, s = 1.8 * u;
          ctx.beginPath(); ctx.moveTo(p.x - s, ay - s * 1.1); ctx.lineTo(p.x + s, ay - s * 1.1); ctx.lineTo(p.x, ay + s * 0.4); ctx.closePath();
          ctx.fillStyle = '#ff6aa6'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.7 * u; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fill();
          ctx.beginPath(); ctx.arc(p.x, p.y + R0 * 0.12, R0 * (0.78 + 0.05 * Math.sin(clock * 0.008)), 0, U.TAU);
          ctx.strokeStyle = 'rgba(255,106,166,0.5)'; ctx.lineWidth = 0.6 * u; ctx.setLineDash([u * 1.6, u * 1.6]); ctx.lineDashOffset = -clock * 0.02; ctx.stroke(); ctx.setLineDash([]);
        }
        continue;
      }
      let hex = COL(v.c);
      const mt = clock - v.mixT;
      if (mt < 400 && v.from) hex = U.mix(COL(v.from), hex, Math.round(mt / 40) / 10);
      const r = blobR(v.paint);
      let sxk = 1, syk = 1, oy = 0;
      const bt = (clock - v.born) / 420;
      if (bt < 1) { const k = (1 - bt) * Math.cos(bt * 13); sxk += 0.28 * k; syk -= 0.28 * k; }
      const mt2 = (clock - v.bumpT) / 380;
      if (mt2 < 1) { const k = (1 - mt2) * Math.cos(mt2 * 11); sxk += 0.3 * k; syk += 0.3 * k; }
      const st = (clock - v.shotT) / TICK;
      const shooting = clock - v.shotT < 260;
      if (st < 1) { syk *= 0.9 + 0.1 * st; oy = (1 - st) * u * 0.5; }
      const sleep = !shooting && status === 'play' && S.slots[i] && S.slots[i].ready <= clock && !C.hasDemand(L, S, v.c);
      R.blob(ctx, p.x + ox, p.y + oy, r, { hex: hex, sx: sxk, sy: syk, emo: status === 'lost' ? 'sad' : shooting ? 'shoot' : sleep ? 'sleep' : 'happy' });
      R.pill(ctx, String(v.paint), p.x + ox, p.y + R0 * 1.02, 3.9 * u);
      if (sleep) {
        ctx.fillStyle = R.INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let z = 0; z < 2; z++) {
          const zp = ((clock * 0.0007 + z * 0.5) % 1);
          ctx.globalAlpha = 0.6 * Math.sin(zp * Math.PI);
          ctx.font = '900 ' + (u * (2.4 + zp * 1.6)) + 'px Nunito, system-ui, sans-serif';
          ctx.fillText('z', p.x + r * 0.7 + zp * u * 2, p.y - r * 0.8 - zp * u * 3.2);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawWorms(ctx) {
    const cell = lay.cell, w = cell * 0.6, hr = w * 0.62, n = L.hoses.length;
    for (let id = 0; id < n; id++) {
      const h = L.hoses[id], wv = W[id];
      let k = 1;
      if (wv.gone >= 0) { const p = (clock - wv.gone) / 200; if (p >= 1) continue; k = 1 + 0.25 * Math.sin(p * Math.PI) - E.inCubic(p); }
      else if (S.removed[id]) continue;
      const ap = (clock - wv.born) / 360;
      if (ap <= 0) continue;
      if (ap < 1) k *= E.outBack(ap, 2.4);
      const hid = isHidden(id), hex = hid ? R.WRAP : COL(h.color);
      let pts;
      if (wv.bump) {
        const b = wv.bump, p = U.clamp((clock - b.t0) / b.dur, 0, 1);
        const s = b.amp * (p < 0.42 ? E.inQuad(p / 0.42) : 1 - E.outBounce((p - 0.42) / 0.58));
        pts = pathPts(b.path, s, s + wv.Lw, tmpA);
      } else {
        if (wv.ver !== layVer) { wv.pts = pathPts(wv.path, 0, wv.Lw, []); wv.ver = layVer; }
        pts = wv.pts;
        const wt = clock - wv.wig;
        if (wt < 560) pts = wiggle(pts, w * 0.17 * Math.sin(Math.PI * wt / 560), wt * 0.022);
      }
      const jt = clock - wv.jig, ox = jt < 320 ? Math.sin(jt * 0.075) * w * 0.16 * (1 - jt / 320) : 0;
      const ft = clock - wv.flash, flash = ft < 450 ? 0.8 * (1 - ft / 450) : 0;
      const head = pts[pts.length - 1], tr = k !== 1 || ox !== 0;
      if (tr) { const m = pts[pts.length >> 1]; ctx.save(); ctx.translate(m.x + ox, m.y); ctx.scale(k, k); ctx.translate(-m.x, -m.y); }
      const glow = id === hintId ? 0.6 + 0.35 * Math.sin(clock * 0.009) : pickMode ? 0.25 + 0.12 * Math.sin(clock * 0.006 + id) : 0;
      R.worm(ctx, pts, { hex: hex, w: w, glow: glow, wrap: hid, flash: flash });
      if (clock > wv.blink) { wv.blinkT = clock; wv.blink = clock + U.rand(2200, 5200); }
      R.head(ctx, head.x, head.y, headAngle(id), hr, { hex: hex, blink: clock - wv.blinkT < 130 ? 1 : 0, sleepy: C.isCovered(L, S, id), wrap: hid, flash: flash });
      if (h.rot && !hid) R.spinRing(ctx, head.x, head.y, hr * 1.42, clock * 0.0024);
      const q = pts[Math.round((wv.numS / wv.Lw) * (pts.length - 1))];
      R.label(ctx, hid ? '?' : String(h.paint), q.x, q.y - w * 0.04, Math.max(9, cell * 0.34), '#ffffff', hid ? '#746d92' : U.shade(hex, -0.58));
      const rt = clock - wv.rev;
      if (rt < 360) { ctx.globalAlpha = 0.9 * (1 - rt / 360); R.worm(ctx, pts, { hex: '#ffffff', w: w * (1 + 0.5 * rt / 360) }); ctx.globalAlpha = 1; }
      if (tr) ctx.restore();
    }
  }

  function drawExits(ctx) {
    const cell = lay.cell, w = cell * 0.6, hr = w * 0.62;
    for (const a of exits) {
      const tms = clock - a.t0, hex = COL(a.c);
      if (a.mode === 'lift') {
        const p = U.clamp(tms / a.dur, 0, 1), e = E.inOutCubic(p), mid = a.Lw / 2;
        const s0 = mid * e, s1 = a.Lw - (a.Lw - mid) * e, lift = cell * 0.35 * E.outCubic(Math.min(1, p * 2.5));
        if (s1 - s0 > 0.06) {
          ctx.save(); ctx.translate(0, -lift);
          R.worm(ctx, pathPts(a.path, s0, s1, tmpA), { hex: hex, w: w * (1 + 0.14 * Math.sin(p * Math.PI)) });
          ctx.restore();
        }
        R.blob(ctx, a.ex, a.ey + cell * 0.35 - lift, U.lerp(hr * 0.5, blobR(a.paint), Math.pow(e, 0.7)), { hex: hex, emo: 'happy', noShadow: true });
        continue;
      }
      let s;
      if (tms < 90) s = -0.18 * Math.sin(Math.PI * tms / 90);
      else { const q = (tms - 90) / (a.dur - 90); s = a.edgeS * q * q * (1.6 - 0.6 * q); }
      const tailS = Math.max(0, s), headS = Math.min(a.Lw + s, a.edgeS);
      const eaten = U.clamp((a.Lw + s - a.edgeS) / a.Lw, 0, 1);
      if (headS - tailS > 0.04) {
        const pts = pathPts(a.path, tailS, headS, tmpA);
        R.worm(ctx, pts, { hex: hex, w: w });
        if (eaten <= 0) { const hp = pts[pts.length - 1]; R.head(ctx, hp.x, hp.y, a.ang, hr, { hex: hex }); }
      }
      if (eaten > 0) {
        if (!a.popped) {
          a.popped = true;
          FX.ring(FX.world, a.ex, a.ey, '#ffffff', hr * 0.6, cell * 0.9, 300, 4);
          FX.burst(FX.world, a.ex, a.ey, hex, 6, 0.26, cell * 0.07);
        }
        const wob = 1 + 0.12 * Math.sin(eaten * 9);
        R.blob(ctx, a.ex, a.ey, U.lerp(hr, blobR(a.paint), Math.pow(eaten, 0.6)), { hex: a.ev.discarded ? U.mix(hex, '#ffd23f', eaten) : hex, sx: wob, sy: 2 - wob, emo: 'happy', noShadow: true });
      }
    }
  }
  function ballPos(b) {
    const p = U.clamp((clock - b.t0) / b.dur, 0, 1), e = p * p * (3 - 2 * p), a = 1 - e;
    const t = slotPos(b.slot), dist = Math.hypot(t.x - b.x0, t.y - b.y0);
    const cx = (b.x0 + t.x) / 2, cy = Math.min(b.y0, t.y) - dist * 0.28 - lay.u * 6;
    return { x: a * a * b.x0 + 2 * a * e * cx + e * e * t.x, y: a * a * b.y0 + 2 * a * e * cy + e * e * t.y, r: blobR(b.paint) * (1 + 0.22 * Math.sin(p * Math.PI)), p: p };
  }
  function drawBalls(ctx) {
    for (const b of balls) {
      const q = ballPos(b), st = 1 + 0.16 * Math.sin(q.p * Math.PI);
      R.blob(ctx, q.x, q.y, q.r, { hex: COL(b.c), sx: 2 - st, sy: st, emo: 'happy', noShadow: true });
    }
  }
  function drawShots(ctx) {
    const pc = lay.pc;
    ctx.lineCap = 'round';
    for (const s of shots) {
      const p = (clock - s.t0) / s.dur, e = E.outQuad(p), hex = COL(s.c);
      const bend = Math.sin(p * Math.PI) * s.bend;
      const x = U.lerp(s.x0, s.x1, e) + bend, y = U.lerp(s.y0, s.y1, e);
      const e2 = E.outQuad(Math.max(0, p - 0.16)), x2 = U.lerp(s.x0, s.x1, e2) + Math.sin(Math.max(0, p - 0.16) * Math.PI) * s.bend, y2 = U.lerp(s.y0, s.y1, e2);
      const r = pc * 0.36 * (1 - 0.25 * p);
      ctx.strokeStyle = U.rgba(hex, 0.5); ctx.lineWidth = r * 1.3; ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = U.shade(hex, -0.3); ctx.beginPath(); ctx.arc(x, y, r, 0, U.TAU); ctx.fill();
      ctx.fillStyle = hex; ctx.beginPath(); ctx.arc(x, y - r * 0.1, r * 0.82, 0, U.TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x - r * 0.28, y - r * 0.34, r * 0.24, 0, U.TAU); ctx.fill();
    }
  }
  function drawHand(ctx) {
    if (handId < 0 || status !== 'play' || S.removed[handId]) return;
    const wv = W[handId], m = pointAt(wv.path, wv.Lw * 0.5), u = lay.u;
    const ph = (clock % 1100) / 1100, press = ph < 0.5 ? Math.sin(ph * 2 * Math.PI) : 0;
    const x = sx(m.x), y = sy(m.y);
    if (ph < 0.5) { ctx.beginPath(); ctx.arc(x, y, lay.cell * (0.25 + ph * 1.1), 0, U.TAU); ctx.strokeStyle = 'rgba(255,255,255,' + (0.9 - ph * 1.8) + ')'; ctx.lineWidth = u; ctx.stroke(); }
    R.hand(ctx, x + (1 - press) * u * 1.6, y + (1 - press) * u * 2.2, 11 * u, press);
  }

  G.draw = function (ctx) {
    if (!L) return;
    let shx = 0, shy = 0;
    const st = clock - shake.t0;
    if (st >= 0 && st < shake.dur) {
      const k = 1 - st / shake.dur; shx = Math.sin(st * 0.085) * shake.amp * k; shy = Math.cos(st * 0.11) * shake.amp * k * 0.7;
      ctx.drawImage(staticCv, 0, 0, lay.W, lay.H);   // unshifted backdrop, so the shaken scene never uncovers an old frame at the edges
    }
    ctx.save(); ctx.translate(shx, shy);
    ctx.drawImage(staticCv, 0, 0, lay.W, lay.H);
    drawPicture(ctx); drawSide(ctx); drawRack(ctx); drawWorms(ctx); drawExits(ctx); drawBalls(ctx); drawShots(ctx);
    FX.world.draw(ctx);
    drawHand(ctx);
    ctx.restore();
  };

  // ---------- debug / automated playtest hooks ----------
  G.debug = {
    state() {
      return { level: idx, status: status, hearts: hearts, clock: Math.round(clock), left: S.left, ring: S.ring, visRing: visRing,
        slots: S.slots.map(s => (s ? s.color + s.paint : '-')).join(' '), vis: vis.map(v => (v ? v.c + v.paint : '-')).join(' '),
        options: C.options(L, S), worms: L.hoses.length, removed: Array.from(S.removed).reduce((a, b) => a + b, 0), exits: exits.length, balls: balls.length, shots: shots.length };
    },
    suggest: suggest,
    layout: () => lay,
    wormCenter(id) { const m = pointAt(W[id].path, W[id].Lw / 2); return { x: sx(m.x), y: sy(m.y) }; }
  };
})();
