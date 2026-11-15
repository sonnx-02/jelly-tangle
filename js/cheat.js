/* Cheat panel, for testing. Tap a level title ("Level N" / "Màn N": the level pill in a level, or the ribbon on the
   home card) five times in a row to open it.
     Level   what the level is made of and its solution, jump to any level, win or lose on the spot, free boosters,
             auto-play with the hint planner (this level, or level after level), no lost stars, worm numbers
     Items   coins and boosters, endless boosters
     System  game speed, FPS meter, progress (unlock, complete, replay the tutorial, reset), device facts
   Switches that change how the game plays survive a restart (Save.data.cheat) and show in a small badge while they
   are on, so a test run is never mistaken for the real game. */
(function () {
  'use strict';
  const JT = window.JT, U = JT.U, C = JT.Core, R = JT.Render, Save = JT.Save, UI = JT.UI, G = JT.Game;
  const T = (k, v) => JT.I18n.t(k, v);
  const $ = id => document.getElementById(id);
  const TAPS = 5, GAP = 600;                 // five taps, each within 0.6 s of the one before
  const SPEEDS = [0.25, 0.5, 1, 2, 4];
  const LAST_LEVEL = 999;
  const Cheat = JT.Cheat = {};
  let tab = 'level', sel = 0, msgTimer = 0, sure = 0;
  const sols = new Map();                    // level index -> solver answer, so stepping through levels stays quick

  const opts = () => Save.data.cheat;
  const inLevel = () => JT.App.state === 'game' && G.status() === 'play';
  const speedLabel = v => (v === 0.25 ? '¼×' : v === 0.5 ? '½×' : v + '×');

  // ---------- opening: five quick taps on a level title ----------
  function tapper(el) {
    let n = 0, last = 0;
    el.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      const now = performance.now();
      n = now - last < GAP ? n + 1 : 1;
      last = now;
      if (n >= TAPS) { n = 0; burst = now; Cheat.open(); }
    });
  }
  // Quick taps often run on past the fifth, and by then the panel is open under the finger. Taps that still come less
  // than GAP apart belong to the burst that opened it: they are swallowed, so they neither close the panel again nor
  // press one of its buttons.
  let burst = 0;                             // performance.now() of the latest tap of that burst (0: none)
  function swallow(e) {
    if (!burst) return;
    if (performance.now() - burst >= GAP) { burst = 0; return; }
    if (!$('modal').contains(e.target)) return;
    if (e.type === 'pointerdown') burst = performance.now();
    e.stopPropagation(); e.preventDefault();
  }

  Cheat.init = function () {
    tapper($('levelPill')); tapper($('hLevel'));
    document.addEventListener('pointerdown', swallow, true);
    document.addEventListener('click', swallow, true);
    const o = opts();
    JT.App.speed = SPEEDS.includes(o.speed) ? o.speed : 1;
    G.cheat.noMiss = !!o.noMiss; G.cheat.ids = !!o.ids;
    // auto-play: "this level" stops at its win; "non-stop" answers the popups between levels by itself
    const after = (name, fn) => { const orig = UI[name]; UI[name] = function () { const r = orig.apply(UI, arguments); fn(); return r; }; };
    const press = (id, ms) => setTimeout(() => { const b = $(id); if (b && b.isConnected && G.cheat.auto === 2) b.click(); }, ms);
    after('win', () => { if (G.cheat.auto === 2) press('mNext', 1800); else if (G.cheat.auto) { G.cheat.auto = 0; Cheat.sync(); } });
    after('fail', () => { if (G.cheat.auto) { G.cheat.auto = 0; Cheat.sync(); } });
    after('intro', () => { if (G.cheat.auto === 2) press('mOk', 1200); });
    after('unlock', () => { if (G.cheat.auto === 2) press('mOk', 1200); });
    Cheat.sync();
  };

  // the badge: which cheats are on right now
  Cheat.sync = function () {
    const o = opts(), tags = [];
    if (JT.App.speed !== 1) tags.push(speedLabel(JT.App.speed));
    if (G.cheat.auto) tags.push('AUTO');
    if (o.noMiss) tags.push('★');
    if (o.infinite) tags.push('∞');
    if (o.ids) tags.push('#');
    const b = $('cheatBadge');
    b.classList.toggle('hidden', !tags.length);
    b.textContent = 'CHEAT · ' + tags.join(' · ');
  };

  // ---------- the panel ----------
  Cheat.open = function () {
    sel = JT.App.state === 'game' ? JT.App.cur : Save.data.level;
    sure = 0;
    const tabs = [['level', 'ch_tabLevel'], ['bag', 'ch_tabBag'], ['sys', 'ch_tabSys']];
    const card = UI.modal(
      '<div class="ribbon dark">' + T('ch_title') + '</div><button class="close" id="mClose" aria-label="Close">' + UI.ICON.close + '</button>' +
      '<div class="seg chTabs">' + tabs.map(t => '<button data-tab="' + t[0] + '"' + (t[0] === tab ? ' class="on"' : '') + '>' + T(t[1]) + '</button>').join('') + '</div>' +
      '<div class="chBody" id="chBody"></div><div class="chMsg" id="chMsg"></div>', 'cheat', close);
    card.querySelector('#mClose').addEventListener('click', close);
    card.querySelectorAll('.chTabs button').forEach(b => b.addEventListener('click', () => {
      tab = b.dataset.tab; sure = 0;
      card.querySelectorAll('.chTabs button').forEach(x => x.classList.toggle('on', x === b));
      render(); $('chBody').scrollTop = 0;
    }));
    $('chBody').addEventListener('click', onClick);
    render();
    JT.Audio.unwrap();
  };
  function close() { UI.closeModal(); Cheat.sync(); }

  function render() {
    const body = $('chBody');
    if (!body) return;
    body.innerHTML = tab === 'level' ? levelTab() : tab === 'bag' ? bagTab() : sysTab();
    const cv = body.querySelector('.chPic');
    if (cv) { const pic = C.picInfo(cv.dataset.k), ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height); R.picture(ctx, pic, 0, 0, cv.width / pic.w, true); }
  }
  function say(text) {
    const m = $('chMsg');
    if (!m) return;
    m.textContent = text; m.classList.add('show');
    clearTimeout(msgTimer); msgTimer = setTimeout(() => m.classList.remove('show'), 2400);
  }

  const sw = (k, on, label) => '<div class="setRow"><span class="lbl">' + label + '</span><button class="switch' + (on ? ' on' : '') + '" data-sw="' + k + '" role="switch" aria-checked="' + !!on + '" aria-label="' + label + '"></button></div>';
  const seg = (k, list, cur, label) => '<div class="seg" data-seg="' + k + '">' + list.map(v => '<button data-v="' + v + '"' + (v === cur ? ' class="on"' : '') + '>' + label(v) + '</button>').join('') + '</div>';
  const chip = (cls, act, label, data, off) => '<button class="chip ' + cls + '" data-act="' + act + '"' + (data || '') + (off ? ' disabled' : '') + '>' + label + '</button>';
  const head = k => '<div class="chH">' + T(k) + '</div>';

  // ---------- tab: level ----------
  function levelInfo(i) {
    const lc = C.levelCfg(i), pic = C.picInfo(lc.pic), band = T('ch_band_' + lc.band);
    const title = '<b>' + T('level') + ' ' + (i + 1) + ' · ' + JT.I18n.picName(pic) + '</b>';
    const tags = list => (list.length ? '<span class="chTags">' + list.map(t => '<i>' + t + '</i>').join('') + '</span>' : '');
    const box = html => '<div class="chInfo"><canvas class="chPic" width="96" height="96" data-k="' + lc.pic + '"></canvas><div>' + html + '</div></div>';
    if (i >= JT.Levels.count()) {
      // past the ready-made list a level is generated when it is played: show its recipe, do not build it here
      return box(title + '<span>' + T('ch_box', { c: lc.cols, r: lc.rows }) + ' · ' + T('ch_slots', { n: lc.slots }) + '</span>' +
        '<span>' + band + ' · ' + T('ch_generated') + '</span>' + tags(C.mechanicsOf(lc).map(m => T('mech_' + m))));
    }
    const L = JT.Levels.get(i), count = f => L.hoses.filter(f).length, mech = [];
    if (count(h => h.coveredBy.length)) mech.push(T('mech_cross') + ' ×' + count(h => h.coveredBy.length));
    if (count(h => h.mystery)) mech.push(T('mech_mystery') + ' ×' + count(h => h.mystery));
    if (count(h => h.rot)) mech.push(T('mech_rotate') + ' ×' + count(h => h.rot));
    if (L.mix) mech.push(T('mech_mix'));
    if (!sols.has(i)) sols.set(i, C.solve(L, 60000));
    const sol = sols.get(i), colours = new Set(L.hoses.map(h => h.color)).size;
    return box(title +
      '<span>' + [T('ch_box', { c: L.cols, r: L.rows }), T('ch_slots', { n: L.slots }), T('ch_worms', { n: L.hoses.length }), T('ch_colors', { n: colours })].join(' · ') + '</span>' +
      '<span>' + [band, T('ch_fail', { p: Math.round(L.meta.failRate * 100) }), T(lc.designed ? 'ch_designed' : 'ch_baked')].join(' · ') + '</span>' +
      tags(mech)) +
      '<div class="chSol"><b>' + T('ch_solution') + '</b> ' + (sol ? sol.join(' · ') : T('ch_noSolve')) + '</div>';
  }
  function levelTab() {
    const o = opts(), off = !inLevel(), pic = C.picInfo(C.levelCfg(sel).pic);
    const step = d => '<button class="chip" data-act="step" data-d="' + d + '">' + (d > 0 ? '+' + d : '−' + -d) + '</button>';
    const free = k => T(k) + '<small>' + T('ch_free') + '</small>';
    return levelInfo(sel) +
      head('ch_goTo') +
      '<div class="chStep">' + step(-10) + step(-1) + '<div class="val"><b>' + (sel + 1) + '</b><small>' + JT.I18n.picName(pic) + '</small></div>' + step(1) + step(10) + '</div>' +
      '<button class="btn sm" data-act="go">' + T('ch_play', { n: sel + 1 }) + '</button>' +
      head('ch_inLevel') +
      (off ? '<p class="chNote">' + T('ch_needLevel') + '</p>' : '') +
      '<div class="chGrid">' +
        chip('gold', 'win', T('ch_win') + '<small>★★★</small>', ' data-n="3"', off) +
        chip('gold', 'win', T('ch_win') + '<small>★★</small>', ' data-n="2"', off) +
        chip('gold', 'win', T('ch_win') + '<small>★</small>', ' data-n="1"', off) +
        chip('red', 'lose', T('ch_loseRack'), ' data-r="rack"', off) +
        chip('red', 'lose', T('ch_loseStuck'), ' data-r="stuck"', off) +
        chip('blue', 'restart', T('ch_restart'), '', off) +
        chip('', 'hint', free('ch_hint'), '', off) +
        chip('', 'pick', free('ch_pick'), '', off) +
        chip('', 'slot', free('ch_slot'), '', off) +
      '</div>' +
      '<div class="setRow col"><span class="lbl">' + T('ch_auto') + '</span>' + seg('auto', [0, 1, 2], G.cheat.auto, v => T(['ch_off', 'ch_autoOne', 'ch_autoAll'][v])) + '</div>' +
      sw('noMiss', o.noMiss, T('ch_noMiss')) + sw('ids', o.ids, T('ch_ids'));
  }

  // ---------- tab: items ----------
  function bagTab() {
    const d = Save.data, o = opts();
    const coin = (n, label, cls) => chip(cls || 'gold', 'coins', label, ' data-n="' + n + '"');
    const row = k => '<div class="chRow"><span class="chBi" data-b="' + k + '">' + UI.ICON[k] + '</span>' +
      '<span class="nm">' + T(k) + (d.unlocked[k] ? '' : '<small>' + T('lockedAt', { n: JT.BOOST[k].unlock + 1 }) + '</small>') + '</span>' +
      '<b class="cnt">' + d.boosters[k] + '</b>' +
      [-1, 1, 10].map(n => chip('', 'boost', n > 0 ? '+' + n : '−1', ' data-k="' + k + '" data-d="' + n + '"')).join('') + '</div>';
    return head('ch_coins') +
      '<div class="chCoins"><i class="coinIco"></i><b>' + d.coins + '</b></div>' +
      '<div class="chGrid four">' + coin(100, '+100') + coin(1000, '+1000') + coin(10000, '+10k') + coin(0, '= 0', 'red') + '</div>' +
      head('ch_boosters') +
      Object.keys(JT.BOOST).map(row).join('') +
      chip('green wide', 'unlockAll', T('ch_unlockAll')) +
      sw('infinite', o.infinite, T('ch_infinite'));
  }

  // ---------- tab: system ----------
  function sysTab() {
    const A = JT.App, apk = /JellyTangleApp\/([\w.]+)/.exec(navigator.userAgent);
    return head('ch_speed') +
      seg('speed', SPEEDS, A.speed, speedLabel) +
      sw('fps', Save.data.settings.fps, T('showFps')) +
      head('ch_progress') +
      '<div class="chGrid two">' + chip('', 'openAll', T('ch_openAll')) + chip('', 'fillAlbum', T('ch_fillAlbum')) +
        chip('', 'replayTut', T('ch_replayTut')) + chip('red', 'resetAll', T('ch_resetAll')) + '</div>' +
      head('ch_device') +
      '<div class="chInfo text"><div><span>' + (apk ? 'Android APK ' + apk[1] : 'Web') + ' · ' + T('ch_levels', { n: JT.Levels.count() }) + '</span>' +
      '<span>' + Math.round(A.W) + '×' + Math.round(A.H) + ' px · DPR ' + Math.round(R.dpr * 100) / 100 + (A.pace.hz ? ' · ' + A.pace.hz + ' Hz · ' + A.pace.fps + ' fps' : '') + '</span></div></div>';
  }

  // ---------- actions ----------
  function onClick(e) {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.sw) toggle(b.dataset.sw);
    else if (b.parentNode.dataset.seg) choose(b.parentNode.dataset.seg, +b.dataset.v);
    else if (b.dataset.act) act(b.dataset.act, b);
  }
  function toggle(k) {
    const o = opts(), d = Save.data;
    if (k === 'fps') { d.settings.fps = !d.settings.fps; JT.App.showFps(d.settings.fps); }
    else if (k === 'infinite') {
      o.infinite = !o.infinite;
      // every booster on hand, so a tap uses it instead of opening the shop
      if (o.infinite) { for (const b in JT.BOOST) { d.unlocked[b] = true; d.boosters[b] = Math.max(1, d.boosters[b]); } UI.setBoosters(); }
    } else { o[k] = !o[k]; G.cheat[k] = o[k]; }
    Save.save(); Cheat.sync(); render();
  }
  function choose(k, v) {
    if (k === 'speed') { opts().speed = v; JT.App.speed = v; Save.save(); }
    else if (k === 'auto') {
      G.cheat.auto = v;
      if (v && inLevel()) { close(); return; }   // start right away: the level runs again once the panel is gone
    }
    Cheat.sync(); render();
  }
  function act(a, b) {
    const d = Save.data;
    switch (a) {
      case 'step': sel = U.clamp(sel + +b.dataset.d, 0, LAST_LEVEL - 1); render(); break;
      case 'go':
        if (sel > d.level) { d.level = sel; Save.save(); }   // jumping ahead unlocks up to there, so a win moves on as usual
        JT.App.startLevel(sel);
        break;
      case 'win': close(); G.cheatWin(+b.dataset.n); break;
      case 'lose': close(); G.cheatLose(b.dataset.r); break;
      case 'restart': JT.App.startLevel(JT.App.cur); break;
      case 'hint': close(); G.useHint(); break;
      case 'pick':
        // one free use: the tap that lifts a worm spends one, so add one first (endless boosters spend nothing)
        if (!opts().infinite) { d.boosters.pick++; Save.save(); UI.setBoosters(); }
        close(); G.setPick(true);
        break;
      case 'slot':
        if (!G.canAddSlot()) { say(T('slotMax')); break; }
        close(); G.addSlot();
        break;
      case 'coins':
        if (+b.dataset.n) JT.App.addCoins(+b.dataset.n);
        else { d.coins = 0; Save.save(); UI.setCoins(0); }
        render(); say(T('ch_msgCoins', { n: d.coins }));
        break;
      case 'boost': {
        const k = b.dataset.k, n = +b.dataset.d;
        d.boosters[k] = Math.max(0, d.boosters[k] + n);
        if (n > 0) d.unlocked[k] = true;
        Save.save(); UI.setBoosters(); render();
        break;
      }
      case 'unlockAll':
        for (const k in JT.BOOST) { d.unlocked[k] = true; d.boosters[k] += 10; }
        Save.save(); UI.setBoosters(); render(); say(T('ch_msgBoost'));
        break;
      case 'openAll':
        d.level = Math.max(d.level, JT.Levels.count() - 1); Save.save(); refreshHome();
        say(T('ch_msgOpen', { n: d.level + 1 }));
        break;
      case 'fillAlbum':
        C.ALBUM_ORDER.forEach((k, i) => { if (!d.album.includes(k)) d.album.push(k); d.stars[i] = 3; });
        d.level = Math.max(d.level, C.ALBUM_ORDER.length); Save.save(); refreshHome();
        say(T('ch_msgAlbum'));
        break;
      case 'replayTut':
        d.tips = {}; d.seenIntro = []; Save.save();
        say(T('ch_msgTut'));
        break;
      case 'resetAll':
        // two taps: the first one only asks
        if (!sure || performance.now() - sure > 3000) { sure = performance.now(); b.textContent = T('ch_sure'); break; }
        sure = 0; G.cheat.auto = 0;
        Save.reset(); JT.Levels.clear(); UI.setBoosters(); UI.setCoins(Save.data.coins);
        if (JT.App.state === 'game') JT.App.goHome(); else { close(); refreshHome(); }
        Cheat.sync();
        break;
    }
  }
  // the home card and its backdrop follow the next level
  function refreshHome() { if (JT.App.state === 'home') { UI.updateHome(); JT.App.resize(); } }
})();
