/* The glove from the first level's tutorial as the mouse pointer while a level is on screen, its popups included.
   Its fingertip is where the mouse points; while the button is down the finger dips in, as in the tutorial's tap, and
   each press leaves a white ring. Mouse only: a touch or a pen hides it, and outside a level the normal pointer is
   back. The glove is its own small canvas above everything but the boot screen, moved with a transform, so following
   the mouse costs no redraw of the game. */
(function () {
  'use strict';
  const JT = window.JT, R = JT.Render, UI = JT.UI, FX = JT.FX;
  const SIZE = 16;                     // glove height in layout units (1% of the column width), as in the tutorial
  const DOWN = 70, UP = 140;           // ms for the finger to go down, and to come back up
  let app = null, cv = null, ctx = null, rect = null;
  let mouse = false, inside = false, shown = false;
  let x = 0, y = 0;                    // the mouse, in px from the column's top-left corner
  let press = 0, target = 0, anim = 0, lastT = 0;
  let box = null, key = '', dirty = true;

  const wanted = () => mouse && inside && JT.App.state === 'game';

  // The canvas holds the glove at any press. Pressed, the fingertip sits at (ax, ay); let go, it lifts up and away by
  // (lx, ly), the tutorial's offset, so the hand looks raised over the spot it is about to tap.
  function fit() {
    const u = JT.App.W / 100, h = SIZE * u, dpr = R.dpr, k = h + '|' + dpr;
    if (k === key) return;
    key = k; dirty = true;
    const b = R.handBox(h), lx = 1.6 * u, ly = 2.2 * u;
    box = { h: h, ax: Math.ceil(b.left) + 1, ay: Math.ceil(b.top) + 1, lx: lx, ly: ly };
    box.w = box.ax + Math.ceil(b.right + lx) + 1;
    box.hh = box.ay + Math.ceil(b.bottom + ly) + 1;
    cv.width = Math.round(box.w * dpr); cv.height = Math.round(box.hh * dpr);
    cv.style.width = box.w + 'px'; cv.style.height = box.hh + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function draw() {
    fit();
    if (!dirty) return;
    ctx.clearRect(0, 0, box.w, box.hh);
    dirty = !R.hand(ctx, box.ax + (1 - press) * box.lx, box.ay + (1 - press) * box.ly, box.h, press);   // picture still loading: try again
  }
  function sync() {
    const want = wanted();
    if (want !== shown) { shown = want; cv.classList.toggle('on', want); app.classList.toggle('gloveOn', want); }
    if (!shown) return;
    draw();
    cv.style.transform = 'translate3d(' + (x - box.ax) + 'px,' + (y - box.ay) + 'px,0)';
  }

  // the finger goes down and up in real time, whatever the game speed
  function animate() {
    if (anim) return;
    lastT = performance.now();
    const tick = now => {
      const dt = Math.min(50, now - lastT); lastT = now;
      press = target > press ? Math.min(target, press + dt / DOWN) : Math.max(target, press - dt / UP);
      dirty = true; draw();
      anim = press === target ? 0 : requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
  }

  function onPointer(e) {
    if (e.pointerType !== 'mouse') {
      if (mouse) { mouse = false; target = press = 0; dirty = true; sync(); }
      return;
    }
    mouse = true;
    if (!rect) rect = app.getBoundingClientRect();
    x = e.clientX - rect.left; y = e.clientY - rect.top;
    inside = x >= 0 && y >= 0 && x < rect.width && y < rect.height;
    if (e.button === 0 && e.type === 'pointerdown' && wanted()) {
      target = 1; animate();
      const u = JT.App.W / 100;
      FX.ring(FX.top, x, y, 'rgba(255,255,255,0.95)', 2.5 * u, 8 * u, 420, 1.1 * u);
    } else if (e.button === 0 && e.type === 'pointerup') { target = 0; animate(); }
    sync();
  }

  JT.Cursor = {
    init() {
      app = document.getElementById('app'); cv = document.getElementById('glove'); ctx = cv.getContext('2d');
      // window, capture phase: the glove sees every mouse event before any handler can stop it
      for (const t of ['pointermove', 'pointerdown', 'pointerup']) window.addEventListener(t, onPointer, { capture: true, passive: true });
      window.addEventListener('mouseout', e => { if (!e.relatedTarget) { inside = false; sync(); } });   // left the window
      window.addEventListener('resize', () => { rect = null; });
      // into a level and back out: show or hide without waiting for the mouse to move
      for (const name of ['showGame', 'showHome']) {
        const orig = UI[name];
        UI[name] = function () { const r = orig.apply(UI, arguments); sync(); return r; };
      }
    }
  };
})();
