/* All sound is synthesised: no audio files. When audio starts, a small sample bank is rendered in JavaScript,
   sample by sample (filtered noise, struck resonators, pitch-swept sines, soft saturation), a few variations of
   each sound; play-back then picks one at random and varies its pitch and level, so no two hits are the same.

   The sound is close-up, tactile foley in the "ASMR" manner rather than beeps:
   - a jelly has weight: a low thump, saturated so its harmonics carry that weight on phone speakers that cannot
     play the fundamental, under a wet squish and the short smack of contact, with a little jiggle after;
   - a worm unsticks with a wet, sticky slide that rises, broken by tiny tacky clicks, and pops as it leaves;
   - paint lands in soft pats like rain on paper, foil wrappers crinkle, coins clink, buttons tap like wood;
   - rewards are a kalimba in C major pentatonic (the music's key), in a small warm room;
   - sounds sit where they happen: a worm on the left of the box is heard on the left.
   Mix: every variation is measured when it is made (its loudest 50 ms) and scaled to the level its sound is meant
   to have (TARGET), so the hierarchy holds by construction: celebrations loudest, then the player's own actions,
   then the sounds that repeat many times a second. The music bed ducks under big moments, and a voice budget drops
   the least important sounds when too many pile up. */
(function () {
  'use strict';
  const JT = window.JT;
  let ac = null, master = null, sfxBus = null, verbSend = null, musBus = null, musDuck = null, pluckBus = null;
  let lastPaint = 0, lastCoin = 0, coinStep = 0, musOn = false, step = 0, nextT = 0, timer = 0, touched = false;
  let SR = 48000;
  const recent = [];   // start times of recent voices, for the voice budget
  const cfg = () => JT.Save.data.settings;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------- offline synthesis: each function adds into a Float32Array ----------
  const onePole = hz => 1 - Math.exp(-TAU * hz / SR);
  // an RBJ biquad whose centre can move while it runs
  function biquad() {
    let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return {
      set(type, f, q) {
        const w = TAU * Math.min(f, SR * 0.45) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * q), d0 = 1 + al;
        let n0, n1;
        if (type === 'lp') { n0 = (1 - cs) / 2; n1 = 1 - cs; } else if (type === 'hp') { n0 = (1 + cs) / 2; n1 = -(1 + cs); } else { n0 = al; n1 = 0; }
        b0 = n0 / d0; b1 = n1 / d0; b2 = (type === 'bp' ? -al : n0) / d0; a1 = -2 * cs / d0; a2 = (1 - al) / d0;
      },
      run(x) { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; }
    };
  }
  const white = () => Math.random() * 2 - 1;
  // pink (Paul Kellet's economy filter) and brown noise: softer, heavier textures than white
  function pinkGen() { let b0 = 0, b1 = 0, b2 = 0; return () => { const w = white(); b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; return (b0 + b1 + b2 + w * 0.1848) * 0.2; }; }
  function brownGen() { let y = 0; return () => { y = (y + 0.02 * white()) / 1.02; return y * 3.5; }; }

  // A sine that decays (time constant tau) while its pitch glides from f0 to f1 over `glide` seconds.
  // o.drive saturates it (tanh), o.vib = [rate, depth] wobbles the pitch, o.attack softens the start.
  function sweep(out, at, f0, f1, glide, amp, tau, o) {
    o = o || {};
    const s0 = Math.floor(at * SR), n = Math.min(out.length - s0, Math.floor(tau * 8 * SR));
    if (n <= 0) return;
    const atk = Math.max(1, Math.floor((o.attack || 0.002) * SR)), gN = Math.max(1, Math.floor(glide * SR));
    const gk = Math.pow(f1 / f0, 1 / gN), dec = Math.exp(-1 / (tau * SR)), drive = o.drive || 0, nd = drive ? Math.tanh(drive) : 1;
    let f = f0, ph = 0, env = 1;
    for (let i = 0; i < n; i++) {
      if (i < gN) f *= gk;
      const fi = o.vib ? f * (1 + o.vib[1] * Math.sin(TAU * o.vib[0] * i / SR)) : f;
      ph += TAU * fi / SR; if (ph > TAU) ph -= TAU;
      if (i >= atk) env *= dec;
      let v = Math.sin(ph) * env * (i < atk ? i / atk : 1);
      if (drive) v = Math.tanh(v * drive) / nd;
      out[s0 + i] += v * amp;
    }
  }
  // Filtered noise. o: src 'white'|'pink'|'brown'; type 'bp'|'lp'|'hp'; centre f0 -> f1 (exponential) at q;
  // envelope: attack, then a decay (tau) or, with o.hump = p, a sin^p swell over the whole burst;
  // o.flutter = [rate, depth] breaks it up into sticky, uneven bits; o.wob = [rate, depth] swings the centre.
  function hiss(out, at, dur, amp, o) {
    const s0 = Math.floor(at * SR), n = Math.min(out.length - s0, Math.floor(dur * SR));
    if (n <= 0) return;
    const gen = o.src === 'pink' ? pinkGen() : o.src === 'brown' ? brownGen() : white;
    const bq = biquad(), type = o.type || 'bp', q = o.q || 0.8, f0 = o.f0 || 1000, f1 = o.f1 || f0;
    const atk = Math.max(1, Math.floor((o.attack || 0.002) * SR)), dec = Math.exp(-1 / ((o.tau || dur / 5) * SR));
    const flA = o.flutter ? onePole(o.flutter[0] * 2.5) : 0;
    let env = 1, fl = 1, flTo = 1, flN = 0;
    for (let i = 0; i < n; i++) {
      if ((i & 15) === 0) {
        let f = f0 * Math.pow(f1 / f0, i / n);
        if (o.wob) f *= 1 + o.wob[1] * Math.sin(TAU * o.wob[0] * i / SR);
        bq.set(type, f, q);
      }
      let e;
      if (o.hump) e = Math.pow(Math.sin(Math.PI * i / n), o.hump);
      else { if (i >= atk) env *= dec; e = env; }
      if (i < atk) e *= i / atk;
      if (o.flutter) {
        if (--flN <= 0) { flN = Math.floor(SR / (o.flutter[0] * rnd(0.6, 1.5))); flTo = 1 - o.flutter[1] * Math.random(); }
        fl += flA * (flTo - fl); e *= fl;
      }
      out[s0 + i] += bq.run(gen()) * e * amp;
    }
  }
  // a struck object: decaying partials [ratio, level, decay] over a tiny strike click
  function strike(out, at, f, partials, amp, o) {
    o = o || {};
    for (const p of partials) sweep(out, at, f * p[0], f * p[0], 0, amp * p[1], p[2], { attack: o.attack || 0.0012 });
    if (o.click !== 0) hiss(out, at, 0.006, amp * (o.click || 0.25), { type: 'hp', f0: Math.min(9000, f * 3), q: 0.7, attack: 0.0003, tau: 0.0012 });
  }
  const buf = sec => new Float32Array(Math.max(1, Math.ceil(sec * SR)));

  // ---------- the sounds ----------
  // n: how many variations; make(): one variation. TARGET: how loud each sound plays (dB, loudest 50 ms).
  const DEF = {
    // a button: a soft wooden tap
    tap: { n: 4, make() {
      const o = buf(0.12);
      strike(o, 0, rnd(1250, 1550), [[1, 1, 0.032], [2.32, 0.42, 0.02], [4.25, 0.18, 0.011]], 0.5, { click: 0.5 });
      sweep(o, 0, 230, 150, 0.03, 0.35, 0.022);
      return o;
    } },
    // a worm unsticks and slides out: a wet, sticky slide that rises, little tacky clicks, a pop as it leaves
    pull: { n: 4, make() {
      const d = rnd(0.3, 0.38), o = buf(d + 0.1);
      hiss(o, 0, d, 0.9, { src: 'pink', type: 'bp', f0: rnd(330, 420), f1: rnd(1100, 1450), q: 2.6, hump: 0.8, flutter: [26, 0.6] });
      hiss(o, 0, d * 0.8, 0.45, { src: 'brown', type: 'lp', f0: 380, f1: 620, q: 0.9, hump: 1 });   // the low body of the stretch
      for (let k = 0, m = 3 + (Math.random() * 4 | 0); k < m; k++) hiss(o, rnd(0.02, d * 0.85), 0.006, rnd(0.15, 0.35), { type: 'bp', f0: rnd(2200, 4200), q: 1.4, attack: 0.0004, tau: 0.0018 });
      const pt = d * rnd(0.8, 0.9);
      sweep(o, pt, rnd(280, 340), rnd(850, 1050), 0.018, 0.55, 0.03, { attack: 0.0008 });
      hiss(o, pt, 0.004, 0.3, { type: 'hp', f0: 2500, attack: 0.0003, tau: 0.001 });
      return o;
    } },
    // a jelly drops into the rack: a heavy thump, a wet squish, the smack of contact, a jiggle after
    land: { n: 4, make() {
      const o = buf(0.36);
      sweep(o, 0, rnd(92, 104), rnd(52, 58), 0.11, 0.9, 0.065, { attack: 0.0015, drive: 2.4 });
      hiss(o, 0, 0.16, 0.75, { src: 'brown', type: 'bp', f0: rnd(520, 600), f1: rnd(230, 270), q: 1.6, attack: 0.003, tau: 0.045 });
      hiss(o, 0, 0.02, 0.45, { type: 'bp', f0: rnd(1900, 2500), q: 1.1, attack: 0.0008, tau: 0.007 });
      sweep(o, 0.012, rnd(160, 180), rnd(150, 165), 0.1, 0.18, 0.085, { attack: 0.01, vib: [rnd(15, 19), 0.09] });
      return o;
    } },
    // two jellies of one colour merge: two gloops, a low settle, the gloop closing
    merge: { n: 3, make() {
      const o = buf(0.42);
      hiss(o, 0, 0.14, 0.7, { src: 'brown', type: 'bp', f0: rnd(700, 820), f1: rnd(300, 360), q: 2.2, attack: 0.003, tau: 0.04 });
      hiss(o, rnd(0.06, 0.08), 0.14, 0.7, { src: 'brown', type: 'bp', f0: rnd(560, 640), f1: rnd(250, 290), q: 2.2, attack: 0.003, tau: 0.04 });
      sweep(o, 0.07, 86, 58, 0.09, 0.7, 0.07, { drive: 2 });
      sweep(o, 0.09, rnd(300, 340), rnd(620, 700), 0.05, 0.25, 0.04, { attack: 0.002 });
      return o;
    } },
    // two colours blend: a liquid swirl, band-passed noise whose centre swings
    swirl: { n: 2, make() {
      const d = 0.42, o = buf(d + 0.05);
      hiss(o, 0, d, 0.8, { src: 'pink', type: 'bp', f0: 450, f1: 900, q: 3.2, hump: 0.9, wob: [rnd(8, 11), 0.35] });
      return o;
    } },
    // a drop of paint lands on the picture: a soft pat with a tiny wet plip, like rain on paper
    pat: { n: 6, make() {
      const o = buf(0.09);
      hiss(o, 0, 0.03, 0.8, { type: 'bp', f0: rnd(1500, 2100), q: 1.4, attack: 0.0006, tau: 0.006 });
      sweep(o, 0, rnd(820, 980), rnd(430, 520), 0.025, 0.4, 0.018, { attack: 0.0008 });
      return o;
    } },
    // a jelly empties or a worm pops: a bubble (its pitch jumps up as it closes)
    bubble: { n: 4, make() {
      const o = buf(0.14), f = rnd(330, 420);
      sweep(o, 0, f, f * rnd(2.8, 3.4), 0.02, 0.85, 0.032, { attack: 0.0008 });
      hiss(o, 0, 0.003, 0.3, { type: 'hp', f0: 3000, attack: 0.0002, tau: 0.0008 });
      sweep(o, 0, 150, 120, 0.03, 0.18, 0.03);
      return o;
    } },
    // a worm bumps into a blocker: a dull, rubbery thunk with a faint squeak
    thunk: { n: 4, make() {
      const o = buf(0.26);
      sweep(o, 0, rnd(140, 160), rnd(80, 90), 0.09, 0.95, 0.07, { attack: 0.0015, drive: 2.2 });
      hiss(o, 0, 0.05, 0.35, { src: 'brown', type: 'lp', f0: 650, q: 0.7, attack: 0.001, tau: 0.018 });
      sweep(o, 0.004, rnd(480, 560), rnd(500, 580), 0.05, 0.08, 0.04, { vib: [rnd(30, 40), 0.07] });
      return o;
    } },
    // a foil wrapper comes off: crackles bunched at the start over a soft rustle
    crinkle: { n: 3, make() {
      const d = 0.34, o = buf(d + 0.05);
      hiss(o, 0, d, 0.18, { type: 'bp', f0: 4800, f1: 3800, q: 0.7, hump: 1.2 });
      for (let k = 0, m = 16 + (Math.random() * 8 | 0); k < m; k++) {
        hiss(o, d * Math.pow(Math.random(), 1.6), rnd(0.0008, 0.0025), rnd(0.25, 0.9), { type: 'hp', f0: rnd(2500, 5000), q: 0.7, attack: 0.0002, tau: rnd(0.0004, 0.0012) });
      }
      return o;
    } },
    // a small wooden tick (two make the dizzy worms' tick-tock)
    tick: { n: 4, make() {
      const o = buf(0.06);
      strike(o, 0, rnd(1900, 2200), [[1, 1, 0.014], [2.76, 0.45, 0.008]], 0.7, { click: 0.4 });
      return o;
    } },
    // a coin into the counter: a small metal clink, inharmonic partials
    clink: { n: 3, make() {
      const o = buf(0.22);
      strike(o, 0, rnd(1750, 1850), [[1, 1, 0.09], [2.76, 0.55, 0.06], [5.4, 0.3, 0.035], [8.93, 0.14, 0.02]], 0.55, { click: 0.3 });
      return o;
    } },
    // a kalimba note at C5; every other pitch is this one played faster or slower
    kalimba: { n: 2, make() {
      const o = buf(1.6);
      strike(o, 0, 523.25, [[1, 1, 0.55], [2, 0.05, 0.2], [5.4, 0.16, 0.08], [9, 0.05, 0.03]], 0.6, { click: 0.18, attack: 0.002 });
      return o;
    } },
    // a soft wooden "tok" at C4 for warnings, pitched the same way, with a little thump under it
    tok: { n: 2, make() {
      const o = buf(0.5);
      strike(o, 0, 261.63, [[1, 1, 0.14], [3.9, 0.3, 0.05], [9.2, 0.08, 0.015]], 0.7, { click: 0.2 });
      sweep(o, 0, 120, 90, 0.04, 0.2, 0.04, { drive: 1.5 });
      return o;
    } },
    // a breath: the soft sigh under a lost level
    sigh: { n: 1, make() { const o = buf(0.9); hiss(o, 0, 0.85, 0.5, { src: 'pink', type: 'lp', f0: 900, f1: 500, q: 0.6, hump: 1.3 }); return o; } },
    // airy sparkle over the rewards
    shimmer: { n: 2, make() { const o = buf(0.7); hiss(o, 0, 0.65, 0.35, { type: 'hp', f0: 5500, f1: 7500, q: 0.6, hump: 1.5, flutter: [14, 0.5] }); return o; } },
    // the low drum under "Hard level!"
    drum: { n: 1, make() {
      const o = buf(0.5);
      sweep(o, 0, 78, 48, 0.2, 1, 0.13, { drive: 2.2 });
      hiss(o, 0, 0.06, 0.3, { src: 'brown', type: 'lp', f0: 400, attack: 0.001, tau: 0.03 });
      return o;
    } }
  };
  const TARGET = { tap: -22, pull: -17, land: -14, merge: -15, swirl: -18, pat: -24, bubble: -18, thunk: -14.5, crinkle: -19, tick: -22, clink: -20, kalimba: -17, tok: -18, sigh: -24, shimmer: -27, drum: -15 };

  // loudest 50 ms of a sound, in dB (RMS)
  function loudDb(x) {
    const w = Math.max(1, Math.floor(0.05 * SR)); let acc = 0, best = 0;
    for (let i = 0; i < x.length; i++) { acc += x[i] * x[i]; if (i >= w) acc -= x[i - w] * x[i - w]; if (acc > best) best = acc; }
    return 10 * Math.log10(Math.max(1e-12, best / w));
  }
  const bank = {};
  function render(name) {
    const d = DEF[name], list = [];
    for (let k = 0; k < d.n; k++) {
      const x = d.make();
      let peak = 0; for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
      const fade = Math.min(x.length, Math.floor(0.004 * SR));
      for (let i = 0; i < fade; i++) x[x.length - 1 - i] *= i / fade;            // no click at the end
      const b = ac.createBuffer(1, x.length, SR); b.getChannelData(0).set(x);
      // the level this variation must be played at to sound as loud as its sound should, never above full scale
      b.jtGain = Math.min(Math.pow(10, (TARGET[name] - loudDb(x)) / 20), 0.98 / Math.max(peak, 1e-6));
      list.push(b);
    }
    return list;
  }
  const sounds = name => bank[name] || (bank[name] = render(name));
  // render the rest of the bank a little at a time once audio runs, so no tap waits for it
  function warm() {
    const name = Object.keys(DEF).find(k => !bank[k]);
    if (!name || !ac) return;
    sounds(name); setTimeout(warm, 25);
  }

  // ---------- graph ----------
  // sfx (panned) -> sfxBus ─┬──────────────► master -> glue compressor -> limiter -> out
  //                         └─ verbSend -> room ─┘
  // music -> lowpass/echo -> musBus -> musDuck ─► master
  function ensure() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ac = new AC(); SR = ac.sampleRate;
      master = ac.createGain(); master.gain.value = 1;
      const glue = ac.createDynamicsCompressor();
      glue.threshold.value = -20; glue.knee.value = 12; glue.ratio.value = 2.5; glue.attack.value = 0.01; glue.release.value = 0.25;
      const limit = ac.createDynamicsCompressor();
      limit.threshold.value = -4; limit.knee.value = 0; limit.ratio.value = 20; limit.attack.value = 0.002; limit.release.value = 0.1;
      master.connect(glue); glue.connect(limit); limit.connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
      // a small, warm room: a few early reflections, then 1.3 s of decaying noise, darker as it fades
      const verb = ac.createConvolver(), len = Math.floor(SR * 1.3), ir = ac.createBuffer(2, len, SR);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch); let lp = 0;
        for (let i = 0; i < len; i++) {
          const t = i / SR, k = 0.5 * Math.exp(-t * 3) + 0.04;   // the tail loses its top as it fades
          lp += k * (white() - lp); d[i] = lp * Math.exp(-t * 4.2);
        }
        for (const r of [0.011, 0.019, 0.027, 0.041]) { const i = Math.floor((r + ch * 0.003) * SR); d[i] += rnd(0.3, 0.6) * (Math.random() < 0.5 ? -1 : 1); }
      }
      verb.buffer = ir;
      verbSend = ac.createGain(); verbSend.gain.value = 1;
      const verbOut = ac.createGain(); verbOut.gain.value = 0.5;
      verbSend.connect(verb); verb.connect(verbOut); verbOut.connect(master);
      musDuck = ac.createGain(); musDuck.gain.value = 1; musDuck.connect(master);
      musBus = ac.createGain(); musBus.gain.value = 0; musBus.connect(musDuck);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.3;
      pluckBus = ac.createGain(); pluckBus.connect(lp); lp.connect(musBus);
      const echo = ac.createDelay(1); echo.delayTime.value = 60 / 84 * 0.75;
      const fb = ac.createGain(); fb.gain.value = 0.22;
      const wet = ac.createGain(); wet.gain.value = 0.22;
      lp.connect(echo); echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(musBus);
    } catch (e) { ac = null; return false; }
    setTimeout(warm, 60);
    return true;
  }
  const ok = () => cfg().sfx && ensure() && ac.state === 'running';

  // voice budget: low-priority sounds are skipped while more than `max` voices started in the last 120 ms
  function room(max) {
    const now = ac.currentTime;
    while (recent.length && now - recent[0] > 0.12) recent.shift();
    return recent.length < max;
  }
  const took = n => { for (let i = 0; i < (n || 1); i++) recent.push(ac.currentTime); };
  // a point on the board (x in the game column's pixels) -> a gentle stereo position
  const pan = x => (x === undefined || !JT.App.W ? 0 : Math.max(-1, Math.min(1, (x / JT.App.W) * 2 - 1)) * 0.55);

  // play one variation of a sound. o: gain, rate (pitch), jitter (random pitch, default 4%), pan, verb, delay
  function play(name, o) {
    o = o || {};
    const list = sounds(name), b = list[(Math.random() * list.length) | 0], t = ac.currentTime + (o.delay || 0);
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = b;
    const j = o.jitter === undefined ? 0.04 : o.jitter;
    src.playbackRate.value = (o.rate || 1) * (1 + (Math.random() * 2 - 1) * j);
    g.gain.value = b.jtGain * (o.gain || 1) * (1 + (Math.random() * 2 - 1) * 0.08);
    src.connect(g);
    let node = g;
    if (o.pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = o.pan; g.connect(p); node = p; }
    node.connect(sfxBus);
    if (o.verb) { const s = ac.createGain(); s.gain.value = o.verb; node.connect(s); s.connect(verbSend); }
    src.start(t);
  }
  // a soft sustained tone (the warm chord under the win)
  function tone(f, dur, o) {
    const t = ac.currentTime + (o.delay || 0), osc = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
    osc.type = o.type || 'sine'; osc.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.value = o.lp || 2000;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain, t + (o.attack || 0.1));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(lp); lp.connect(g); g.connect(sfxBus);
    if (o.verb) { const s = ac.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(verbSend); }
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  // ---------- pitch: C major pentatonic, the music's key ----------
  const PENT = [0, 2, 4, 7, 9];
  // playback rate for the n-th pentatonic step above C (n may be negative): the kalimba sample is a C
  const step5 = n => { const o = Math.floor(n / 5), i = ((n % 5) + 5) % 5; return Math.pow(2, o + PENT[i] / 12); };

  // ---------- music: a slow kalimba bed over a soft sine bass ----------
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  const CH = [
    [48, [60, 64, 67, 72, 76]], [45, [57, 60, 64, 69, 72]], [41, [53, 57, 60, 65, 69]], [43, [55, 59, 62, 67, 71]],
    [48, [60, 64, 67, 72, 76]], [40, [52, 55, 59, 64, 67]], [41, [53, 57, 60, 65, 69]], [43, [55, 59, 62, 67, 74]]
  ];
  const ARP = [0, 2, 1, 3, 2, 4, 3, 1];
  const MEL = [[4, -1, -1, 3, -1, -1, 4, -1], [-1, -1, 3, -1, 4, -1, -1, -1], [4, -1, -1, -1, 3, -1, 2, -1], [-1, 3, -1, -1, 4, -1, 2, -1]];
  function mnote(midi, t, gain) {
    const b = sounds('kalimba')[0], src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = b; src.playbackRate.value = hz(midi) / 523.25;
    g.gain.value = b.jtGain * gain;
    src.connect(g); g.connect(pluckBus);
    src.start(t); src.stop(t + 3);
  }
  function bass(f, t, gain) {
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = 'sine'; osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(g); g.connect(musBus);
    osc.start(t); osc.stop(t + 0.95);
  }
  function schedule() {
    if (!musOn || !ac || ac.state !== 'running') return;
    const sd = 60 / 84 / 2;   // eighth notes at 84 bpm: unhurried
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.3) {
      const bar = Math.floor(step / 8) % 8, s = step % 8, ch = CH[bar];
      if (s === 0) bass(hz(ch[0]), nextT, 0.22);
      if (s === 4) bass(hz(ch[0] + 7), nextT, 0.12);
      mnote(ch[1][ARP[s]], nextT, 0.32);
      const m = MEL[bar % 4][s];
      if (m >= 0) mnote(ch[1][m] + 12, nextT, 0.42);
      nextT += sd; step++;
    }
  }
  const MUSIC_LEVEL = 0.16;
  function musicState() {
    const want = cfg().music && ac && ac.state === 'running';
    if (want && !musOn) {
      musOn = true; nextT = ac.currentTime + 0.1;
      musBus.gain.cancelScheduledValues(ac.currentTime);
      musBus.gain.setTargetAtTime(MUSIC_LEVEL, ac.currentTime, 0.8);
      if (!timer) timer = setInterval(schedule, 90);
    } else if (!want && musOn) {
      musOn = false;
      if (ac) { musBus.gain.cancelScheduledValues(ac.currentTime); musBus.gain.setTargetAtTime(0, ac.currentTime, 0.15); }
    }
  }
  // pull the music down under a big moment, then let it back up
  function duck(depth, hold) {
    if (!musDuck) return;
    const t = ac.currentTime, g = musDuck.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.setTargetAtTime(depth, t, 0.04);
    g.setTargetAtTime(1, t + hold, 0.35);
  }

  const A = JT.Audio = {
    // must be called from a user gesture
    unlock() {
      touched = true;
      if (!ensure()) return;
      if (ac.state === 'suspended') ac.resume().then(musicState).catch(() => {});
      else musicState();
    },
    refresh() { if (ac) musicState(); },
    pauseAll(hidden) {
      if (!ac) return;
      if (hidden) { if (ac.state === 'running') ac.suspend(); }
      else if (ac.state === 'suspended') ac.resume().then(musicState).catch(() => {});
    },
    // haptics: the Android app's native vibrator when there is one (crisper ticks, strength by length), else the web's
    buzz(p) {
      if (!touched || !cfg().haptic) return;
      try {
        const nat = window.JTNative;
        if (nat && nat.vibrate) nat.vibrate(String(p));
        else if (navigator.vibrate) navigator.vibrate(p);
      } catch (e) { /* unsupported */ }
    },

    // x (optional, everywhere below): where on the board it happens, in the game column's pixels
    click() { if (!ok() || !room(12)) return; took(); play('tap'); },
    // the main action: a worm unsticks and slides out of the box
    whoosh(x) { if (!ok()) return; took(2); play('pull', { pan: pan(x), verb: 0.06 }); },
    // a jelly empties or a leftover worm pops; k climbs a little with each pop in a row
    pop(k, x) { if (!ok() || !room(10)) return; took(); play('bubble', { rate: 1 + Math.min(k || 0, 10) * 0.06, pan: pan(x), verb: 0.05 }); },
    // a jelly lands on the rack
    land(x) { if (!ok()) return; took(2); play('land', { pan: pan(x), verb: 0.05 }); },
    // one drop reaches the picture (several per second): soft pats that brighten as the ring fills
    paint(frac, x) {
      if (!ok()) return;
      const n = performance.now();
      if (n - lastPaint < 70 || !room(8)) return;
      lastPaint = n; took();
      play('pat', { rate: 0.9 + (frac || 0) * 0.35, pan: pan(x), jitter: 0.08 });
    },
    // a ring of the picture is finished: a kalimba arpeggio and a little air
    ringDone(r) {
      if (!ok()) return; took(5); duck(0.45, 0.7);
      const b = (r || 0) % 3;
      [0, 2, 3, 5].forEach((s, i) => play('kalimba', { rate: step5(b + s), delay: i * 0.075, verb: 0.35, jitter: 0, gain: 0.85 }));
      play('shimmer', { delay: 0.18, verb: 0.4 });
    },
    // two jellies of one colour merge
    merge(x) { if (!ok()) return; took(3); play('merge', { pan: pan(x), verb: 0.08 }); },
    // two primaries blend into a new colour: a swirl, then a soft note
    mix(x) {
      if (!ok()) return; took(4);
      play('swirl', { pan: pan(x), verb: 0.12 });
      play('kalimba', { rate: step5(4), delay: 0.22, gain: 0.5, verb: 0.3, jitter: 0 });
    },
    // a worm bumps into a blocker
    bonk(x) { if (!ok()) return; took(2); play('thunk', { pan: pan(x) }); },
    // the rack is full: two soft wooden notes going down
    full() { if (!ok()) return; took(2); play('tok', { rate: 1.26, jitter: 0 }); play('tok', { rate: 1, delay: 0.14, jitter: 0 }); },
    // a foil wrapper comes off
    unwrap() {
      if (!ok()) return; took(4);
      play('crinkle', { verb: 0.08 });
      play('kalimba', { rate: step5(8), delay: 0.14, gain: 0.45, verb: 0.35, jitter: 0 });
    },
    // dizzy worms turn their heads: tick-tock
    turn() { if (!ok()) return; took(2); play('tick', { rate: 1.12 }); play('tick', { rate: 0.94, delay: 0.075 }); },
    // a coin lands in the counter, climbing while a shower lasts
    coin() {
      if (!ok()) return;
      const n = performance.now();
      if (n - lastCoin < 60 || !room(10)) return;   // coins arrive in bursts at the end of a level
      coinStep = n - lastCoin < 400 ? Math.min(coinStep + 1, 5) : 0;
      lastCoin = n; took();
      play('clink', { rate: 0.85 * step5(coinStep), jitter: 0.02 });
    },
    // a star lands on the win card: C, E, G an octave up
    star(i) { if (!ok()) return; took(2); play('kalimba', { rate: step5([5, 7, 8][i || 0] || 5), verb: 0.4, gain: 1.1, jitter: 0 }); play('shimmer', { gain: 0.6, verb: 0.3 }); },
    // the hint booster points at a worm
    hint() { if (!ok()) return; took(2); play('kalimba', { rate: step5(7), gain: 0.55, verb: 0.3, jitter: 0 }); play('kalimba', { rate: step5(9), delay: 0.09, gain: 0.55, verb: 0.35, jitter: 0 }); },
    // "Hard level!" banner: a low drum and a low wooden note
    banner() { if (!ok()) return; took(2); play('drum', { gain: 0.9 }); play('tok', { rate: 0.75, delay: 0.02, gain: 0.7, verb: 0.2, jitter: 0 }); },
    // the picture is finished: a rising kalimba run over a warm chord, and air
    win() {
      if (!ok()) return; took(8); duck(0.3, 1.8);
      [0, 2, 3, 5, 7].forEach((s, i) => play('kalimba', { rate: step5(s), delay: i * 0.085, verb: 0.4, jitter: 0 }));
      [261.63, 329.63, 392].forEach(f => tone(f, 1.6, { type: 'triangle', gain: 0.035, attack: 0.18, delay: 0.42, lp: 1600, verb: 0.5 }));
      play('shimmer', { delay: 0.35, verb: 0.5 });
    },
    // the level is lost: a gentle falling kalimba and a sigh
    lose() {
      if (!ok()) return; took(4); duck(0.4, 1.3);
      [3, 2, 0, -2].forEach((s, i) => play('kalimba', { rate: step5(s), delay: i * 0.16, gain: 0.7, verb: 0.3, jitter: 0 }));
      play('sigh', { delay: 0.1 });
    }
  };
  // for checking the mix: every sound's loudest 50 ms before and after its level is set (see README)
  A.levels = () => { if (!ensure()) return null; const r = {}; for (const k in DEF) r[k] = sounds(k).map(b => Math.round(10 * (loudDb(b.getChannelData(0)) + 20 * Math.log10(b.jtGain))) / 10); return r; };

  document.addEventListener('visibilitychange', () => A.pauseAll(document.hidden));
})();
