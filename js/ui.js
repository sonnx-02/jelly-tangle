/* DOM layer: home screen, HUD, toasts and every popup. The canvas owns the playfield; this owns the chrome. */
(function () {
  'use strict';
  const JT = window.JT, U = JT.U, C = JT.Core, R = JT.Render, A = JT.Audio, Save = JT.Save;
  const T = (k, v) => JT.I18n.t(k, v);
  const $ = id => document.getElementById(id);
  const UI = JT.UI = {};
  const INK = '#3e2a25';

  // One icon family: rounded line drawings in the ink colour, with a little fill where the thing has a colour of its
  // own (the bulb is honey, the tweezers rose). All drawn here from basic shapes.
  const svg = (body, attrs) => '<svg viewBox="0 0 24 24" ' + (attrs || '') + '>' + body + '</svg>';
  const teeth = Array.from({ length: 8 }, (_, k) => '<rect x="10.3" y="1.7" width="3.4" height="4.6" rx="1.3" transform="rotate(' + k * 45 + ' 12 12)"/>').join('');
  const tweezer = 'M12 4.4C7.6 6.8 6.4 11.6 7.8 19M12 4.4c4.4 2.4 5.6 7.2 4.2 14.6';
  const ICON = {
    gear: svg('<g fill="currentColor">' + teeth + '</g><circle cx="12" cy="12" r="6.3" fill="none" stroke="currentColor" stroke-width="3.1"/>'),
    pause: svg('<path d="M9 6.4v11.2M15 6.4v11.2"/>', 'fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"'),
    close: svg('<path d="M7 7l10 10M17 7 7 17"/>', 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"'),
    left: svg('<path d="M14.5 5.5 8 12l6.5 6.5"/>', 'fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"'),
    right: svg('<path d="M9.5 5.5 16 12l-6.5 6.5"/>', 'fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"'),
    lock: svg('<path d="M8 10.6V8.3a4 4 0 0 1 8 0v2.3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="5.2" y="10.2" width="13.6" height="10.2" rx="3" fill="currentColor"/>'),
    star: svg('<path d="M12 2.2l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17l-5.8 3.1 1.1-6.5L2.6 9l6.5-.9z" fill="#f4c457" stroke="#c99227" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.7 9.6l2-.4.9-1.9" fill="none" stroke="#fff3c8" stroke-width="1.3" stroke-linecap="round"/>'),
    hint: svg('<path d="M12 2.8a6.5 6.5 0 0 0-3.9 11.7c.6.5.9 1.1.9 1.8v.9h6v-.9c0-.7.3-1.3.9-1.8A6.5 6.5 0 0 0 12 2.8z" fill="#ffe7a1" stroke="' + INK + '" stroke-width="1.6" stroke-linejoin="round"/><path d="M9.6 19.6h4.8M10.6 21.7h2.8" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/><path d="M9.3 8.3a3.3 3.3 0 0 1 2.5-1.9" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>'),
    pick: svg('<g fill="none" stroke-linecap="round"><path d="' + tweezer + '" stroke="' + INK + '" stroke-width="4.6"/><path d="' + tweezer + '" stroke="#ef9a9c" stroke-width="2.4"/></g><circle cx="12" cy="4.4" r="2.5" fill="#fff" stroke="' + INK + '" stroke-width="1.5"/>'),
    slot: svg('<rect x="2" y="7" width="20" height="10" rx="5" fill="#fff" stroke="' + INK + '" stroke-width="1.6"/><circle cx="7.4" cy="12" r="2.6" fill="#f09c9e"/><circle cx="16.4" cy="12" r="3.2" fill="#79aa89"/><path d="M16.4 10.3v3.4M14.7 12h3.4" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>'),
    album: svg('<rect x="5.8" y="3" width="15" height="13" rx="2.6" fill="#f8d6d4" stroke="' + INK + '" stroke-width="1.5" transform="rotate(8 13.3 9.5)"/><rect x="3" y="6.6" width="15" height="13.4" rx="2.6" fill="#fff" stroke="' + INK + '" stroke-width="1.6"/><path d="M5.6 17.4l3.5-3.9 2.6 2.6 1.8-1.8 2.3 3.1" fill="none" stroke="#79aa89" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="13.8" cy="10.2" r="1.5" fill="#f0bd52"/>'),
    sound: svg('<path d="M4 9.4h3.4L12 5.6v12.8l-4.6-3.8H4z" fill="currentColor"/><path d="M15.6 9a4.2 4.2 0 0 1 0 6M18.4 6.4a8 8 0 0 1 0 11.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
    music: svg('<path d="M9.2 17.4V6l9.6-2.2v11.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="6.8" cy="17.4" rx="2.8" ry="2.3" fill="currentColor"/><ellipse cx="16.4" cy="15.2" rx="2.8" ry="2.3" fill="currentColor"/>'),
    haptic: svg('<rect x="7.6" y="3" width="8.8" height="18" rx="2.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.6 9v6M20.4 9v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
    fps: svg('<path d="M4.4 17.4a8.4 8.4 0 1 1 15.2 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 14.4l4-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="14.6" r="1.8" fill="currentColor"/>'),
    lang: svg('<circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.8 12h16.4M12 3.6c-4.8 5.4-4.8 11.4 0 16.8M12 3.6c4.8 5.4 4.8 11.4 0 16.8" fill="none" stroke="currentColor" stroke-width="1.7"/>'),
    symbols: svg('<circle cx="7" cy="7.4" r="3.8"/><path d="M17 3.4l4.2 7.4h-8.4z"/><rect x="3.4" y="13.8" width="7.2" height="7.2" rx="1.4"/><path d="M17 13.2l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z"/>', 'fill="currentColor"'),
    clock: svg('<circle cx="12" cy="13" r="7.8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9.2v4l2.7 1.7M9.8 2.8h4.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
    trophy: svg('<path d="M7.6 3.8h8.8v4.8a4.4 4.4 0 0 1-8.8 0z" fill="currentColor"/><path d="M7.6 5.6H4.8a2.9 2.9 0 0 0 3.3 3.6M16.4 5.6h2.8a2.9 2.9 0 0 1-3.3 3.6M12 13.2v3.6M8.8 20.2h6.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>')
  };
  UI.ICON = ICON;
  // the boosters' pale porcelain tints (also used for their big icons in the unlock and shop popups)
  const BCOL = { hint: '--a:#fff6df;--b:#fbe3ab', pick: '--a:#fff0f0;--b:#f8cfd3', slot: '--a:#eef5fc;--b:#cfe1f4' };

  // ---------- init ----------
  UI.init = function () {
    $('hSettings').innerHTML = ICON.gear; $('btnPause').innerHTML = ICON.pause;
    document.querySelector('#hAlbum .nico').innerHTML = ICON.album;
    document.querySelectorAll('.booster').forEach(b => {
      b.querySelector('.bico').innerHTML = ICON[b.dataset.b];
      b.addEventListener('click', () => onBooster(b.dataset.b));
    });
    $('hPlay').addEventListener('click', () => JT.App.startLevel(Save.data.level));
    $('hAlbum').addEventListener('click', () => UI.album());
    $('hSettings').addEventListener('click', () => UI.settings(false));
    $('btnPause').addEventListener('click', () => UI.settings(true));
    $('modal').addEventListener('click', e => { if (e.target === $('modal') && modalDismiss) modalDismiss(); });
    document.addEventListener('click', e => { if (e.target.closest && e.target.closest('button')) A.click(); }, true);
    UI.refreshTexts();
  };
  UI.refreshTexts = function () {
    document.documentElement.lang = JT.I18n.lang();
    $('hPlay').textContent = T('play');
    $('hAlbumTxt').textContent = T('album');
    $('hTag').textContent = T('tagline');
  };

  // ---------- screens ----------
  UI.showHome = function () { $('home').classList.remove('hidden'); $('hud').classList.add('hidden'); UI.toast(''); UI.updateHome(); };
  UI.showGame = function () { $('home').classList.add('hidden'); $('hud').classList.remove('hidden'); UI.toast(''); };
  UI.updateHome = function () {
    const d = Save.data, cfg = C.levelCfg(d.level), pic = C.picInfo(cfg.pic);
    UI.setCoins(d.coins);
    $('hStars').textContent = Save.totalStars();
    const rb = $('hLevel'), tag = bandTag(cfg.band);
    rb.textContent = T('level') + ' ' + (d.level + 1) + (tag ? ' · ' + tag : '');
    rb.className = 'ribbon' + (tag ? ' red' : '');
    $('hPicName').textContent = JT.I18n.picName(pic);
    // which collection page the picture belongs to, and how far along that page is: the goal behind the level
    const pg = C.ALBUM.find(p => p.pics.includes(cfg.pic));
    $('hPage').textContent = pg ? (JT.I18n.lang() === 'en' ? pg.en : pg.name) + ' · ' + pg.pics.filter(k => d.album.includes(k)).length + '/' + pg.pics.length : '';
    $('hAlbumN').textContent = d.album.length + '/' + C.ALBUM_ORDER.length;
    drawPic($('hPic'), pic, 'ghost');   // show the picture you are about to make, faded, not a grid of dots
  };
  function drawPic(cv, pic, painted) {
    const ctx = cv.getContext('2d'), s = cv.width / pic.w;
    ctx.clearRect(0, 0, cv.width, cv.height);
    R.picture(ctx, pic, 0, 0, s, painted);
  }
  // hard and super hard levels get a red tag ('KHÓ' / 'SIÊU KHÓ'); the others none
  const bandTag = band => (band === 'super' ? T('superTag') : band === 'hard' ? T('hardTag') : '');
  UI.setLevel = function (idx, L) {
    $('lvlText').textContent = T('level') + ' ' + (idx + 1);
    $('lvlName').textContent = JT.I18n.picName(L.pic);
    $('levelPill').classList.toggle('hard', !!bandTag(L.meta.band));
  };
  UI.setCoins = function (n) { document.querySelectorAll('.coinVal').forEach(e => { e.textContent = n; }); };
  function coinIcon() { return document.querySelector((JT.App.state === 'game' ? '#hud' : '#home') + ' .coinPill .coinIco'); }
  UI.coinTarget = function () {
    const a = $('app').getBoundingClientRect(), r = coinIcon().getBoundingClientRect();
    return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2, r: r.width * 0.42 };
  };
  UI.coinBump = function () {
    const c = coinIcon(); c.classList.remove('bump'); void c.getBoundingClientRect(); c.classList.add('bump');
  };
  UI.playTop = function () { const a = $('app').getBoundingClientRect(), r = $('topbar').getBoundingClientRect(); return r.height ? r.bottom - a.top : JT.App.H * 0.08; };
  UI.playBottom = function () { const a = $('app').getBoundingClientRect(), r = $('bottombar').getBoundingClientRect(); return r.height ? r.top - a.top : JT.App.H * 0.88; };

  // ---------- boosters ----------
  const anyUnlocked = () => Object.keys(JT.BOOST).some(k => Save.data.unlocked[k]);
  UI.setBoosters = function () {
    const d = Save.data;
    document.querySelector('.boosters').style.visibility = anyUnlocked() ? 'visible' : 'hidden';
    document.querySelectorAll('.booster').forEach(b => {
      const k = b.dataset.b, locked = !d.unlocked[k], n = d.boosters[k], cnt = b.querySelector('.bcount');
      b.classList.toggle('locked', locked);
      b.setAttribute('aria-label', T(k));
      if (locked) b.querySelector('.block').innerHTML = ICON.lock + '<span>' + T('lockedAt', { n: JT.BOOST[k].unlock + 1 }) + '</span>';
      cnt.textContent = n > 0 ? n : '+';
      cnt.classList.toggle('plus', n <= 0);
    });
  };
  UI.setPick = function (on) { document.querySelector('.booster[data-b="pick"]').classList.toggle('on', on); };
  UI.freshBooster = function (k) {
    const b = document.querySelector('.booster[data-b="' + k + '"]');
    b.classList.remove('fresh'); void b.getBoundingClientRect(); b.classList.add('fresh');
  };
  function onBooster(k) {
    const d = Save.data, G = JT.Game;
    if (!d.unlocked[k] || G.status() !== 'play' || G.paused) return;
    if (k === 'pick' && G.pickMode()) { G.setPick(false); return; }
    if (d.boosters[k] <= 0) { UI.buy(k); return; }
    if (k === 'hint') { if (G.useHint()) JT.App.spendBooster('hint'); }
    else if (k === 'pick') G.setPick(true);
    else if (!G.canAddSlot()) UI.toast(T('slotMax'), 2400);
    else { G.addSlot(); JT.App.spendBooster('slot'); }
  }

  // ---------- toast + banner ----------
  let toastTimer = 0;
  UI.toast = function (html, ms) {
    const t = $('toast');
    clearTimeout(toastTimer);
    if (!html) { t.classList.remove('show'); return; }
    t.innerHTML = html;
    t.classList.toggle('low', !anyUnlocked());
    t.classList.add('show');
    if (ms) toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  };
  UI.banner = function (text) {
    const b = $('banner');
    $('bannerText').textContent = text;
    b.classList.remove('go'); void b.getBoundingClientRect(); b.classList.add('go');
    A.banner();
  };
  UI.curtain = function (mid) {
    const c = $('curtain');
    c.classList.add('shut');
    setTimeout(() => { mid(); setTimeout(() => c.classList.remove('shut'), 140); }, 400);
  };

  // ---------- popups ----------
  let modalDismiss = null;
  UI.modal = function (html, cls, dismiss) {
    const m = $('modal'), card = $('card');
    card.className = 'card' + (cls ? ' ' + cls : '');
    card.innerHTML = html;
    modalDismiss = dismiss || null;
    m.classList.add('open');
    JT.Game.paused = true;
    return card;
  };
  UI.closeModal = function () { $('modal').classList.remove('open'); modalDismiss = null; JT.Game.paused = false; };
  UI.modalOpen = () => $('modal').classList.contains('open');
  // close the open popup the way its close button would; popups that must be answered (win, fail, intro) stay
  UI.dismiss = function () { if (modalDismiss) modalDismiss(); };
  const on = (card, sel, fn) => { const e = card.querySelector(sel); if (e) e.addEventListener('click', fn); };
  const price = n => '<span class="price"><i></i>' + n + '</span>';

  // 83000 ms -> "1:23"
  const clockTxt = ms => { const s = Math.max(1, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  // the level's time, and the personal best it is measured against: a quiet score for players who race themselves
  function winStats(d) {
    if (!d.time) return '';
    const best = d.newBest ? '<span class="newBest">' + ICON.trophy + T('newBest') + '</span>'
      : d.best ? '<span>' + ICON.trophy + T('best') + ' <b>' + clockTxt(d.best) + '</b></span>' : '';
    return '<div class="winStats"><span>' + ICON.clock + '<b>' + clockTxt(d.time) + '</b></span>' + best + '</div>';
  }
  UI.win = function (d) {
    const card = UI.modal(
      '<div class="ribbon green">' + T('winTitle') + '</div>' +
      '<div class="winStage"><div class="rays"></div><canvas id="mPic" width="288" height="288"></canvas></div>' +
      '<div class="title2">' + JT.I18n.picName(d.pic) + '</div>' +
      '<div class="stars">' + ICON.star + ICON.star + ICON.star + '</div>' + winStats(d) +
      '<div class="rewardRow"><i class="coinIco"></i><b>+' + d.coins + '</b></div>' +
      '<div class="albumRow"><span>' + (JT.I18n.lang() === 'en' ? d.page.en : d.page.name) + '</span><div class="bar"><i id="mBar"></i></div><span>' + d.n + '/' + d.page.pics.length + '</span></div>' +
      (d.pageBonus ? '<p class="pageBonus">' + T('pageDone', { c: JT.App.PAGE_COINS }) + '</p>' : '') +
      '<button class="btn pulse" id="mNext">' + T('next') + '</button>' +
      '<button class="link" id="mHome">' + T('home') + '</button>');
    drawPic(card.querySelector('#mPic'), d.pic, true);
    const stars = card.querySelectorAll('.stars svg');
    stars.forEach((s, i) => {
      if (i < d.stars) setTimeout(() => { s.classList.add('on'); A.star(i); A.buzz(12); }, 520 + i * 300);
      else s.classList.add('dim');
    });
    // the reward counts up once the stars have landed
    const rb = card.querySelector('.rewardRow b'), t0 = performance.now() + 520 + d.stars * 300;
    rb.textContent = '+0';
    const count = () => {
      const p = U.clamp((performance.now() - t0) / 650, 0, 1);
      rb.textContent = '+' + Math.round(d.coins * U.ease.outCubic(p));
      if (p < 1 && card.isConnected && rb.isConnected) requestAnimationFrame(count);
    };
    requestAnimationFrame(count);
    setTimeout(() => { rb.textContent = '+' + d.coins; }, 520 + d.stars * 300 + 800);   // final value even if frames are throttled
    const prev = Math.max(0, d.n - (d.newPic ? 1 : 0)) / d.page.pics.length;
    const bar = card.querySelector('#mBar');
    bar.style.transition = 'none'; bar.style.width = (prev * 100) + '%';
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = ''; bar.style.width = (d.n / d.page.pics.length * 100) + '%'; }));
    on(card, '#mNext', () => JT.App.startLevel(d.idx + 1));
    on(card, '#mHome', () => JT.App.goHome());
  };

  UI.fail = function (reason) {
    const d = Save.data, G = JT.Game, cost = JT.App.COST;
    let title, text, label, free = false, cst = 0, disabled = false, act;
    if (reason === 'rack') {
      title = T('failRack'); text = T('failRackText'); label = T('addSlot'); cst = cost.slot; act = 'slot';
      free = d.unlocked.slot && d.boosters.slot > 0; disabled = !G.canAddSlot();
    } else { title = T('failStuck'); text = T('failStuckText'); label = T('usePick'); cst = cost.pick; act = 'pick'; free = d.unlocked.pick && d.boosters.pick > 0; }
    if (!free && d.coins < cst) disabled = true;
    const card = UI.modal(
      '<div class="ribbon red">' + title + '</div>' +
      '<canvas class="failFace" id="mFace" width="272" height="240"></canvas>' +
      '<p>' + text + '</p>' +
      '<button class="btn" id="mGo"' + (disabled ? ' disabled' : '') + '>' + label + (free ? '' : price(cst)) + '</button>' +
      '<button class="btn blue sm" id="mRetry">' + T('retry') + '</button>' +
      '<button class="link" id="mHome">' + T('home') + '</button>');
    const fc = card.querySelector('#mFace').getContext('2d');
    R.blob(fc, 96, 120, 58, { hex: R.COL('K'), emo: 'sad' });
    R.blob(fc, 190, 144, 40, { hex: R.COL('S'), emo: 'sad' });
    on(card, '#mGo', () => JT.App.continueWith(act, free));
    on(card, '#mRetry', () => JT.App.startLevel(JT.App.cur));
    on(card, '#mHome', () => JT.App.goHome());
  };

  // the FPS meter is a developer tool: it shows only with ?dev in the address, or if it was already switched on
  const devMode = () => /[?&]dev\b/.test(location.search) || Save.data.settings.fps;
  function settingsRows() {
    const s = Save.data.settings;
    const row = (k, ico, lbl) => '<div class="setRow"><span class="lbl">' + ico + lbl + '</span><button class="switch' + (s[k] ? ' on' : '') + '" data-k="' + k + '" role="switch" aria-checked="' + !!s[k] + '" aria-label="' + lbl + '"></button></div>';
    return row('sfx', ICON.sound, T('sound')) + row('music', ICON.music, T('music')) + row('haptic', ICON.haptic, T('haptic')) +
      row('symbols', ICON.symbols, T('symbols')) + (devMode() ? row('fps', ICON.fps, T('showFps')) : '') +
      '<div class="setRow col"><span class="lbl">' + ICON.lang + T('language') + '</span><div class="seg"><button data-l="en" class="' + (JT.I18n.lang() === 'en' ? 'on' : '') + '">English</button><button data-l="vi" class="' + (JT.I18n.lang() === 'vi' ? 'on' : '') + '">Tiếng Việt</button></div></div>';
  }
  UI.settings = function (inGame) {
    const close = () => UI.closeModal();
    const card = UI.modal(
      '<div class="ribbon blue">' + T(inGame ? 'paused' : 'settings') + '</div><button class="close" id="mClose" aria-label="Close">' + ICON.close + '</button>' +
      settingsRows() +
      (inGame
        ? '<div class="row"><button class="btn pink sm" id="mHome">' + T('home') + '</button><button class="btn blue sm" id="mRetry">' + T('retry') + '</button></div><button class="btn" id="mResume">' + T('resume') + '</button>'
        : '<button class="link" id="mReset">' + T('reset') + '</button>'), '', close);
    card.querySelectorAll('.switch').forEach(sw => sw.addEventListener('click', () => {
      const k = sw.dataset.k, s = Save.data.settings;
      s[k] = !s[k]; Save.save();
      sw.classList.toggle('on', s[k]); sw.setAttribute('aria-checked', s[k]);
      if (k === 'music' || k === 'sfx') A.refresh();
      if (k === 'haptic' && s[k]) A.buzz(20);
      if (k === 'fps') JT.App.showFps(s[k]);
      if (k === 'symbols') { R.symbols = s[k]; R.clearCache(); if (JT.App.state === 'game') JT.Game.layout(); else UI.updateHome(); }
    }));
    card.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
      Save.data.settings.lang = b.dataset.l; Save.data.settings.langPicked = true; Save.save();
      UI.refreshTexts(); UI.setBoosters();
      if (inGame) UI.setLevel(JT.App.cur, JT.Levels.get(JT.App.cur)); else UI.updateHome();
      UI.settings(inGame);
    }));
    on(card, '#mClose', close);
    on(card, '#mResume', close);
    on(card, '#mHome', () => JT.App.goHome());
    on(card, '#mRetry', () => JT.App.startLevel(JT.App.cur));
    on(card, '#mReset', () => {
      const c2 = UI.modal('<div class="ribbon red">' + T('reset') + '</div><p>' + T('resetAsk') + '</p><div class="row"><button class="btn blue sm" id="mNo">' + T('no') + '</button><button class="btn red sm" id="mYes">' + T('yes') + '</button></div>');
      on(c2, '#mNo', () => UI.settings(false));
      on(c2, '#mYes', () => { Save.reset(); JT.Levels.clear(); UI.closeModal(); UI.setBoosters(); UI.updateHome(); });
    });
  };

  UI.album = function (page) {
    const d = Save.data;
    // the page of the picture you play next (pages differ in size: Sunny Day has 7); after the first lap, the last page
    const curKey = C.ALBUM_ORDER[Math.min(d.level, C.ALBUM_ORDER.length - 1)];
    const curPg = C.ALBUM.findIndex(p => p.pics.includes(curKey));
    if (page === undefined) page = curPg;
    const pg = C.ALBUM[page], en = JT.I18n.lang() === 'en';
    const done = pg.pics.filter(k => d.album.includes(k)).length, claimed = d.claimed.includes(pg.key);
    const starRow = n => [0, 1, 2].map(i => ICON.star.replace('<svg ', '<svg ' + (i < n ? '' : 'class="dim" '))).join('');
    const cards = pg.pics.map(k => {
      const li = C.ALBUM_ORDER.indexOf(k), pic = C.PICS[k], got = d.album.includes(k), locked = li > d.level;
      return '<button class="pcard' + (locked ? ' locked' : '') + (li === d.level ? ' cur' : '') + '" data-li="' + li + '"><canvas width="132" height="132" data-k="' + k + '" data-p="' + (got ? 1 : locked ? 0 : 'g') + '"></canvas>' +   // open but not made yet (the next level, or the rainbow on a save from before it): its ghost
        (locked ? '<span class="lock">' + ICON.lock + '</span>' : '') +
        '<div class="nm">' + (locked ? '???' : (en ? pic.en : pic.name)) + '</div>' +
        '<div class="st">' + (got ? starRow(d.stars[li] || 0) : '<span>' + T('level') + ' ' + (li + 1) + '</span>') + '</div></button>';
    }).join('');
    const close = () => UI.closeModal();
    const card = UI.modal(
      '<div class="ribbon purple">' + T('album') + '</div><button class="close" id="mClose" aria-label="Close">' + ICON.close + '</button>' +
      '<div class="pageNav"><button class="arrow" id="aPrev"' + (page === 0 ? ' disabled' : '') + ' aria-label="Prev">' + ICON.left + '</button>' +
      '<div class="pname">' + (en ? pg.en : pg.name) + '<small>' + done + '/' + pg.pics.length + ' ' + T('done') + '</small></div>' +
      '<button class="arrow" id="aNext"' + (page === C.ALBUM.length - 1 ? ' disabled' : '') + ' aria-label="Next">' + ICON.right + '</button></div>' +
      '<div class="bar"><i style="transition:none;width:' + (done / pg.pics.length * 100) + '%"></i></div>' +
      '<div class="grid' + (pg.pics.length > 6 ? ' wide' : '') + '">' + cards + '</div>' +
      '<p' + (claimed ? ' class="pageBonus"' : '') + '>' + (claimed ? T('pageClaimed') : T('pageReward', { c: JT.App.PAGE_COINS })) + '</p>' +
      '<div class="pageDots">' + C.ALBUM.map((p, i) => '<i class="' + (i === page ? 'on' : p.pics.every(k => d.album.includes(k)) ? 'full' : '') + '"></i>').join('') + '</div>',
      'album', close);
    card.querySelectorAll('.pcard canvas').forEach(cv => drawPic(cv, C.picInfo(cv.dataset.k), cv.dataset.p === '1' ? true : cv.dataset.p === 'g' ? 'ghost' : false));
    card.querySelectorAll('.pcard').forEach(b => b.addEventListener('click', () => JT.App.startLevel(+b.dataset.li)));
    on(card, '#mClose', close);
    on(card, '#aPrev', () => UI.album(page - 1));
    on(card, '#aNext', () => UI.album(page + 1));
  };

  // small illustrations for the mechanic popups, drawn with the game's own renderer
  function drawIntro(key, cv) {
    const ctx = cv.getContext('2d'), k = cv.width / 300;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    U.rr(ctx, 0, 0, 300, 125, 16); ctx.fillStyle = R.TRAY.base; ctx.fill();
    for (let y = 0; y < 3; y++) for (let x = 0; x < 7; x++) { U.rr(ctx, 8 + x * 41, 4 + y * 40, 37, 36, 8); ctx.fillStyle = R.TRAY.cell; ctx.fill(); }
    const line = (x0, y0, x1, y1) => { const p = []; for (let i = 0; i <= 10; i++) p.push({ x: x0 + (x1 - x0) * i / 10, y: y0 + (y1 - y0) * i / 10 }); return p; };
    const w = 24, hr = 15;
    const worm = (c, x0, y0, x1, y1, o) => {
      const hex = o && o.wrap ? R.WRAP : R.COL(c);
      R.worm(ctx, line(x0, y0, x1, y1), { hex: hex, w: w, wrap: o && o.wrap });
      R.head(ctx, x1, y1, Math.atan2(y1 - y0, x1 - x0), hr, { hex: hex, wrap: o && o.wrap, sleepy: o && o.sleepy });
    };
    const arrow = (x, y) => { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x + 12, y); ctx.moveTo(x + 4, y - 8); ctx.lineTo(x + 12, y); ctx.lineTo(x + 4, y + 8); ctx.stroke(); };
    if (key === 'cross') {
      worm('B', 60, 76, 235, 76, { sleepy: true });
      worm('K', 150, 112, 150, 26);
      R.label(ctx, '1', 150, 92, 20); R.label(ctx, '2', 90, 76, 20);
    } else if (key === 'mystery') {
      worm('A', 28, 62, 110, 62, { wrap: true }); R.label(ctx, '?', 60, 62, 20, '#fff', '#746d92');
      arrow(150, 62);
      worm('G', 188, 62, 268, 62);
    } else if (key === 'rotate') {
      worm('O', 70, 84, 150, 84);
      R.spinRing(ctx, 150, 84, 22, 0.6);
      ctx.globalAlpha = 0.9; arrow(206, 84);
      ctx.save(); ctx.translate(150, 34); ctx.rotate(-Math.PI / 2); arrow(0, 0); ctx.restore(); ctx.globalAlpha = 1;
    } else {
      R.blob(ctx, 62, 62, 28, { hex: R.COL('R') });
      R.label(ctx, '+', 106, 62, 30);
      R.blob(ctx, 150, 62, 28, { hex: R.COL('Y') });
      R.label(ctx, '=', 194, 62, 30);
      R.blob(ctx, 240, 62, 30, { hex: R.COL('O') });
    }
  }
  UI.intro = function (key, cb) {
    const card = UI.modal(
      '<div class="ribbon purple">' + T('newMech') + '</div>' +
      '<div class="title2">' + T('mech_' + key) + '</div>' +
      '<canvas class="introPic" id="mIntro" width="600" height="250"></canvas>' +
      '<p>' + T('mech_' + key + '_text') + '</p>' +
      '<button class="btn" id="mOk">' + T('tryIt') + '</button>');
    drawIntro(key, card.querySelector('#mIntro'));
    on(card, '#mOk', () => { UI.closeModal(); cb(); });
  };
  const bigIco = (k, n) => '<div class="bigIcoWrap"><div class="bigIco" style="' + BCOL[k] + '">' + ICON[k] + '<em>' + n + '</em></div></div>';
  UI.unlock = function (k, cb) {
    const card = UI.modal(
      '<div class="ribbon green">' + T('unlocked') + '</div>' + bigIco(k, '+' + JT.BOOST[k].grant) +
      '<div class="title2">' + T(k) + '</div><p>' + T(k + 'Desc') + '</p><button class="btn" id="mOk">' + T('ok') + '</button>');
    on(card, '#mOk', () => { UI.closeModal(); UI.freshBooster(k); cb(); });
  };
  UI.buy = function (k) {
    const b = JT.BOOST[k], poor = Save.data.coins < b.price, close = () => UI.closeModal();
    const card = UI.modal(
      '<div class="ribbon">' + T(k) + '</div><button class="close" id="mClose" aria-label="Close">' + ICON.close + '</button>' + bigIco(k, '×' + b.pack) +
      '<p>' + T(k + 'Desc') + '</p>' +
      '<button class="btn" id="mBuy"' + (poor ? ' disabled' : '') + '>' + (poor ? T('notEnough') : T('buy')) + price(b.price) + '</button>', '', close);
    on(card, '#mClose', close);
    on(card, '#mBuy', () => { JT.App.buyBooster(k); UI.closeModal(); UI.freshBooster(k); });
  };
})();
