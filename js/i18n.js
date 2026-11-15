/* Strings. Vietnamese is the default; English is switchable in settings. */
(function () {
  'use strict';
  const JT = window.JT;

  const S = {
    vi: {
      play: 'Chơi', level: 'Màn', next: 'Tiếp tục', retry: 'Chơi lại', home: 'Trang chủ', resume: 'Chơi tiếp',
      settings: 'Cài đặt', paused: 'Tạm dừng', album: 'Bộ sưu tập', sound: 'Âm thanh', music: 'Nhạc nền', haptic: 'Rung',
      language: 'Ngôn ngữ', showFps: 'Hiện FPS', reset: 'Xoá tiến trình', resetAsk: 'Xoá toàn bộ tiến trình chơi?', yes: 'Xoá', no: 'Thôi', ok: 'OK!',
      loading: 'Đang bày kẹo…',
      hard: 'Màn khó!', hardTag: 'KHÓ', superHard: 'Siêu khó!', superTag: 'SIÊU KHÓ',
      winTitle: 'Hoàn thành!', winPraise: 'Hoàn hảo!', winPraise2: 'Tuyệt vời!', winPraise1: 'Xong rồi!', reward: 'Thưởng',
      symbols: 'Ký hiệu màu',
      failRack: 'Kẹt khay rồi!', failRackText: 'Khay đã đầy mà chưa bé nào phun được màu.',
      failStuck: 'Hết nước đi!', failStuckText: 'Không còn bé sâu nào chui ra được.',
      addSlot: '+1 ô khay', usePick: 'Dùng Kẹp gắp', free: 'Miễn phí',
      hint: 'Gợi ý', pick: 'Kẹp gắp', slot: 'Thêm ô',
      hintDesc: 'Chỉ cho bạn bé sâu nên kéo tiếp theo.',
      pickDesc: 'Gắp một bé sâu bất kỳ ra khỏi hộp, kể cả khi đang bị chặn.',
      slotDesc: 'Thêm ngay một ô trống vào khay cho màn này.',
      unlocked: 'Trợ giúp mới!', buy: 'Mua', notEnough: 'Không đủ xu', lockedAt: 'Màn {n}',
      newMech: 'Cơ chế mới!', tryIt: 'Chơi thử',
      tut1: 'Chạm bé sâu có <b>lối ra trống</b> trước mặt!',
      tut2: 'Bé nhảy lên khay rồi <b>phun màu</b> vào tranh',
      tut3: 'Tranh tô <b>từng vòng, từ ngoài vào</b>. Chỉ vòng đang sáng nhận màu',
      tut4: 'Xong vòng ngoài! <b>Vòng trong</b> mở rồi',
      tipBlocked: 'Lối ra bị chặn! Chạm nhầm nhiều sẽ <b>bớt sao</b>',
      tipMerge: '<b>Cùng màu</b> đứng cạnh nhau sẽ gộp lại, đỡ tốn ô!',
      tipSleep: 'Màu này <b>chưa tới lượt</b>. Tô xong vòng đang sáng đã!',
      tipFull: 'Khay đầy rồi! Đợi các bé phun xong nhé',
      tipCovered: 'Bé này đang bị <b>đè lên</b>. Kéo bé ở trên trước',
      tipPick: 'Chọn một bé sâu để gắp ra',
      tipDone: 'Màu này đủ rồi nên được đổi thành <b>xu</b>!',
      noHint: 'Không còn nước đi tốt. Thử dùng <b>Kẹp gắp</b>!',
      hintWait: 'Đợi các bé <b>phun màu xong</b> rồi hãy kéo tiếp',
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
      language: 'Language', showFps: 'Show FPS', reset: 'Reset progress', resetAsk: 'Erase all progress?', yes: 'Erase', no: 'Cancel', ok: 'OK!',
      loading: 'Setting out the candy…',
      hard: 'Hard level!', hardTag: 'HARD', superHard: 'Super hard!', superTag: 'SUPER HARD',
      winTitle: 'Complete!', winPraise: 'Perfect!', winPraise2: 'Great!', winPraise1: 'Done!', reward: 'Reward',
      symbols: 'Colour symbols',
      failRack: 'Tray jammed!', failRackText: 'The tray is full and nobody can squirt a colour.',
      failStuck: 'No moves left!', failStuckText: 'No worm can wriggle out any more.',
      addSlot: '+1 tray slot', usePick: 'Use Tongs', free: 'Free',
      hint: 'Hint', pick: 'Tongs', slot: 'Extra slot',
      hintDesc: 'Shows the worm you should pull next.',
      pickDesc: 'Lift any worm out of the box, even a blocked one.',
      slotDesc: 'Adds one empty tray slot for this level.',
      unlocked: 'New booster!', buy: 'Buy', notEnough: 'Not enough coins', lockedAt: 'Lv {n}',
      newMech: 'New mechanic!', tryIt: 'Try it',
      tut1: 'Tap a worm with a <b>clear way out</b> ahead!',
      tut2: 'It hops on the tray and <b>squirts colour</b> at the picture',
      tut3: 'The picture fills <b>one ring at a time, from the outside in</b>. Only the glowing ring takes colour',
      tut4: 'Outer ring done! The <b>next ring</b> is open',
      tipBlocked: 'That exit is blocked! Too many bumps <b>cost stars</b>',
      tipMerge: '<b>Same colours</b> side by side merge and save a slot!',
      tipSleep: 'That colour <b>isn’t needed yet</b>. Finish the glowing ring first!',
      tipFull: 'Tray is full! Wait for a jelly to finish',
      tipCovered: 'This one is <b>pinned</b>. Pull the worm on top first',
      tipPick: 'Pick a worm to lift out',
      tipDone: 'That colour is done, so it turns into <b>coins</b>!',
      noHint: 'No good move left. Try the <b>Tongs</b>!',
      hintWait: 'Let the jellies <b>finish squirting</b> before the next pull',
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
