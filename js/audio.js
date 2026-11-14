/* All sound is synthesised with WebAudio: no audio files. SFX, a soft generative music loop, and haptics.

   Mix rules (checked by rendering every sound offline and measuring its loudest 50 ms, see README):
   - a clear hierarchy: celebrations loudest (win, ring done), then the player's own actions (pull, land, merge,
     bump), then the sounds that repeat many times a second (paint ticks, coins, pops) quietest;
   - the music bed sits well under every gameplay sound and ducks under the big moments;
   - every pitched sound is in C major pentatonic, the music's key, so overlapping sounds never clash;
   - wood and bell timbres come from two-operator FM, a short generated reverb glues them, and small random
     variation keeps repeated sounds from sounding like a machine;
   - a voice budget drops the least important sounds when too many pile up (end-of-level coin showers). */
(function () {
  'use strict';
  const JT = window.JT;
  let ac = null, master = null, sfxBus = null, verbSend = null, musBus = null, musDuck = null, pluckBus = null, echo = null, noiseBuf = null;
  let lastPaint = 0, lastCoin = 0, coinStep = 0, musOn = false, step = 0, nextT = 0, timer = 0, touched = false;
  const recent = [];   // start times of recent voices, for the voice budget
  const cfg = () => JT.Save.data.settings;

  // ---------- graph ----------
  // sfx -> sfxBus ─┬─────────────► master -> glue compressor -> limiter -> out
  //                └─ verbSend -> reverb ─┘
  // music -> pluck lowpass/echo -> musBus -> musDuck ─► master
  function ensure() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ac = new AC();
      master = ac.createGain(); master.gain.value = 1;
      const glue = ac.createDynamicsCompressor();
      glue.threshold.value = -20; glue.knee.value = 12; glue.ratio.value = 2.5; glue.attack.value = 0.01; glue.release.value = 0.25;
      const limit = ac.createDynamicsCompressor();
      limit.threshold.value = -4; limit.knee.value = 0; limit.ratio.value = 20; limit.attack.value = 0.002; limit.release.value = 0.1;
      master.connect(glue); glue.connect(limit); limit.connect(ac.destination);

      sfxBus = ac.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
      // a small, dark room: 1 s of decaying noise, low-passed so the tail never hisses
      const verb = ac.createConvolver(), len = Math.floor(ac.sampleRate * 1.1), ir = ac.createBuffer(2, len, ac.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch); let lp = 0;
        for (let i = 0; i < len; i++) { const t = i / ac.sampleRate; lp += 0.22 * ((Math.random() * 2 - 1) - lp); d[i] = lp * Math.exp(-t * 5.2); }
      }
      verb.buffer = ir;
      verbSend = ac.createGain(); verbSend.gain.value = 1;
      const verbOut = ac.createGain(); verbOut.gain.value = 0.55;
      verbSend.connect(verb); verb.connect(verbOut); verbOut.connect(master);

      musDuck = ac.createGain(); musDuck.gain.value = 1; musDuck.connect(master);
      musBus = ac.createGain(); musBus.gain.value = 0; musBus.connect(musDuck);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.3;
      pluckBus = ac.createGain(); pluckBus.connect(lp); lp.connect(musBus);
      echo = ac.createDelay(1); echo.delayTime.value = 0.3125;
      const fb = ac.createGain(); fb.gain.value = 0.18;
      const wet = ac.createGain(); wet.gain.value = 0.2;
      lp.connect(echo); echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(musBus);

      noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.6), ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; return false; }
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
  const vary = (v, amt) => v * (1 + (Math.random() * 2 - 1) * amt);

  // ---------- voices ----------
  function envelope(g, t, peak, attack, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function out(node, verb) {
    node.connect(sfxBus);
    if (verb) { const s = ac.createGain(); s.gain.value = verb; node.connect(s); s.connect(verbSend); }
  }
  // a plain oscillator with an optional pitch glide (to) and wobble (via: [freq, at fraction])
  function tone(f, dur, o) {
    o = o || {};
    const t = ac.currentTime + (o.delay || 0);
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.via) osc.frequency.exponentialRampToValueAtTime(o.via[0], t + dur * o.via[1]);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    envelope(g, t, o.gain || 0.2, o.attack || 0.006, dur);
    osc.connect(g);
    if (o.lp) { const f2 = ac.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.lp; g.connect(f2); out(f2, o.verb); } else out(g, o.verb);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  // two-operator FM: ratio 1 ~ wood/marimba, 3.5 ~ glass bell. The brightness (index) dies away faster than the note.
  function fm(f, dur, o) {
    o = o || {};
    const t = ac.currentTime + (o.delay || 0);
    const car = ac.createOscillator(), mod = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
    car.frequency.value = f; mod.frequency.value = f * (o.ratio || 1);
    const idx = (o.index === undefined ? 1.6 : o.index) * f;
    mg.gain.setValueAtTime(idx, t);
    mg.gain.exponentialRampToValueAtTime(Math.max(1, idx * 0.04), t + dur * (o.bright || 0.45));
    mod.connect(mg); mg.connect(car.frequency);
    envelope(g, t, o.gain || 0.2, o.attack || 0.004, dur);
    car.connect(g); out(g, o.verb);
    car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
  }
  function noise(dur, o) {
    o = o || {};
    const t = ac.currentTime + (o.delay || 0);
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = o.type || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f || 1500, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    envelope(g, t, o.gain || 0.15, o.attack || 0.008, dur);
    src.connect(f); f.connect(g); out(g, o.verb);
    src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.05);
  }

  // ---------- pitch: C major pentatonic, the music's key ----------
  const PENT = [0, 2, 4, 7, 9];
  // n-th step of the pentatonic ladder above C5 (n may be negative)
  const note = n => { const o = Math.floor(n / 5), i = ((n % 5) + 5) % 5; return 523.25 * Math.pow(2, o + PENT[i] / 12); };

  // ---------- music ----------
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  const CH = [
    [48, [60, 64, 67, 72, 76]], [45, [57, 60, 64, 69, 72]], [41, [53, 57, 60, 65, 69]], [43, [55, 59, 62, 67, 71]],
    [48, [60, 64, 67, 72, 76]], [40, [52, 55, 59, 64, 67]], [41, [53, 57, 60, 65, 69]], [43, [55, 59, 62, 67, 74]]
  ];
  const ARP = [0, 2, 1, 3, 2, 4, 3, 1];
  const MEL = [[4, -1, -1, 3, -1, -1, 4, -1], [-1, -1, 3, -1, 4, -1, -1, -1], [4, -1, -1, -1, 3, -1, 2, -1], [-1, 3, -1, -1, 4, -1, 2, -1]];
  function pluck(f, t, gain, dur) {
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = 'triangle'; osc.frequency.value = f;
    envelope(g, t, gain, 0.008, dur);
    osc.connect(g); g.connect(pluckBus);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function bass(f, t, gain) {
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = 'sine'; osc.frequency.value = f;
    envelope(g, t, gain, 0.02, 0.55);
    osc.connect(g); g.connect(musBus);
    osc.start(t); osc.stop(t + 0.6);
  }
  function schedule() {
    if (!musOn || !ac || ac.state !== 'running') return;
    const sd = 60 / 96 / 2;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.3) {
      const bar = Math.floor(step / 8) % 8, s = step % 8, ch = CH[bar];
      if (s === 0) bass(hz(ch[0]), nextT, 0.26);
      if (s === 4) bass(hz(ch[0] + 7), nextT, 0.14);
      pluck(hz(ch[1][ARP[s]]), nextT, 0.065, 0.4);
      const m = MEL[bar % 4][s];
      if (m >= 0) pluck(hz(ch[1][m] + 12), nextT, 0.08, 0.9);
      nextT += sd; step++;
    }
  }
  const MUSIC_LEVEL = 0.15;
  function musicState() {
    const want = cfg().music && ac && ac.state === 'running';
    if (want && !musOn) {
      musOn = true; nextT = ac.currentTime + 0.1;
      musBus.gain.cancelScheduledValues(ac.currentTime);
      musBus.gain.setTargetAtTime(MUSIC_LEVEL, ac.currentTime, 0.6);
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
    buzz(p) { if (touched && cfg().haptic && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* unsupported */ } } },

    // UI button: a small wooden tick
    click() { if (!ok() || !room(12)) return; took(); fm(note(7), 0.07, { gain: 0.36, ratio: 1, index: 0.9 }); },
    // the main action, a worm slides out: a soft swish and a little rising slurp
    whoosh() {
      if (!ok()) return; took(2);
      noise(0.2, { f: 520, to: 2100, q: 1.1, gain: 0.3, attack: 0.03 });
      tone(vary(330, 0.04), 0.16, { gain: 0.3, to: 660, attack: 0.02, lp: 1800 });
    },
    // a jelly empties or a leftover worm pops: a water-drop bloop that climbs the scale with k
    pop(k) {
      if (!ok() || !room(10)) return; took();
      const f = note(Math.min(k || 0, 12) - 2);
      tone(f * 1.6, 0.13, { gain: 0.33, to: f, attack: 0.003 });
    },
    // a jelly lands on the rack: a squishy boing
    land() {
      if (!ok()) return; took(2);
      tone(vary(250, 0.05), 0.2, { gain: 0.34, via: [175, 0.35], to: 215, attack: 0.008 });
      tone(110, 0.09, { gain: 0.25, to: 70, attack: 0.004 });
    },
    // one droplet reaches the picture (several per second): a quiet marimba tick that rises as the ring fills
    paint(frac) {
      if (!ok()) return;
      const n = performance.now();
      if (n - lastPaint < 95 || !room(8)) return;
      lastPaint = n; took();
      fm(note(Math.min(9, Math.floor(frac * 10))), 0.16, { gain: vary(0.16, 0.15), ratio: 1, index: 1.1 });
    },
    // a ring is finished: a bright pentatonic arpeggio with some room
    ringDone(r) {
      if (!ok()) return; took(5); duck(0.45, 0.6);
      const base = (r || 0) % 3;
      [0, 2, 3, 5].forEach((s, i) => fm(note(base + s), 0.5, { gain: 0.14, ratio: 1, index: 1.4, delay: i * 0.07, verb: 0.5 }));
      fm(note(base + 10), 0.7, { gain: 0.045, ratio: 3.5, index: 0.6, delay: 0.3, verb: 0.7 });
    },
    // two same-colour jellies merge: a rising two-note slurp
    merge() {
      if (!ok()) return; took(3);
      fm(note(3), 0.12, { gain: 0.134, ratio: 1, index: 1.2 });
      fm(note(5), 0.2, { gain: 0.134, ratio: 1, index: 1.2, delay: 0.07, verb: 0.3 });
      tone(400, 0.14, { gain: 0.054, to: 800, attack: 0.02 });
    },
    // two primaries blend into a new colour: a bubbly three-note sparkle
    mix() {
      if (!ok()) return; took(4);
      [0, 2, 4].forEach((s, i) => fm(note(s), 0.18, { gain: 0.104, ratio: 1, index: 1.3, delay: i * 0.06, verb: 0.3 }));
      tone(380, 0.22, { gain: 0.056, to: 950, attack: 0.03 });
    },
    // a worm bumps into a blocker: a muted, friendly thud, never harsh
    bonk() {
      if (!ok()) return; took(2);
      tone(vary(180, 0.04), 0.18, { gain: 0.47, to: 92, attack: 0.004 });
      noise(0.06, { f: 260, type: 'lowpass', q: 0.5, gain: 0.17 });
    },
    // the rack is full: a gentle "uh-oh", two falling notes
    full() {
      if (!ok()) return; took(2);
      tone(329.6, 0.14, { type: 'triangle', gain: 0.1, lp: 1600 });
      tone(261.6, 0.22, { type: 'triangle', gain: 0.1, delay: 0.13, lp: 1600 });
    },
    // a foil wrapper pops off: a little paper crinkle and a chime
    unwrap() {
      if (!ok()) return; took(5);
      for (let i = 0; i < 3; i++) noise(0.045, { f: vary(3200, 0.2), q: 2, gain: 0.033, delay: i * 0.045 });
      fm(note(5), 0.3, { gain: 0.066, ratio: 3.5, index: 0.8, delay: 0.12, verb: 0.4 });
      fm(note(8), 0.36, { gain: 0.06, ratio: 3.5, index: 0.8, delay: 0.2, verb: 0.4 });
    },
    // dizzy worms turn their heads: a soft tick-tock
    turn() {
      if (!ok()) return; took(2);
      fm(note(10), 0.06, { gain: 0.092, ratio: 1, index: 0.8 });
      fm(note(7), 0.07, { gain: 0.092, ratio: 1, index: 0.8, delay: 0.08 });
    },
    // a coin lands in the counter: a small glass bell, climbing while a shower lasts
    coin() {
      if (!ok()) return;
      const n = performance.now();
      if (n - lastCoin < 60 || !room(10)) return;   // coins arrive in bursts at the end of a level
      coinStep = n - lastCoin < 400 ? Math.min(coinStep + 1, 8) : 0;
      lastCoin = n; took();
      fm(note(7 + coinStep), 0.16, { gain: 0.19, ratio: 3.5, index: 0.7 });
    },
    // a star lands on the win card
    star(i) { if (!ok()) return; took(2); fm(note(3 + 2 * (i || 0)), 0.45, { gain: 0.3, ratio: 3.5, index: 0.9, verb: 0.5 }); },
    // the hint booster points at a worm
    hint() { if (!ok()) return; took(2); fm(note(7), 0.14, { gain: 0.081, ratio: 3.5, index: 0.7 }); fm(note(9), 0.22, { gain: 0.081, ratio: 3.5, index: 0.7, delay: 0.09, verb: 0.3 }); },
    // "Hard level!" banner: two low, round notes
    banner() { if (!ok()) return; took(2); fm(196, 0.32, { gain: 0.078, ratio: 1, index: 0.9 }); fm(220, 0.42, { gain: 0.078, ratio: 1, index: 0.9, delay: 0.17, verb: 0.3 }); },
    // the picture is finished
    win() {
      if (!ok()) return; took(8); duck(0.3, 1.6);
      [0, 2, 3, 5].forEach((s, i) => fm(note(s), 0.55, { gain: 0.23, ratio: 1, index: 1.4, delay: i * 0.09, verb: 0.5 }));
      [5, 7, 8].forEach(s => tone(note(s), 1.1, { type: 'triangle', gain: 0.058, delay: 0.42, attack: 0.05, verb: 0.6 }));
      fm(note(10), 0.9, { gain: 0.07, ratio: 3.5, index: 0.6, delay: 0.42, verb: 0.7 });
    },
    // the level is lost
    lose() {
      if (!ok()) return; took(4); duck(0.4, 1.2);
      [392, 329.6, 261.6, 196].forEach((f, i) => tone(f, 0.3, { type: 'triangle', gain: 0.16, delay: i * 0.15, lp: 1500 }));
    }
  };

  document.addEventListener('visibilitychange', () => A.pauseAll(document.hidden));
})();
