/* Strings. Vietnamese is the default; English is switchable in settings. */
(function () {
  'use strict';
  const JT = window.JT;

  const S = {
    vi: {
      play: 'Chơi', level: 'Màn', next: 'Tiếp tục', retry: 'Chơi lại', home: 'Trang chủ', resume: 'Chơi tiếp',
      settings: 'Cài đặt', paused: 'Tạm dừng', album: 'Bộ sưu tập', sound: 'Âm thanh', music: 'Nhạc nền', haptic: 'Rung',
      language: 'Ngôn ngữ', reset: 'Xoá tiến trình', resetAsk: 'Xoá toàn bộ tiến trình chơi?', yes: 'Xoá', no: 'Thôi', ok: 'OK!',
      loading: 'Đang bày kẹo…',
      ring: 'Vòng', nextRing: 'Kế tiếp', hard: 'Màn khó!', hardTag: 'KHÓ',
      winTitle: 'Hoàn thành!', winPraise: 'Hoàn hảo!', reward: 'Thưởng',
      failRack: 'Kẹt khay rồi!', failRackText: 'Khay đã đầy mà chưa bé nào phun được màu.',
      failHearts: 'Hết tim!', failHeartsText: 'Bạn đã lao vào vật cản 3 lần.',
      failStuck: 'Hết nước đi!', failStuckText: 'Không còn bé sâu nào chui ra được.',
      addSlot: '+1 ô khay', addHeart: '+1 tim', usePick: 'Dùng Kẹp gắp', free: 'Miễn phí',
      hint: 'Gợi ý', pick: 'Kẹp gắp', slot: 'Thêm ô',
      hintDesc: 'Chỉ cho bạn bé sâu nên kéo tiếp theo.',
      pickDesc: 'Gắp một bé sâu bất kỳ ra khỏi hộp, kể cả khi đang bị chặn.',
      slotDesc: 'Thêm ngay một ô trống vào khay cho màn này.',
      unlocked: 'Trợ giúp mới!', buy: 'Mua', notEnough: 'Không đủ xu', lockedAt: 'Màn {n}',
      newMech: 'Cơ chế mới!', tryIt: 'Chơi thử',
      tut1: 'Chạm bé sâu có <b>lối ra trống</b> trước mặt!',
      tut2: 'Bé nhảy lên khay rồi <b>phun màu</b> vào tranh',
      tut3: 'Tô kín <b>vòng ngoài</b> thì vòng trong mới mở',
      tipBlocked: 'Lối ra bị chặn sẽ <b>mất 1 tim</b>',
      tipMerge: '<b>Cùng màu</b> đứng cạnh nhau sẽ gộp lại, đỡ tốn ô!',
      tipSleep: 'Màu này <b>chưa tới lượt</b>. Tô xong vòng đang sáng đã!',
      tipFull: 'Khay đầy rồi! Đợi các bé phun xong nhé',
      tipCovered: 'Bé này đang bị <b>đè lên</b>. Kéo bé ở trên trước',
      tipPick: 'Chọn một bé sâu để gắp ra',
      tipDone: 'Màu này đủ rồi nên được đổi thành <b>xu</b>!',
      noHint: 'Không còn nước đi tốt. Thử dùng <b>Kẹp gắp</b>!',
      slotMax: 'Khay đã rộng hết cỡ rồi',
      merged: 'Gộp',
      praise: ['Tuyệt!', 'Ngon lành!', 'Đỉnh quá!', 'Xuất sắc!', 'Mượt ghê!', 'Ngọt lịm!'],
      mech_cross: 'Sâu nằm đè',
      mech_cross_text: 'Có bé sâu nằm vắt ngang lên bé khác. Kéo bé ở trên ra trước thì bé bên dưới mới đi được.',
      mech_mystery: 'Kẹo bọc giấy',
      mech_mystery_text: 'Bé sâu bọc giấy bạc chưa lộ màu. Khi lối ra của bé thông thoáng, lớp giấy sẽ tự bung.',
      mech_rotate: 'Sâu chóng mặt',
      mech_rotate_text: 'Bé sâu có vòng mũi tên sẽ quay đầu sang hướng khác sau mỗi lần bạn kéo một bé bất kỳ.',
      mech_mix: 'Pha màu',
      mech_mix_text: 'Hộp này chỉ có màu gốc. Hai màu gốc đứng cạnh nhau trên khay sẽ hoà thành màu mới: Đỏ + Vàng = Cam, Vàng + Lam = Lá, Đỏ + Lam = Tím.',
      pageDone: 'Xong trang! +{c} xu và +1 mỗi trợ giúp',
      pageReward: 'Hoàn thành cả trang để nhận {c} xu và +1 mỗi trợ giúp',
      pageClaimed: 'Đã nhận thưởng trang này',
      albumHint: 'Chạm vào tranh đã mở để chơi lại.',
      done: 'xong', page: 'Trang'
    },
    en: {
      play: 'Play', level: 'Level', next: 'Continue', retry: 'Retry', home: 'Home', resume: 'Resume',
      settings: 'Settings', paused: 'Paused', album: 'Collection', sound: 'Sound', music: 'Music', haptic: 'Vibration',
      language: 'Language', reset: 'Reset progress', resetAsk: 'Erase all progress?', yes: 'Erase', no: 'Cancel', ok: 'OK!',
      loading: 'Setting out the candy…',
      ring: 'Ring', nextRing: 'Up next', hard: 'Hard level!', hardTag: 'HARD',
      winTitle: 'Complete!', winPraise: 'Perfect!', reward: 'Reward',
      failRack: 'Tray jammed!', failRackText: 'The tray is full and nobody can squirt a colour.',
      failHearts: 'Out of hearts!', failHeartsText: 'You bumped into a blocker 3 times.',
      failStuck: 'No moves left!', failStuckText: 'No worm can wriggle out any more.',
      addSlot: '+1 tray slot', addHeart: '+1 heart', usePick: 'Use Tongs', free: 'Free',
      hint: 'Hint', pick: 'Tongs', slot: 'Extra slot',
      hintDesc: 'Shows the worm you should pull next.',
      pickDesc: 'Lift any worm out of the box, even a blocked one.',
      slotDesc: 'Adds one empty tray slot for this level.',
      unlocked: 'New booster!', buy: 'Buy', notEnough: 'Not enough coins', lockedAt: 'Lv {n}',
      newMech: 'New mechanic!', tryIt: 'Try it',
      tut1: 'Tap a worm with a <b>clear way out</b> ahead!',
      tut2: 'It hops on the tray and <b>squirts colour</b> at the picture',
      tut3: 'Fill the <b>outer ring</b> to open the next one',
      tipBlocked: 'A blocked exit <b>costs a heart</b>',
      tipMerge: '<b>Same colours</b> side by side merge and save a slot!',
      tipSleep: 'That colour <b>isn’t needed yet</b>. Finish the glowing ring first!',
      tipFull: 'Tray is full! Wait for a jelly to finish',
      tipCovered: 'This one is <b>pinned</b>. Pull the worm on top first',
      tipPick: 'Pick a worm to lift out',
      tipDone: 'That colour is done, so it turns into <b>coins</b>!',
      noHint: 'No good move left. Try the <b>Tongs</b>!',
      slotMax: 'The tray is already at full size',
      merged: 'Merge',
      praise: ['Sweet!', 'Yummy!', 'Awesome!', 'Juicy!', 'Smooth!', 'Tasty!'],
      mech_cross: 'Crossed worms',
      mech_cross_text: 'Some worms lie across another one. Pull the worm on top first to free the one underneath.',
      mech_mystery: 'Wrapped candy',
      mech_mystery_text: 'A foil-wrapped worm hides its colour. The wrapper pops off as soon as its way out is clear.',
      mech_rotate: 'Dizzy worms',
      mech_rotate_text: 'A worm with an arrow ring turns its head to a new direction every time you pull any worm.',
      mech_mix: 'Colour mixing',
      mech_mix_text: 'This box only has primary colours. Two primaries side by side on the tray blend: Red + Yellow = Orange, Yellow + Blue = Green, Red + Blue = Purple.',
      pageDone: 'Page complete! +{c} coins and +1 of each booster',
      pageReward: 'Finish the whole page for {c} coins and +1 of each booster',
      pageClaimed: 'Page reward collected',
      albumHint: 'Tap an unlocked picture to replay it.',
      done: 'done', page: 'Page'
    }
  };

  const I = JT.I18n = {
    lang() { return JT.Save.data.settings.lang === 'en' ? 'en' : 'vi'; },
    t(key, vars) {
      let s = S[I.lang()][key];
      if (s === undefined) s = S.vi[key] !== undefined ? S.vi[key] : key;
      if (vars && typeof s === 'string') for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
      return s;
    },
    picName(pic) { return I.lang() === 'en' ? (pic.en || pic.name) : pic.name; },
    colorName(key) { const p = JT.Core.PALETTE[key]; return I.lang() === 'en' ? p.en : p.name; }
  };
})();
