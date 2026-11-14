/* All sound is synthesised with WebAudio: no audio files. SFX, a soft generative music loop, and haptics. */
(function () {
  'use strict';
  const JT = window.JT;
  let ac = null, master = null, sfxBus = null, musBus = null, pluckBus = null, echo = null, noiseBuf = null;
  let lastPaint = 0, lastCoin = 0, coinStep = 0, musOn = false, step = 0, nextT = 0, timer = 0, touched = false;
  const cfg = () => JT.Save.data.settings;

  function ensure() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.9;
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
      master.connect(comp); comp.connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.gain.value = 0.75; sfxBus.connect(master);
      musBus = ac.createGain(); musBus.gain.value = 0; musBus.connect(master);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.3;
      pluckBus = ac.createGain(); pluckBus.connect(lp); lp.connect(musBus);
      echo = ac.createDelay(1); echo.delayTime.value = 0.3125;
      const fb = ac.createGain(); fb.gain.value = 0.3;
      const wet = ac.createGain(); wet.gain.value = 0.3;
      lp.connect(echo); echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(musBus);
      noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.6), ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; return false; }
    return true;
  }
  const ok = () => cfg().sfx && ensure() && ac.state === 'running';

  function tone(f, dur, o) {
    o = o || {};
    const t = ac.currentTime + (o.delay || 0);
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t + (o.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.dest || sfxBus);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(dur, o) {
    o = o || {};
    const t = ac.currentTime + (o.delay || 0);
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = o.type || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f || 1500, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.15, t + (o.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.05);
  }
  // pentatonic ladder used for the "filling up" run
  const PENTA = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4, 5 / 2, 3, 10 / 3, 4];
  function mallet(f, gain, delay) {
    tone(f, 0.24, { gain: gain, delay: delay });
    tone(f * 2, 0.12, { gain: gain * 0.3, type: 'triangle', delay: delay });
    tone(f * 4, 0.05, { gain: gain * 0.25, delay: delay });
  }

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
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(pluckBus);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function bass(f, t, gain) {
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = 'sine'; osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    osc.connect(g); g.connect(musBus);
    osc.start(t); osc.stop(t + 0.6);
  }
  function schedule() {
    if (!musOn || !ac || ac.state !== 'running') return;
    const sd = 60 / 96 / 2;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.3) {
      const bar = Math.floor(step / 8) % 8, s = step % 8, ch = CH[bar];
      if (s === 0) bass(hz(ch[0]), nextT, 0.3);
      if (s === 4) bass(hz(ch[0] + 7), nextT, 0.16);
      pluck(hz(ch[1][ARP[s]]), nextT, 0.085, 0.4);
      const m = MEL[bar % 4][s];
      if (m >= 0) pluck(hz(ch[1][m] + 12), nextT, 0.11, 0.9);
      nextT += sd; step++;
    }
  }
  function musicState() {
    const want = cfg().music && ac && ac.state === 'running';
    if (want && !musOn) {
      musOn = true; nextT = ac.currentTime + 0.1;
      musBus.gain.cancelScheduledValues(ac.currentTime);
      musBus.gain.setTargetAtTime(0.55, ac.currentTime, 0.6);
      if (!timer) timer = setInterval(schedule, 90);
    } else if (!want && musOn) {
      musOn = false;
      if (ac) { musBus.gain.cancelScheduledValues(ac.currentTime); musBus.gain.setTargetAtTime(0, ac.currentTime, 0.15); }
    }
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

    click() { if (!ok()) return; tone(660, 0.07, { gain: 0.12, to: 880 }); },
    whoosh() { if (!ok()) return; noise(0.24, { f: 500, to: 3200, q: 0.8, gain: 0.2 }); tone(260, 0.2, { type: 'triangle', gain: 0.07, to: 720 }); },
    pop(k) { if (!ok()) return; const f = 520 * Math.pow(1.06, Math.min(k || 0, 14)); tone(f, 0.11, { gain: 0.22, to: f * 0.42 }); noise(0.03, { f: 3000, q: 0.5, gain: 0.05 }); },
    land() { if (!ok()) return; tone(340, 0.13, { gain: 0.26, to: 150 }); tone(700, 0.07, { gain: 0.09, delay: 0.03, to: 980 }); },
    paint(frac) {
      if (!ok()) return;
      const n = performance.now();
      if (n - lastPaint < 42) return;
      lastPaint = n;
      mallet(523.25 * PENTA[Math.min(10, Math.floor(frac * 11))], 0.085, 0);
    },
    ringDone(r) {
      if (!ok()) return;
      const base = 523.25 * Math.pow(2, (r * 2) / 12);
      [1, 5 / 4, 3 / 2, 2].forEach((m, i) => mallet(base * m, 0.15, i * 0.065));
      noise(0.5, { f: 7000, type: 'highpass', gain: 0.035, delay: 0.1 });
    },
    merge() { if (!ok()) return; tone(620, 0.08, { gain: 0.16, to: 930 }); tone(930, 0.14, { gain: 0.14, delay: 0.07, to: 1400 }); },
    mix() { if (!ok()) return; [420, 560, 760].forEach((f, i) => tone(f, 0.14, { gain: 0.13, delay: i * 0.07, to: f * 1.5 })); },
    bonk() { if (!ok()) return; tone(150, 0.22, { gain: 0.45, to: 52 }); noise(0.1, { f: 420, q: 0.8, gain: 0.2 }); },
    full() { if (!ok()) return; tone(330, 0.12, { type: 'triangle', gain: 0.16 }); tone(247, 0.18, { type: 'triangle', gain: 0.16, delay: 0.12 }); },
    unwrap() { if (!ok()) return; for (let i = 0; i < 3; i++) noise(0.05, { f: 5200, type: 'highpass', gain: 0.07, delay: i * 0.05 }); tone(1040, 0.12, { gain: 0.1, delay: 0.12 }); tone(1560, 0.16, { gain: 0.09, delay: 0.19 }); },
    turn() { if (!ok()) return; noise(0.04, { f: 2600, q: 3, gain: 0.07 }); noise(0.04, { f: 3200, q: 3, gain: 0.06, delay: 0.07 }); },
    coin() {
      if (!ok()) return;
      const n = performance.now();
      coinStep = n - lastCoin < 400 ? Math.min(coinStep + 1, 10) : 0;
      lastCoin = n;
      const f = 1250 * Math.pow(1.05, coinStep);
      tone(f, 0.09, { type: 'square', gain: 0.05 }); tone(f * 1.5, 0.16, { gain: 0.1, delay: 0.03 });
    },
    star(i) { if (!ok()) return; mallet(784 * Math.pow(2, (i * 4) / 12), 0.2, 0); noise(0.25, { f: 8000, type: 'highpass', gain: 0.04 }); },
    hint() { if (!ok()) return; tone(988, 0.1, { gain: 0.1 }); tone(1319, 0.16, { gain: 0.1, delay: 0.08 }); },
    banner() { if (!ok()) return; tone(196, 0.35, { type: 'triangle', gain: 0.16 }); tone(233, 0.45, { type: 'triangle', gain: 0.16, delay: 0.18 }); },
    win() {
      if (!ok()) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => mallet(f, 0.2, i * 0.09));
      [1318.5, 1568, 2093].forEach(f => tone(f, 0.9, { gain: 0.08, delay: 0.42, type: 'triangle' }));
      noise(0.9, { f: 7500, type: 'highpass', gain: 0.045, delay: 0.42 });
    },
    lose() { if (!ok()) return; [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, { type: 'triangle', gain: 0.14, delay: i * 0.15 })); }
  };

  document.addEventListener('visibilitychange', () => A.pauseAll(document.hidden));
})();
