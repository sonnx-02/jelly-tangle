/* DOM layer: home screen, HUD, toasts and every popup. The canvas owns the playfield; this owns the chrome. */
(function () {
  'use strict';
  const JT = window.JT, U = JT.U, C = JT.Core, R = JT.Render, A = JT.Audio, Save = JT.Save;
  const T = (k, v) => JT.I18n.t(k, v);
  const $ = id => document.getElementById(id);
  const UI = JT.UI = {};
  const INK = '#4a2617';

  const svg = (body, attrs) => '<svg viewBox="0 0 24 24" ' + (attrs || '') + '>' + body + '</svg>';
  const ICON = {
    gear: svg('<circle cx="12" cy="12" r="8.2" stroke-width="3.2" stroke-dasharray="3.22 3.22"/><circle cx="12" cy="12" r="5.1" stroke-width="3.6"/>', 'fill="none" stroke="currentColor"'),
    pause: svg('<rect x="5.6" y="4.4" width="4.4" height="15.2" rx="2.2"/><rect x="14" y="4.4" width="4.4" height="15.2" rx="2.2"/>', 'fill="currentColor"'),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>', 'fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"'),
    left: svg('<path d="M15 5l-7 7 7 7"/>', 'fill="none" stroke="#fff" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"'),
    right: svg('<path d="M9 5l7 7-7 7"/>', 'fill="none" stroke="#fff" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"'),
    lock: svg('<path d="M7.8 10.5V8a4.2 4.2 0 0 1 8.4 0v2.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><rect x="4.8" y="10" width="14.4" height="10.6" rx="3" fill="currentColor"/>'),
    star: svg('<path d="M12 1.8l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.6l-6.2 3.3L7 14 2 9.1l6.9-1z" fill="#ffc93c" stroke="#c47d0a" stroke-width="1.5" stroke-linejoin="round"/><path d="M8.3 9.4l2-.4 1-2" fill="none" stroke="#fff6c9" stroke-width="1.4" stroke-linecap="round"/>'),
    hint: svg('<path d="M12 2.4a6.9 6.9 0 0 0-4.1 12.4c.6.5 1 1.2 1 1.9v.9h6.2v-.9c0-.7.4-1.4 1-1.9A6.9 6.9 0 0 0 12 2.4z" fill="#fff" stroke="' + INK + '" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.2 20h5.6M10.4 22.3h3.2" stroke="' + INK + '" stroke-width="1.9" stroke-linecap="round"/><path d="M9 7.6a3.7 3.7 0 0 1 2.7-1.9" fill="none" stroke="#ffc93c" stroke-width="1.7" stroke-linecap="round"/>'),
    pick: svg('<g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="' + INK + '" stroke-width="5.2"><path d="M12 4c-5.6 3-7.2 8.8-5 15.8"/><path d="M12 4c5.6 3 7.2 8.8 5 15.8"/></g><g stroke="#fff" stroke-width="2.6"><path d="M12 4c-5.6 3-7.2 8.8-5 15.8"/><path d="M12 4c5.6 3 7.2 8.8 5 15.8"/></g></g><circle cx="12" cy="4.2" r="2.7" fill="#fff" stroke="' + INK + '" stroke-width="1.6"/>'),
    slot: svg('<rect x="1.6" y="6.6" width="20.8" height="10.8" rx="5.4" fill="#fff" stroke="' + INK + '" stroke-width="1.7"/><circle cx="7.4" cy="12" r="2.9" fill="#ffb5d3"/><circle cx="16.6" cy="12" r="3.3" fill="#45e08a"/><path d="M16.6 10.2v3.6M14.8 12h3.6" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>'),
    album: svg('<rect x="2.4" y="3.4" width="19.2" height="17.2" rx="4.2" fill="#fff" stroke="' + INK + '" stroke-width="1.8"/><rect x="6" y="7" width="5.2" height="4.8" rx="1.5" fill="#ff6aa6"/><rect x="12.8" y="7" width="5.2" height="4.8" rx="1.5" fill="#ffc93c"/><rect x="6" y="13" width="5.2" height="4.4" rx="1.5" fill="#45a5f5"/><rect x="12.8" y="13" width="5.2" height="4.4" rx="1.5" fill="#45e08a"/>'),
    sound: svg('<path d="M3.5 9.2h3.8L12.6 5v14l-5.3-4.2H3.5z" fill="currentColor"/><path d="M16 8.6a4.8 4.8 0 0 1 0 6.8M18.8 6a8.4 8.4 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
    music: svg('<path d="M9 17.5V5.6l10-2.2v11.8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="6.4" cy="17.6" rx="3" ry="2.5" fill="currentColor"/><ellipse cx="16.4" cy="15.4" rx="3" ry="2.5" fill="currentColor"/>'),
    haptic: svg('<rect x="7.4" y="2.6" width="9.2" height="18.8" rx="2.6" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M3.4 8.6v6.8M20.6 8.6v6.8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
    fps: svg('<path d="M4.2 17.6a8.6 8.6 0 1 1 15.6 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M12 14.4l4.2-5.2" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="14.6" r="2" fill="currentColor"/>'),
    lang: svg('<circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2.3"/><path d="M3.6 12h16.8M12 3.4c-5 5.6-5 11.6 0 17.2M12 3.4c5 5.6 5 11.6 0 17.2" fill="none" stroke="currentColor" stroke-width="2"/>')
  };
  UI.ICON = ICON;
  const BCOL = { hint: '--a:#ffe07a;--b:#ffbe2e;--l:#d68f0c', pick: '--a:#ff9cc5;--b:#ff5c9d;--l:#d83e80', slot: '--a:#8fd8ff;--b:#45a5f5;--l:#2b7fd6' };

  // ---------- init ----------
  UI.init = function () {
    $('hSettings').innerHTML = ICON.gear; $('btnPause').innerHTML = ICON.pause;
    document.querySelector('#hAlbum .nico').innerHTML = ICON.album;
    document.querySelectorAll('.booster').forEach(b => {
      b.querySelector('.bico').innerHTML = ICON[b.dataset.b];
      b.addEventListener('click', () => onBooster(b.dataset.b));
    });
    // logo: one bouncing candy-coloured letter at a time
    const cols = ['#ff6aa6', '#ffb02e', '#ffd42e', '#45e08a', '#5cb8ff', '#b47cff'];
    let i = 0;
    $('logo').innerHTML = ['Jelly', 'Tangle'].map(w => '<span class="row">' + w.split('').map(ch => '<span class="ch" style="--c:' + cols[i % cols.length] + ';--i:' + (i++) + '">' + ch + '</span>').join('') + '</span>').join('');

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
    $('hAlbumN').textContent = d.album.length + '/' + C.ALBUM_ORDER.length;
    drawPic($('hPic'), pic, false);
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
  const on = (card, sel, fn) => { const e = card.querySelector(sel); if (e) e.addEventListener('click', fn); };
  const price = n => '<span class="price"><i></i>' + n + '</span>';

  UI.win = function (d) {
    const card = UI.modal(
      '<div class="ribbon green">' + T('winTitle') + '</div>' +
      '<div class="winStage"><div class="rays"></div><canvas id="mPic" width="288" height="288"></canvas></div>' +
      '<div class="title2">' + JT.I18n.picName(d.pic) + '</div>' +
      '<div class="stars">' + ICON.star + ICON.star + ICON.star + '</div>' +
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

  function settingsRows() {
    const s = Save.data.settings;
    const row = (k, ico, lbl) => '<div class="setRow"><span class="lbl">' + ico + lbl + '</span><button class="switch' + (s[k] ? ' on' : '') + '" data-k="' + k + '" role="switch" aria-checked="' + !!s[k] + '" aria-label="' + lbl + '"></button></div>';
    return row('sfx', ICON.sound, T('sound')) + row('music', ICON.music, T('music')) + row('haptic', ICON.haptic, T('haptic')) + row('fps', ICON.fps, T('showFps')) +
      '<div class="setRow col"><span class="lbl">' + ICON.lang + T('language') + '</span><div class="seg"><button data-l="vi" class="' + (s.lang !== 'en' ? 'on' : '') + '">Tiếng Việt</button><button data-l="en" class="' + (s.lang === 'en' ? 'on' : '') + '">English</button></div></div>';
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
    }));
    card.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
      Save.data.settings.lang = b.dataset.l; Save.save();
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
    const curPg = Math.min(C.ALBUM.length - 1, Math.floor(Math.min(d.level, C.ALBUM_ORDER.length - 1) / 6));
    if (page === undefined) page = curPg;
    const pg = C.ALBUM[page], en = JT.I18n.lang() === 'en';
    const done = pg.pics.filter(k => d.album.includes(k)).length, claimed = d.claimed.includes(pg.key);
    const starRow = n => [0, 1, 2].map(i => ICON.star.replace('<svg ', '<svg ' + (i < n ? '' : 'class="dim" '))).join('');
    const cards = pg.pics.map(k => {
      const li = C.ALBUM_ORDER.indexOf(k), pic = C.PICS[k], got = d.album.includes(k), locked = li > d.level;
      return '<button class="pcard' + (locked ? ' locked' : '') + (li === d.level ? ' cur' : '') + '" data-li="' + li + '"><canvas width="132" height="132" data-k="' + k + '" data-p="' + (got ? 1 : 0) + '"></canvas>' +
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
      '<div class="grid">' + cards + '</div>' +
      '<p' + (claimed ? ' class="pageBonus"' : '') + '>' + (claimed ? T('pageClaimed') : T('pageReward', { c: JT.App.PAGE_COINS })) + '</p>' +
      '<div class="pageDots">' + C.ALBUM.map((p, i) => '<i class="' + (i === page ? 'on' : p.pics.every(k => d.album.includes(k)) ? 'full' : '') + '"></i>').join('') + '</div>',
      'album', close);
    card.querySelectorAll('.pcard canvas').forEach(cv => drawPic(cv, C.picInfo(cv.dataset.k), cv.dataset.p === '1'));
    card.querySelectorAll('.pcard').forEach(b => b.addEventListener('click', () => JT.App.startLevel(+b.dataset.li)));
    on(card, '#mClose', close);
    on(card, '#aPrev', () => UI.album(page - 1));
    on(card, '#aNext', () => UI.album(page + 1));
  };

  // small illustrations for the mechanic popups, drawn with the game's own renderer
  function drawIntro(key, cv) {
    const ctx = cv.getContext('2d'), k = cv.width / 300;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    U.rr(ctx, 0, 0, 300, 125, 16); ctx.fillStyle = '#3b2015'; ctx.fill();
    for (let y = 0; y < 3; y++) for (let x = 0; x < 7; x++) { U.rr(ctx, 8 + x * 41, 4 + y * 40, 37, 36, 8); ctx.fillStyle = '#4b2a1b'; ctx.fill(); }
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
