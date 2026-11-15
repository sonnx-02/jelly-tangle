/* Jelly Tangle core: level generation, simulation, solver, difficulty bot. No DOM, no rendering.
   Rules: ring painting, rack with adjacent coupling, crossing worms (two layers), wrapped worms
   (UI-only: colour shown once the exit is open), dizzy worms (turn with every pull), colour mixing.
   Internally a worm is still called a "hose" (the game started life as Hose Out). */
(function (root) {
  'use strict';
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  // Tuned with CIEDE2000 on every colour pair that shares a picture, under normal vision and simulated
  // protanopia / deuteranopia / tritanopia (Machado 2009). Each colour moved at most ~ΔE 9 from its first
  // version, mostly in lightness, so the candy keeps its hue: the closest pair in normal vision went from
  // ΔE 14 to 17, the worst deuteranopia pair from 1 to 3 (Berry/Grape; the symbols below cover that one).
  // glyph: the shape that stands for the colour when "colour symbols" is on (see Render.glyph).
  const PALETTE = {
    R: { name: 'Đỏ', en: 'Cherry', hex: '#ee3a5b', glyph: 'heart' },
    O: { name: 'Cam', en: 'Orange', hex: '#ff8a1c', glyph: 'tri' },
    Y: { name: 'Vàng', en: 'Lemon', hex: '#ffdb2e', glyph: 'star' },
    G: { name: 'Lá', en: 'Apple', hex: '#34d26f', glyph: 'diamond' },
    L: { name: 'Lá non', en: 'Lime', hex: '#c6ef3a', glyph: 'triDown' },
    B: { name: 'Lam', en: 'Berry', hex: '#3184ff', glyph: 'square' },
    S: { name: 'Trời', en: 'Sky', hex: '#6fd8ff', glyph: 'circle' },
    T: { name: 'Ngọc', en: 'Mint', hex: '#0aa898', glyph: 'plus' },
    P: { name: 'Tím', en: 'Grape', hex: '#a964f2', glyph: 'flower' },
    K: { name: 'Hồng', en: 'Bubblegum', hex: '#ff94cc', glyph: 'ring' },
    W: { name: 'Trắng', en: 'Milk', hex: '#fffaf0', glyph: 'moon' },
    C: { name: 'Be', en: 'Caramel', hex: '#f9caa6', glyph: 'pentagon' },
    N: { name: 'Nâu', en: 'Cola', hex: '#a05c35', glyph: 'cross' },
    D: { name: 'Đêm', en: 'Blueberry', hex: '#4d58cf', glyph: 'bowtie' },
    A: { name: 'Than', en: 'Licorice', hex: '#6c7290', glyph: 'bars' }
  };
  // primary + primary -> secondary (only in levels with mixing)
  const MIX = { RY: 'O', YR: 'O', YB: 'G', BY: 'G', RB: 'P', BR: 'P' };
  const MIX_PARTS = { O: ['R', 'Y'], G: ['Y', 'B'], P: ['R', 'B'] };
  const MIXES_OF = { R: ['O', 'P'], Y: ['O', 'G'], B: ['G', 'P'] };

  // 12x12 pixel art, one picture per album slot (and per level)
  const PICS = {
    heart: { en: 'Heart', name: 'Trái tim', rows: ['SSSSSSSSSSSS', 'SSRRRSSRRRSS', 'SRRWRRRRRRRS', 'SRWRRRRRRRRS', 'SRRRRRRRRRRS', 'SRRRRRRRRRRS', 'SSRRRRRRRRSS', 'SSSRRRRRRSSS', 'SSSSRRRRSSSS', 'SSSSSRRSSSSS', 'SSSSSSSSSSSS', 'SSSSSSSSSSSS'] },
    // one colour per ring, cherry outside to grape in the middle: the ring rule, drawn as a picture
    rainbow: { en: 'Rainbow', name: 'Cầu vồng', rows: Array.from({ length: 12 }, (_, y) =>
      Array.from({ length: 12 }, (_, x) => 'ROYGBP'[Math.min(x, y, 11 - x, 11 - y)]).join('')) },
    cat: { en: 'Ginger Cat', name: 'Mèo cam', rows: ['KKKKKKKKKKKK', 'KOOKKKKKKOOK', 'KOCOKKKKOCOK', 'KOOOOOOOOOOK', 'KOOOOOOOOOOK', 'KODDOOOODDOK', 'KOOOOOOOOOOK', 'KOOOCCCCOOOK', 'KOOCCRRCCOOK', 'KKOOCCCCOOKK', 'KKKOOOOOOKKK', 'KKKKKKKKKKKK'] },
    fish: { en: 'Goldfish', name: 'Cá vàng', rows: ['BBBBBBBBBWBB', 'BBBBBBBBBBBB', 'BBBBYYYYBBWB', 'BBBYYYYYYBBO', 'BBYYWDYYYYOO', 'BYYYYYYYYYOO', 'BYYOYYYYYYOO', 'BBYYYYYYYBBO', 'BBBYYYYYBBBB', 'BWBBBBBBBTBB', 'BBBTBBBBTTBT', 'TTTTTTTTTTTT'] },
    flower: { en: 'Flower Pot', name: 'Chậu hoa', rows: ['SSSSSSSSSSYY', 'SSSSKKKKSSYY', 'SSSKKKKKKSSS', 'SSKKKYYKKKSS', 'SSKKYYYYKKSS', 'SSKKKYYKKKSS', 'SSSKKKKKKSSS', 'SSSSSGGSSSSS', 'SGGGSGGSGGGS', 'SSNNNNNNNNSS', 'SSSNNNNNNSSS', 'SSSNNNNNNSSS'] },
    mushroom: { en: 'Mushroom', name: 'Nấm đỏ', rows: ['SSSSSSSSSSSS', 'SSSSRRRRSSSS', 'SSSRRWWRRSSS', 'SSRRRWWRRRSS', 'SRWWRRRRWWRS', 'SRWWRRRRWWRS', 'SRRRRRRRRRRS', 'SSSSCCCCSSSS', 'SSSSCCCCSSSS', 'SSSSCCCCSSSS', 'GLGGGLGGLGGG', 'GGGGGGGGGGGG'] },
    icecream: { en: 'Ice Cream', name: 'Kem ốc quế', rows: ['SSSSSSSSSSSS', 'SSSSSSRSSSSS', 'SSSSKKKKSSSS', 'SSSKKKKKKSSS', 'SSKKWKKKKKSS', 'SSKKKKKKKKSS', 'SSCCCCCCCCSS', 'SSONONONONSS', 'SSSNONONOSSS', 'SSSSNONOSSSS', 'SSSSSONSSSSS', 'SSSSSSSSSSSS'] },
    rocket: { en: 'Rocket', name: 'Tên lửa', rows: ['DDYDDDDDDDDD', 'DDDDDRRDDDYD', 'DDDDRWWRDDDD', 'DDDDWWWWDDDD', 'DYDDWBBWDDDD', 'DDDDWBBWDDDD', 'DDDDWWWWDDYD', 'DDDRWWWWRDDD', 'DDRRWWWWRRDD', 'DDRDDOODDRDD', 'DDDDOYYODDDD', 'DDDDDOODDDDD'] },
    house: { en: 'Cottage', name: 'Ngôi nhà', rows: ['SWWSSSSSSSSS', 'SSSSSRRSNNSS', 'SSSSRRRRNNSS', 'SSSRRRRRRSSS', 'SSRRRRRRRRSS', 'SRRRRRRRRRRS', 'SSCCCCCCCCSS', 'SSCBBCCNNCSS', 'SSCBBCCNNCSS', 'SSCCCCCNNCSS', 'GGGGGGGGGGGG', 'GGGGGGGGGGGG'] },
    balloon: { en: 'Hot-Air Balloon', name: 'Khinh khí cầu', rows: ['SSSSRRRRSSSS', 'SSSRYRRYRSSS', 'SSRRYRRYRRSS', 'SSRRYRRYRRSS', 'WSRRYRRYRRSW', 'WWSRYRRYRSWW', 'SSSSRYYRSSSS', 'SSSSNSSNSSSS', 'SSSSNNNNSSSS', 'SSSSNNNNSSSS', 'SWWSSSSSSWWW', 'WWWWSSSSWWWW'] },
    sailboat: { en: 'Sailboat', name: 'Thuyền buồm', rows: ['YYSSSRRSSSSS', 'YYSSSNWSSSSS', 'SSSSWNWWSSSS', 'SSSWWNWWWSSS', 'SSWWWNWWWWSS', 'SWWWWNWWWWWS', 'SSSSSNSSSSSS', 'SNNNNNNNNNNS', 'SSNNNNNNNNSS', 'BBBBBBBBBBBB', 'BTBBTBBTBBTB', 'BBBBBBBBBBBB'] },
    bus: { en: 'School Bus', name: 'Xe buýt', rows: ['SSSSSSSSSSSS', 'SWWSSSSSSWWS', 'SYYYYYYYYYYS', 'SYBBYBBYBBYS', 'SYBBYBBYBBYS', 'SYYYYYYYYYYS', 'SYYYYYYYYYWS', 'SOOOOOOOOOOS', 'SYAAYYYYAAYS', 'GGAAGGGGAAGG', 'GGGGGGGGGGGG', 'GGGGGGGGGGGG'] },
    lighthouse: { en: 'Lighthouse', name: 'Hải đăng', rows: ['SSSSSSSSSSSS', 'SSSSRRRRSSSS', 'SYSSYYYYSSYS', 'SSSSRRRRSSSS', 'SSSSWWWWSSSS', 'SSSSRRRRSSSS', 'SSSSWWWWSSSS', 'SSSRRRRRRSSS', 'SSSWWWWWWSSS', 'SSNNNNNNNNSS', 'BBNNNNNNNNBB', 'BBBBBBBBBBBB'] },
    cupcake: { en: 'Cupcake', name: 'Bánh cupcake', rows: ['TTTTTRRTTTTT', 'TTTTKKKKTTTT', 'TTTKKYKKKTTT', 'TTKKKKKBKKTT', 'TKKRKKKKKYKT', 'TKKKKKKKKKKT', 'TTONONONONTT', 'TTONONONONTT', 'TTTONONONTTT', 'TTTONONONTTT', 'TTTTTTTTTTTT', 'TTTTTTTTTTTT'] },
    watermelon: { en: 'Watermelon', name: 'Dưa hấu', rows: ['KKWKKKKKKWKK', 'KKKKKKKKKKKK', 'GLRRRRRRRRLG', 'GLRARRRRARLG', 'KGLRRRARRLGK', 'KGLRRRRRRLGK', 'KKGLRARRLGKK', 'KKKGLRRLGKKK', 'KKKKGLLGKKKK', 'KKKKKGGKKKKK', 'KWKKKKKKKKWK', 'KKKKKKKKKKKK'] },
    candy: { en: 'Candy Stripes', name: 'Kẹo sọc', rows: Array.from({ length: 12 }, (_, y) =>
      Array.from({ length: 12 }, (_, x) => 'OGP'[Math.floor((x + y) / 2) % 3]).join('')) },
    cake: { en: 'Fruit Tart', name: 'Bánh tart', rows: ['SSSSSSSSSSSS', 'SSSWWWWWWSSS', 'SSWPPPPPPWSS', 'SWPPOOOOPPWS', 'SWPOOGGOOPWS', 'SWPOGKKGOPWS', 'SWPOGKKGOPWS', 'SWPOOGGOOPWS', 'SWPPOOOOPPWS', 'SSWPPPPPPWSS', 'SSSWWWWWWSSS', 'SSSSSSSSSSSS'] },
    donut: { en: 'Donut', name: 'Bánh donut', rows: ['TTTTTTTTTTTT', 'TTTTOOOOTTTT', 'TTOKKKKKKOTT', 'TOKYKKWKKKOT', 'TOKKKTTKBKOT', 'OKWKTTTTKKKO', 'OKKKTTTTKYKO', 'TOKBKTTKKKOT', 'TOKKKKKWKKOT', 'TTOKKKKKKOTT', 'TTTOOOOOOTTT', 'TTTTTTTTTTTT'] },
    lollipop: { en: 'Lollipop', name: 'Kẹo mút', rows: ['YSSSSSSSSSSS', 'SSSSPPPPSSSS', 'SSSPWKKKPSSS', 'SSPKPPPPKPSS', 'SSPKPKKPKPSS', 'SSPKPKKPKPSS', 'SSPKPPPPKPSS', 'SSSPKKKKPSSS', 'SSSSPPPPSSSS', 'SSSSSWWSSSSS', 'SSSSSWWSSSSY', 'SSSSSWWSSSSS'] },
    whale: { en: 'Whale', name: 'Cá voi', rows: ['BBBBBSBSBBBB', 'BBBBBBSBBBBB', 'BBBBDDDDBBBB', 'BBBDDDDDDBBB', 'BBDDDDDDDDBD', 'BDDWDDDDDDDD', 'BDDDDDDDDDDB', 'BDWWWWWDDDBB', 'BBWWWWWWDBBB', 'BBBBBBBBBBBB', 'TBBTBBTBBTBB', 'TTTTTTTTTTTT'] },
    starfish: { en: 'Starfish', name: 'Sao biển', rows: ['TTTTTTTTTTTT', 'TTTTTOOTTTTT', 'CCCCCOOCCCCC', 'CCCCOOOOCCCC', 'COOOOOOOOOOC', 'CCOOYOOYOOCC', 'CCCOOOOOOCCC', 'CCCOOCCOOCCC', 'CCOOCCCCOOCC', 'CCOCCWCCCOCC', 'CCCCCCCCWWCC', 'CCCCCCCCCCCC'] },
    turtle: { en: 'Sea Turtle', name: 'Rùa biển', rows: ['BBBBBBBBBWBB', 'BBBBBBBBBBBB', 'BBBBGGGGBBBB', 'BBBGNGGNGBBB', 'BLGGGNNGGGLL', 'BBGNGGGGNGLD', 'BBGGGNNGGGBB', 'BLLGGGGGGLLB', 'BLBBLBBLBBLB', 'BBBBBBBBBBBB', 'BTBBBTBBBTBB', 'TTTTTTTTTTTT'] },
    octopus: { en: 'Octopus', name: 'Bạch tuộc', rows: ['BBBBBBBBBBWB', 'BBBBKKKKBBBB', 'BBBKKKKKKBBB', 'BBKKKKKKKKBB', 'BBKWAKKWAKBB', 'BBKKKKKKKKBB', 'BBKKKRRKKKBB', 'BKKKKKKKKKKB', 'BKBKBKKBKBKB', 'KBBKBKKBKBBK', 'BBKBBKKBBKBB', 'BBBBBBBBBBBB'] },
    crab: { en: 'Crab', name: 'Con cua', rows: ['TTTTTTTTTTTT', 'CRRCCCCCCRRC', 'RCCRCCCCRCCR', 'CRRCWCCWCRRC', 'CCRCACCACRCC', 'CCRRRRRRRRCC', 'CRRROOOORRRC', 'CRRRRRRRRRRC', 'CCRRRRRRRRCC', 'CRCRCCCCRCRC', 'RCCCCWCCCCCR', 'CCCCCCCCCCCC'] },
    jellyfish: { en: 'Jellyfish', name: 'Con sứa', rows: ['DDDDDDDDDDTD', 'DDDDPPPPDDDD', 'DDDPKKPPPDDD', 'DDPKPPPPPPDD', 'DDPPPPPPPPDD', 'DDPPPPPPPPDD', 'DDKKKKKKKKDD', 'DDWDKDDKDWDD', 'DDDWDKKDWDDD', 'DTDWDKKDWDDD', 'DDWDDDKDDWDD', 'DDDDDDDDDDDD'] },
    owl: { en: 'Owl', name: 'Cú mèo', rows: ['DDDDDDDDDYYD', 'DDDDDDDDDYYD', 'DDNNDDDDNNDD', 'DDNNNNNNNNDD', 'DNWWNNNNWWND', 'DNWDWNNWDWND', 'DNNNNOONNNND', 'DNNCCCCCCNND', 'DNCCNCCNCCND', 'DDNCCCCCCNDD', 'NNNNONNONNNN', 'DDDDDDDDDDDD'] },
    fox: { en: 'Little Fox', name: 'Cáo nhỏ', rows: ['LLLLLLLLLLLL', 'LOOLLLLLLOOL', 'LONOLLLLONOL', 'LOOOOOOOOOOL', 'OOOOOOOOOOOO', 'OOAOOOOOOAOO', 'WWWOOOOOOWWW', 'LWWWOOOOWWWL', 'LLWWWAAWWWLL', 'LLLWWWWWWLLL', 'LLLLWWWWLLLL', 'LLLLLLLLLLLL'] },
    rabbit: { en: 'Bunny', name: 'Thỏ trắng', rows: ['SSSWWSSWWSSS', 'SSSWKSSKWSSS', 'SSSWKSSKWSSS', 'SSWWWWWWWWSS', 'SWWAWWWWAWWS', 'SWWWWKKWWWWS', 'SWKWWWWWWKWS', 'SSWWWWWWWWSS', 'GGGWWWWWWGOG', 'GGWWGGGGWWOG', 'GGGGGGGGGGGG', 'GGGGGGGGGGGG'] },
    bee: { en: 'Honey Bee', name: 'Ong mật', rows: ['SSSSSSSSSSSS', 'SSSWWSSWWSSS', 'SSWWWWWWWWSS', 'SSSWWWWWWSSS', 'SSAYYAYYAYSS', 'SAAYYAYYAYYS', 'SAWYYAYYAYYA', 'SAAYYAYYAYYS', 'SSAYYAYYAYSS', 'SSSSSSSSSSSS', 'GKGGYGGKGGYG', 'GGGGGGGGGGGG'] },
    pine: { en: 'Pine Tree', name: 'Cây thông', rows: ['SWSSSYYSSSWS', 'SSSSSGGSSSSS', 'SSSSGGGGSSSS', 'SSSGGRGGGSSS', 'SSGGGGGBGGSS', 'SSSGGGGGGSSS', 'SSGGGGRGGGSS', 'SGGBGGGGGGGS', 'SSSSSNNSSSSS', 'SSSSSNNSSSSS', 'WWWWWWWWWWWW', 'WWWWWWWWWWWW'] },
    violet: { en: 'Violets', name: 'Chậu hoa tím', rows: ['SSSSSSSSSSSS', 'SSSPPSSPPSSS', 'SSPPPPPPPPSS', 'SSPPPWWPPPSS', 'SSSPPWWPPSSS', 'SSSSPPPPSSSS', 'SSSSSGGSSSSS', 'SSGGSGGSGGSS', 'SSSGGGGGGSSS', 'SSSOOOOOOSSS', 'SSSSOOOOSSSS', 'SSSSOOOOSSSS'] }
  };

  // Album: 5 themed pages of 6 pictures, and Sunny Day has a 7th, the rainbow. In the first lap level N uses
  // picture N in this order.
  const ALBUM = [
    // bg: soft paper colours (top, middle, bottom, glow tint) behind the page's levels, pale enough that the
    // porcelain cards and the jelly colours always lead
    { key: 'sunny', en: 'Sunny Day', name: 'Ngày nắng', pics: ['heart', 'rainbow', 'cat', 'fish', 'flower', 'mushroom', 'icecream'], bg: ['#fdf3e7', '#f9e3d9', '#f2cfcd', '#fff7ef'] },
    { key: 'trip', en: 'Adventure', name: 'Phiêu lưu', pics: ['rocket', 'house', 'balloon', 'sailboat', 'bus', 'lighthouse'], bg: ['#eef5fa', '#dde9f4', '#c9d9ee', '#f6faff'] },
    { key: 'bakery', en: 'Bakery', name: 'Tiệm bánh', pics: ['cupcake', 'watermelon', 'candy', 'cake', 'donut', 'lollipop'], bg: ['#fdf1ea', '#f7e0e1', '#ecc9d3', '#fff6f2'] },
    { key: 'ocean', en: 'Ocean', name: 'Đại dương', pics: ['whale', 'starfish', 'turtle', 'octopus', 'crab', 'jellyfish'], bg: ['#eef8f5', '#d9eeea', '#c1e0de', '#f4fffc'] },
    { key: 'forest', en: 'Forest', name: 'Rừng xanh', pics: ['owl', 'fox', 'rabbit', 'bee', 'pine', 'violet'], bg: ['#f5f8ec', '#e3ecd7', '#cddfc3', '#fbfdf4'] }
  ];
  const ALBUM_ORDER = ALBUM.reduce((a, pg) => a.concat(pg.pics), []);

  // super: the sheet's "Super Hard", shown with its own tag
  const BANDS = { easy: [0, 0.25], normal: [0.25, 0.55], hard: [0.55, 0.85], super: [0.85, 0.95] };
  const MECH = ['cross', 'mystery', 'rotate', 'mix'];

  const BASE = { slots: 5, density: 0.82, lmin: 2, lmax: 5, slack: 0.1, cols: 8, rows: 6 };   // landscape box: wider than tall, so the picture gets the height
  // one entry per album picture, in ALBUM_ORDER
  const LEVELS = [
    // Levels 1-11 are hand-made. Level 2, the rainbow, was designed in-house; the others come from the level
    // designers' sheet, brought in by tools/import_levels.py (sheet level n >= 2 is game level n + 1). designed: true
    // keeps them when tools/levels.html re-bakes; target is the bot fail range for the level. They bring the
    // mechanics in early: crossed worms at 4, wrapped candy at 7, dizzy worms at 10. Page 1 has a rack of 6.
    // (cross / mystery / rotate below only matter if a level ever has to be generated instead.)
    // tip: a one-time toast when the level starts (js/i18n.js)
    { designed: true, band: 'easy', target: [0, 0.05], cols: 6, rows: 5, density: 0.8, lmax: 4, slack: 0.12, slots: 6 },
    // Level 2, the rainbow: the picture fills one colour per ring, and the box is a rainbow too, peeled from the top.
    // (< > ^ v: a worm's head and the way it leaves; data in js/level-data.js)
    //    R< R  R  R^ R  R  R>     three cherries, free: they merge on the rack and fill the outer ring
    //    O< O  O  R  O  O  O>     the oranges are free from the start but have to wait for their ring
    //    G^ Y< Y  Y  Y  Y  G^     the yellow's way out is under a green: park the green, it paints by itself next
    //    G  .  B^ P  B^ .  G      one berry is enough for its ring; the other turns into coins
    //    .  .  B  Pv B  .  .      the grape is free all along but needed last: taken early, it holds a slot to the end
    // A random player fails 5% of the time, always on the outer ring, with the rack full of colours that have to wait.
    { designed: true, band: 'easy', target: [0.03, 0.1], cols: 7, rows: 5, slots: 6, tip: 'tipStrip' },
    { designed: true, band: 'easy', target: [0.08, 0.25], cols: 7, slots: 6 },
    { designed: true, band: 'normal', target: [0.25, 0.4], cols: 7, slots: 6, cross: 0.5, intro: 'cross' },
    { designed: true, band: 'normal', target: [0.4, 0.55], cols: 7, slots: 6, cross: 0.5 },
    { designed: true, band: 'hard', target: [0.62, 0.75], slots: 6, cross: 0.5 },
    { designed: true, band: 'normal', target: [0.45, 0.58], cols: 7, slots: 6, cross: 0.5, mystery: 0.4, intro: 'mystery' },
    { designed: true, band: 'hard', target: [0.58, 0.7], cross: 0.5, mystery: 0.35 },
    { designed: true, band: 'hard', target: [0.68, 0.8], cross: 0.5, mystery: 0.35 },
    { designed: true, band: 'hard', target: [0.65, 0.78], cross: 0.5, mystery: 0.3, rotate: 2, intro: 'rotate' },
    { designed: true, band: 'super', target: [0.86, 0.95], cross: 0.5, mystery: 0.4, rotate: 3 },
    // levels 12-17: the mechanics again on bigger boxes, then colour mixing
    { band: 'normal', cols: 7, mystery: 0.4 },
    { band: 'hard', mystery: 0.35, cross: 0.5 },
    { band: 'normal', cols: 7, rotate: 2 },
    { band: 'hard', rotate: 3, cross: 0.5 },
    { band: 'hard', cols: 7, mix: true, slack: 0.7, intro: 'mix' },
    { band: 'hard', mix: true, slack: 0.4 },
    // levels 18-31 combine the mechanics
    { band: 'normal', cross: 0.5 },
    { band: 'normal', mystery: 0.35 },
    { band: 'normal', rotate: 2 },
    { band: 'hard', cross: 0.5, mystery: 0.3 },
    { band: 'normal' },
    { band: 'hard', rotate: 2, mystery: 0.3 },
    { band: 'normal', cross: 0.6 },
    { band: 'normal', mystery: 0.4 },
    { band: 'hard', rotate: 2, cross: 0.5 },
    { band: 'normal' },
    { band: 'normal', mystery: 0.35 },
    { band: 'hard', cross: 0.5, rotate: 2 },
    { band: 'normal', mystery: 0.3, cross: 0.4 },
    { band: 'hard', cols: 7, mix: true, slack: 0.5 }
  ].map((l, i) => Object.assign({}, BASE, { pic: ALBUM_ORDER[i] }, l));
  const MIX_PICS = new Set(['candy', 'cake', 'violet']);
  // The rainbow went in as level 2 after every other level was made and baked. It only plays once (it is there to
  // show the ring rule), so later laps go round the other 30 pictures. Every level after it keeps its old index for
  // its lap settings and generator seeds: it is exactly the level it was, one number higher, and a re-bake
  // (tools/levels.html) still gives the same levels.
  const LAP = ALBUM_ORDER.filter(k => k !== 'rainbow');
  const oldIndex = idx => (idx > 1 ? idx - 1 : idx);

  function levelCfg(idx) {
    if (idx < LEVELS.length) return LEVELS[idx];
    const k = oldIndex(idx);
    const pic = LAP[k % LAP.length];
    const hard = k % 3 === 1;
    // second lap and beyond: same pictures, full-size boards, keep each picture's tuned rack size
    const cfg = Object.assign({}, BASE, { pic, band: hard ? 'hard' : 'normal', slots: LEVELS[ALBUM_ORDER.indexOf(pic)].slots });
    const roll = k % 4;
    if (roll === 0) cfg.cross = 0.4;
    if (roll === 1) cfg.mystery = 0.3;
    if (roll === 2) cfg.rotate = 2;
    if (MIX_PICS.has(pic)) { cfg.mix = true; cfg.slack = 0.5; cfg.band = 'hard'; cfg.cols = 7; }
    return cfg;
  }
  function mechanicsOf(cfg) {
    const m = [];
    if (cfg.cross) m.push('cross');
    if (cfg.mystery) m.push('mystery');
    if (cfg.rotate) m.push('rotate');
    if (cfg.mix) m.push('mix');
    return m;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rngInt(r, n) { return Math.floor(r() * n); }

  function picInfo(key) {
    const p = PICS[key];
    const h = p.rows.length, w = p.rows[0].length;
    const cells = new Array(w * h);
    const need = {};
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = p.rows[y][x];
      cells[y * w + x] = c;
      need[c] = (need[c] || 0) + 1;
    }
    const layer = new Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const x = i % w, y = (i / w) | 0;
      layer[i] = Math.min(x, y, w - 1 - x, h - 1 - y);
    }
    const byColor = {};
    for (const c of Object.keys(need)) byColor[c] = [];
    for (let i = 0; i < w * h; i++) byColor[cells[i]].push(i);
    for (const c of Object.keys(byColor)) byColor[c].sort((a, b) => layer[a] - layer[b] || a - b);
    const rings = Math.max.apply(null, layer) + 1;
    const ringSize = new Array(rings).fill(0);
    for (let i = 0; i < w * h; i++) ringSize[layer[i]]++;
    return { key, name: p.name, en: p.en, w, h, cells, need, layer, byColor, rings, ringSize, total: w * h };
  }

  // Reverse construction: each new hose needs a clear exit against the hoses already placed,
  // so removing hoses in reverse placement order is always possible. A new hose may bridge
  // straight across the middle of an older hose (two layers); the older one is then covered.
  function genBoard(cfg, r) {
    const { cols, rows } = cfg;
    const N = cols * rows;
    const occ = new Int16Array(N).fill(-1);   // layer 0
    const occ2 = new Int16Array(N).fill(-1);  // layer 1 (bridges)
    const hoses = [];
    let filled = 0;
    const target = Math.floor(N * cfg.density);
    const crossP = cfg.cross || 0;
    const inb = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
    const free = i => occ[i] === -1 && occ2[i] === -1;
    const rayClear = (hx, hy, d) => {
      const ray = new Set();
      let x = hx + DIRS[d][0], y = hy + DIRS[d][1];
      while (inb(x, y)) { const i = y * cols + x; if (!free(i)) return null; ray.add(i); x += DIRS[d][0]; y += DIRS[d][1]; }
      return ray;
    };
    const place = (body, d, covers) => {
      const id = hoses.length;
      const rev = body.slice().reverse(); // tail .. head
      rev.forEach(c => { if (c[2]) occ2[c[1] * cols + c[0]] = id; else occ[c[1] * cols + c[0]] = id; });
      for (const j of covers) hoses[j].coveredBy.push(id);
      hoses.push({ id, cells: rev.map(c => [c[0], c[1]]), layers: rev.map(c => c[2]), dir: d, len: rev.length, coveredBy: [] });
      filled += rev.length - covers.length;
    };
    // a straight "bridge" hose laid across the middle of an older straight segment
    const tryBridge = () => {
      const cands = [];
      for (const hj of hoses) {
        for (let k = 1; k < hj.cells.length - 1; k++) {
          if (hj.layers[k]) continue;
          const m = hj.cells[k], a = hj.cells[k - 1], b = hj.cells[k + 1];
          const mi = m[1] * cols + m[0];
          if (occ2[mi] !== -1 || occ[mi] !== hj.id) continue;
          const vertical = a[0] === m[0] && b[0] === m[0], horizontal = a[1] === m[1] && b[1] === m[1];
          if (!vertical && !horizontal) continue;
          for (const d of vertical ? [1, 3] : [0, 2]) cands.push({ j: hj.id, m, d });
        }
      }
      while (cands.length) {
        const c = cands.splice(rngInt(r, cands.length), 1)[0];
        const dx = DIRS[c.d][0], dy = DIRS[c.d][1];
        const hx = c.m[0] + dx, hy = c.m[1] + dy, tx = c.m[0] - dx, ty = c.m[1] - dy;
        if (!inb(hx, hy) || !inb(tx, ty) || !free(hy * cols + hx) || !free(ty * cols + tx)) continue;
        const ray = rayClear(hx, hy, c.d);
        if (!ray) continue;
        const body = [[hx, hy, 0], [c.m[0], c.m[1], 1], [tx, ty, 0]];
        const inBody = new Set([hy * cols + hx, c.m[1] * cols + c.m[0], ty * cols + tx]);
        let cx = tx, cy = ty;
        const extra = rngInt(r, 3);
        for (let e = 0; e < extra; e++) {
          const opts = [];
          for (let k = 0; k < 4; k++) {
            const ux = cx + DIRS[k][0], uy = cy + DIRS[k][1], ui = uy * cols + ux;
            if (inb(ux, uy) && free(ui) && !inBody.has(ui) && !ray.has(ui)) opts.push([ux, uy]);
          }
          if (!opts.length) break;
          const o = opts[rngInt(r, opts.length)];
          body.push([o[0], o[1], 0]); inBody.add(o[1] * cols + o[0]); cx = o[0]; cy = o[1];
        }
        place(body, c.d, [c.j]);
        return true;
      }
      return false;
    };
    for (let att = 0; att < 4000 && filled < target; att++) {
      if (crossP && hoses.length >= 3 && r() < crossP && tryBridge()) continue;
      const hx = rngInt(r, cols), hy = rngInt(r, rows);
      if (!free(hy * cols + hx)) continue;
      const d = rngInt(r, 4);
      const dx = DIRS[d][0], dy = DIRS[d][1];
      let x = hx + dx, y = hy + dy, ok = true;
      const ray = new Set();
      while (inb(x, y)) {
        const i = y * cols + x;
        if (!free(i)) { ok = false; break; }
        ray.add(i); x += dx; y += dy;
      }
      if (!ok) continue;
      const nx = hx - dx, ny = hy - dy;
      if (!inb(nx, ny) || !free(ny * cols + nx)) continue;
      const L = cfg.lmin + rngInt(r, cfg.lmax - cfg.lmin + 1);
      const body = [[hx, hy, 0], [nx, ny, 0]];
      const inBody = new Set([hy * cols + hx, ny * cols + nx]);
      let cx = nx, cy = ny, pdx = -dx, pdy = -dy, crossings = 0;
      const covers = [];
      while (body.length < L) {
        const opts = [];
        let wsum = 0;
        for (let k = 0; k < 4; k++) {
          const ex = DIRS[k][0], ey = DIRS[k][1];
          const tx = cx + ex, ty = cy + ey;
          if (!inb(tx, ty)) continue;
          const ti = ty * cols + tx;
          if (inBody.has(ti) || ray.has(ti)) continue;
          if (free(ti)) {
            const w = (ex === pdx && ey === pdy) ? 1.4 : 1;
            opts.push({ tx, ty, ex, ey, w }); wsum += w;
          } else if (crossP && crossings < 2 && body.length <= L - 2 && occ2[ti] === -1) {
            // bridge: tx,ty is the middle of a straight segment of an older hose, perpendicular to e
            const j = occ[ti], hj = hoses[j];
            const kk = hj.cells.findIndex(c => c[0] === tx && c[1] === ty);
            if (kk <= 0 || kk >= hj.cells.length - 1) continue;
            const a = hj.cells[kk - 1], b = hj.cells[kk + 1];
            const straightPerp = ex !== 0 ? (a[0] === tx && b[0] === tx) : (a[1] === ty && b[1] === ty);
            if (!straightPerp) continue;
            const ux = tx + ex, uy = ty + ey;
            if (!inb(ux, uy)) continue;
            const ui = uy * cols + ux;
            if (!free(ui) || inBody.has(ui) || ray.has(ui)) continue;
            const w = 10 * crossP;
            opts.push({ tx, ty, ex, ey, w, cross: j, ux, uy }); wsum += w;
          }
        }
        if (!opts.length) break;
        let pick = r() * wsum, o = opts[0];
        for (const op of opts) { pick -= op.w; if (pick <= 0) { o = op; break; } }
        if (o.cross !== undefined) {
          body.push([o.tx, o.ty, 1]); inBody.add(o.ty * cols + o.tx);
          body.push([o.ux, o.uy, 0]); inBody.add(o.uy * cols + o.ux);
          covers.push(o.cross); crossings++;
          cx = o.ux; cy = o.uy;
        } else {
          body.push([o.tx, o.ty, 0]); inBody.add(o.ty * cols + o.tx);
          cx = o.tx; cy = o.ty;
        }
        pdx = o.ex; pdy = o.ey;
      }
      if (body.length < cfg.lmin) continue;
      place(body, d, covers);
    }
    return { occ, occ2, hoses };
  }

  // Needs that the board must supply. With mixing, secondary colours come from their two primaries.
  function boardNeeds(pic, cfg) {
    const need = {};
    for (const c of Object.keys(pic.need)) {
      if (cfg.mix && MIX_PARTS[c]) {
        const half = Math.ceil(pic.need[c] / 2);
        for (const p of MIX_PARTS[c]) need[p] = (need[p] || 0) + half;
      } else need[c] = (need[c] || 0) + pic.need[c];
    }
    return need;
  }

  function assignColors(hoses, need, total, cfg, r) {
    const colors = Object.keys(need);
    if (hoses.length < colors.length) return null;
    const H = hoses.reduce((a, h) => a + h.len, 0);
    let k = total * (1 + cfg.slack) / H;
    for (let tries = 0; tries < 14; tries++, k *= 1.07) {
      const paint = hoses.map(h => Math.max(1, Math.round(h.len * k)));
      const deficit = Object.assign({}, need);
      const color = new Array(hoses.length).fill(null);
      // jitter is drawn once per hose, so the comparator is consistent and the result does not depend on
      // how the engine's sort happens to call it (a random comparator gave different levels for one seed)
      const j1 = hoses.map(() => (r() - 0.5) * 1.5);
      const bySize = hoses.map(h => h.id).sort((a, b) => (paint[a] + j1[a]) - (paint[b] + j1[b]) || a - b);
      const smallFirst = colors.slice().sort((a, b) => need[a] - need[b]);
      let p = 0;
      for (const c of smallFirst) { const id = bySize[p++]; color[id] = c; deficit[c] -= paint[id]; }
      const j2 = hoses.map(() => (r() - 0.5) * 2);
      const rest = bySize.slice(p).sort((a, b) => (paint[b] + j2[b]) - (paint[a] + j2[a]) || a - b);
      for (const id of rest) {
        const pos = colors.filter(c => deficit[c] > 0);
        let c;
        if (pos.length) {
          let tot = pos.reduce((a, c2) => a + deficit[c2], 0), pick = r() * tot;
          c = pos[0];
          for (const c2 of pos) { pick -= deficit[c2]; if (pick <= 0) { c = c2; break; } }
        } else {
          let tot = colors.reduce((a, c2) => a + need[c2], 0), pick = r() * tot;
          c = colors[0];
          for (const c2 of colors) { pick -= need[c2]; if (pick <= 0) { c = c2; break; } }
        }
        color[id] = c; deficit[c] -= paint[id];
      }
      if (colors.every(c => deficit[c] <= 0)) return { color, paint, k };
    }
    return null;
  }

  function makeLevel(cfg, board, col, pic, r, meta) {
    const n = board.hoses.length;
    const hoses = board.hoses.map(h => ({
      id: h.id, cells: h.cells, layers: h.layers, dir: h.dir, len: h.len, coveredBy: h.coveredBy.slice(),
      color: col.color[h.id], paint: col.paint[h.id], mystery: false, rot: null
    }));
    const L = { cfg, cols: cfg.cols, rows: cfg.rows, slots: cfg.slots, pic, hoses, occ0: board.occ, occ1: board.occ2, k: col.k, mix: !!cfg.mix, meta: meta || {} };
    // rotating nozzles: phase chosen so the reverse-placement order still works
    if (cfg.rotate) {
      const cand = hoses.filter(h => h.id < n - 1).map(h => h.id);
      for (let t = 0; t < cfg.rotate && cand.length; t++) {
        const id = cand.splice(rngInt(r, cand.length), 1)[0], h = hoses[id], d = h.dir;
        const dirs = [d, (d + 1) % 4, (d + 3) % 4];
        const step = n - 1 - id;
        h.rot = { dirs, phase: ((-step) % 3 + 3) % 3 };
      }
    }
    // mystery hoses: only ones that start blocked, so the reveal happens during play
    if (cfg.mystery) {
      const s = newState(L);
      const blocked = hoses.filter(h => !rayCheck(L, s, h.id).free || isCovered(L, s, h.id)).map(h => h.id);
      let m = Math.round(n * cfg.mystery);
      while (m-- > 0 && blocked.length) hoses[blocked.splice(rngInt(r, blocked.length), 1)[0]].mystery = true;
    }
    return L;
  }

  function newState(L) {
    return {
      removed: new Uint8Array(L.hoses.length), pulls: 0,
      occ: Int16Array.from(L.occ0), occ2: Int16Array.from(L.occ1),
      slots: new Array(L.slots).fill(null),
      painted: new Uint8Array(L.pic.total),
      remaining: Object.assign({}, L.pic.need),
      left: L.pic.total, ring: 0, ringLeft: L.pic.ringSize.slice()
    };
  }
  function cloneState(s) {
    return {
      removed: s.removed.slice(), pulls: s.pulls, occ: s.occ.slice(), occ2: s.occ2.slice(),
      slots: s.slots.map(x => x ? { color: x.color, paint: x.paint, ready: x.ready || 0 } : null),
      painted: s.painted.slice(), remaining: Object.assign({}, s.remaining), left: s.left,
      ring: s.ring, ringLeft: s.ringLeft.slice()
    };
  }

  function curDir(L, s, id) {
    const h = L.hoses[id];
    return h.rot ? h.rot.dirs[(h.rot.phase + s.pulls) % h.rot.dirs.length] : h.dir;
  }
  function isCovered(L, s, id) {
    for (const t of L.hoses[id].coveredBy) if (!s.removed[t]) return true;
    return false;
  }
  function coverOf(L, s, id) {
    for (const t of L.hoses[id].coveredBy) if (!s.removed[t]) return t;
    return -1;
  }
  // {free:true} or {free:false, dist, blocker}
  function rayCheck(L, s, id) {
    const h = L.hoses[id];
    const head = h.cells[h.cells.length - 1];
    const d = curDir(L, s, id), dx = DIRS[d][0], dy = DIRS[d][1];
    let x = head[0] + dx, y = head[1] + dy, dist = 1;
    while (x >= 0 && y >= 0 && x < L.cols && y < L.rows) {
      const i = y * L.cols + x;
      const o = s.occ2[i] !== -1 ? s.occ2[i] : s.occ[i];
      if (o !== -1) return { free: false, dist, blocker: o };
      x += dx; y += dy; dist++;
    }
    return { free: true, dist };
  }
  function landingSlot(s) { return s.slots.indexOf(null); }

  // a colour is still useful if the picture needs it, or (mixing) a secondary it makes is still needed
  function useful(L, s, c) {
    if (s.remaining[c] > 0) return true;
    if (L.mix && MIXES_OF[c]) for (const m of MIXES_OF[c]) if (s.remaining[m] > 0) return true;
    return false;
  }
  function canPull(L, s, id) {
    if (!useful(L, s, L.hoses[id].color)) return true;
    return landingSlot(s) >= 0;
  }

  // Remove a hose from the board and hang it on the rack. Returns the event.
  function pull(L, s, id, readyAt) {
    const h = L.hoses[id];
    const discard = !useful(L, s, h.color);
    const i = landingSlot(s);
    if (!discard && i < 0) return null;
    h.cells.forEach((c, k) => { const ci = c[1] * L.cols + c[0]; if (h.layers[k]) { if (s.occ2[ci] === id) s.occ2[ci] = -1; } else if (s.occ[ci] === id) s.occ[ci] = -1; });
    s.removed[id] = 1; s.pulls++;
    if (discard) return { slot: -1, discarded: true };
    const nb = [i - 1, i + 1].filter(j => j >= 0 && j < s.slots.length && s.slots[j]);
    for (const j of nb) {
      if (s.slots[j].color === h.color) {
        s.slots[j].paint += h.paint;
        s.slots[j].ready = Math.max(s.slots[j].ready || 0, readyAt || 0);
        return { slot: j, landed: i, merged: true };
      }
    }
    if (L.mix) {
      // mixAny: a primary mixes with the nearest compatible primary anywhere on the rack
      const pool = L.cfg.mixAny
        ? s.slots.map((sl, j) => j).filter(j => s.slots[j]).sort((a, b) => Math.abs(a - i) - Math.abs(b - i) || a - b)
        : nb;
      for (const j of pool) {
        const m = MIX[h.color + s.slots[j].color];
        if (m && s.remaining[m] > 0) {
          s.slots[j].color = m; s.slots[j].paint += h.paint;
          s.slots[j].ready = Math.max(s.slots[j].ready || 0, readyAt || 0);
          return { slot: j, landed: i, mixed: m };
        }
      }
    }
    s.slots[i] = { color: h.color, paint: h.paint, ready: readyAt || 0 };
    return { slot: i, landed: i, merged: false };
  }

  function exposed(pic, painted, c) {
    const w = pic.w, h = pic.h, x = c % w, y = (c / w) | 0;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return true;
    return painted[c - 1] || painted[c + 1] || painted[c - w] || painted[c + w];
  }
  // Ring rule: only the outermost ring that still has unpainted cells takes paint.
  function bestCell(L, s, color) {
    const list = L.pic.byColor[color];
    if (!list) return -1;
    if (L.rule === 'adjacent') {
      for (const c of list) if (!s.painted[c] && exposed(L.pic, s.painted, c)) return c;
      return -1;
    }
    for (const c of list) {
      if (s.painted[c]) continue;
      return L.pic.layer[c] === s.ring ? c : -1;
    }
    return -1;
  }
  function markPainted(L, s, c) {
    s.painted[c] = 1; s.left--;
    s.ringLeft[L.pic.layer[c]]--;
    while (s.ring < s.ringLeft.length && s.ringLeft[s.ring] === 0) s.ring++;
  }
  function hasDemand(L, s, color) { return bestCell(L, s, color) >= 0; }

  // One tick: every ready slot paints one cell. Returns events.
  function paintStep(L, s, now) {
    const ev = [];
    for (let i = 0; i < s.slots.length; i++) {
      const sl = s.slots[i];
      if (!sl || (now !== undefined && sl.ready > now)) continue;
      const c = bestCell(L, s, sl.color);
      if (c < 0) continue;
      markPainted(L, s, c); s.remaining[sl.color]--; sl.paint--;
      ev.push({ slot: i, cell: c, color: sl.color });
      if (sl.paint <= 0) { s.slots[i] = null; ev.push({ slot: i, empty: true, color: sl.color }); }
    }
    for (let i = 0; i < s.slots.length; i++) {
      const sl = s.slots[i];
      if (sl && !useful(L, s, sl.color) && (now === undefined || sl.ready <= now)) {
        s.slots[i] = null; ev.push({ slot: i, drained: true, color: sl.color });
      }
    }
    return ev;
  }
  function resolve(L, s) { let n = 0; while (paintStep(L, s).length) n++; return n; }

  function pullable(L, s, id) {
    return !s.removed[id] && !isCovered(L, s, id) && rayCheck(L, s, id).free && canPull(L, s, id);
  }
  function options(L, s) {
    const out = [];
    for (let id = 0; id < L.hoses.length; id++) if (pullable(L, s, id)) out.push(id);
    return out;
  }

  function botRun(L, r) {
    const s = newState(L);
    for (let step = 0; step < 400; step++) {
      resolve(L, s);
      if (s.left === 0) return true;
      const opts = options(L, s);
      if (!opts.length) return false;
      pull(L, s, opts[rngInt(r, opts.length)]);
    }
    return false;
  }
  function failRate(L, runs, seed) {
    const r = mulberry32(seed);
    let fail = 0;
    for (let i = 0; i < runs; i++) if (!botRun(L, r)) fail++;
    return fail / runs;
  }

  // DFS with memo on the removed set. Returns a solution (hose ids), false, or null if capped.
  function solve(L, cap, start) {
    cap = cap || 30000;
    const failed = new Set();
    let nodes = 0;
    const path = [];
    function key(s) { let k = ''; for (let i = 0; i < s.removed.length; i++) k += s.removed[i]; return k; }
    function score(s, id) {
      const h = L.hoses[id];
      if (!useful(L, s, h.color)) return 3;
      let sc = hasDemand(L, s, h.color) ? 2 : 0;
      const i = landingSlot(s);
      if (i >= 0) {
        for (const j of [i - 1, i + 1]) {
          const sl = j >= 0 && j < s.slots.length ? s.slots[j] : null;
          if (!sl) continue;
          if (sl.color === h.color) sc += 1.5;
          else if (L.mix && MIX[h.color + sl.color] && s.remaining[MIX[h.color + sl.color]] > 0) sc += 1.2;
        }
      }
      return sc;
    }
    function dfs(s) {
      if (++nodes > cap) throw new Error('cap');
      resolve(L, s);
      if (s.left === 0) return true;
      const k = key(s);
      if (failed.has(k)) return false;
      const opts = options(L, s).sort((a, b) => score(s, b) - score(s, a));
      for (const id of opts) {
        const t = cloneState(s);
        pull(L, t, id);
        path.push(id);
        if (dfs(t)) return true;
        path.pop();
      }
      failed.add(k);
      return false;
    }
    try { return dfs(start ? cloneState(start) : newState(L)) ? path.slice() : false; } catch (e) { return null; }
  }

  function hashSeed(a, b) {
    let h = 2166136261 ^ a;
    h = Math.imul(h ^ (b + 0x9e3779b9), 16777619);
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return h >>> 0;
  }

  function generate(cfg, seed) {
    const pic = picInfo(cfg.pic);
    const r = mulberry32(seed);
    const board = genBoard(cfg, r);
    const need = boardNeeds(pic, cfg);
    const col = assignColors(board.hoses, need, pic.total, cfg, r);
    if (!col) return null;
    // crossing levels must show the mechanic at least twice
    if (cfg.cross && board.hoses.filter(h => h.coveredBy.length).length < 2) return null;
    return makeLevel(cfg, board, col, pic, r, { seed });
  }

  function buildLevel(idx, opts) {
    opts = opts || {};
    const cfg = levelCfg(idx);
    const band = cfg.target || BANDS[cfg.band];
    const runs = opts.runs || 40;
    const maxAttempts = opts.attempts || (cfg.cross ? 120 : 60);
    const t0 = Date.now();
    let best = null, tried = 0;
    for (let a = 0; a < maxAttempts; a++) {
      tried++;
      const seed = hashSeed(oldIndex(idx) + 1, a);
      const L = generate(cfg, seed);
      if (!L) continue;
      L.meta.attempt = a;
      const fr = failRate(L, runs, seed ^ 0xabcdef);
      const dist = fr < band[0] ? band[0] - fr : fr > band[1] ? fr - band[1] : 0;
      if (best && dist >= best.dist) continue;
      const sol = solve(L);
      if (!sol) continue;
      best = { L, fr, dist, sol };
      if (dist === 0) break;
      if (opts.budgetMs && Date.now() - t0 > opts.budgetMs) break;
    }
    if (!best) return null;
    Object.assign(best.L.meta, { failRate: best.fr, band: cfg.band, ms: Date.now() - t0, tried, solution: best.sol, mechanics: mechanicsOf(cfg), intro: cfg.intro || null });
    return best.L;
  }

  // ---------- baked levels: the exact, validated level stored as data (see tools/levels.html) ----------
  // hose: [colour, paint, dir, cells "xyxy…", layers "01…", coveredBy ids, mystery 0/1, rot [d0,d1,d2,phase] | 0]
  function levelToData(L) {
    return {
      c: [L.cols, L.rows, L.slots, L.pic.key, L.mix ? 1 : 0],
      fr: Math.round((L.meta.failRate || 0) * 100),
      h: L.hoses.map(h => [h.color, h.paint, h.dir, h.cells.map(c => '' + c[0] + c[1]).join(''), h.layers.join(''), h.coveredBy.slice(),
        h.mystery ? 1 : 0, h.rot ? h.rot.dirs.concat([h.rot.phase]) : 0])
    };
  }
  function levelFromData(idx, d) {
    const cfg = levelCfg(idx);
    if (!d || !d.c || d.c[0] !== cfg.cols || d.c[1] !== cfg.rows || d.c[2] !== cfg.slots || d.c[3] !== cfg.pic || !!d.c[4] !== !!cfg.mix) return null;
    const pic = picInfo(cfg.pic), N = cfg.cols * cfg.rows;
    const occ0 = new Int16Array(N).fill(-1), occ1 = new Int16Array(N).fill(-1);
    const hoses = d.h.map((a, id) => {
      const cells = [], layers = [];
      for (let k = 0; k < a[3].length; k += 2) {
        const x = +a[3][k], y = +a[3][k + 1], ly = +a[4][k / 2];
        cells.push([x, y]); layers.push(ly);
        (ly ? occ1 : occ0)[y * cfg.cols + x] = id;
      }
      return { id, cells, layers, dir: a[2], len: cells.length, coveredBy: a[5].slice(), color: a[0], paint: a[1], mystery: !!a[6],
        rot: a[7] ? { dirs: a[7].slice(0, 3), phase: a[7][3] } : null };
    });
    return { cfg, cols: cfg.cols, rows: cfg.rows, slots: cfg.slots, pic, hoses, occ0, occ1, k: 0, mix: !!cfg.mix,
      meta: { baked: true, failRate: d.fr / 100, band: cfg.band, mechanics: mechanicsOf(cfg), intro: cfg.intro || null } };
  }

  root.JT = root.JT || {};
  root.JT.Core = {
    DIRS, PALETTE, MIX, MIX_PARTS, PICS, ALBUM, ALBUM_ORDER, LEVELS, BANDS, MECH, levelCfg, mechanicsOf, picInfo, mulberry32, hashSeed,
    genBoard, boardNeeds, assignColors, makeLevel, generate, newState, cloneState, curDir, isCovered, coverOf, rayCheck,
    landingSlot, useful, canPull, pull, exposed, bestCell, markPainted, hasDemand, paintStep, resolve, pullable, options,
    botRun, failRate, solve, buildLevel, levelToData, levelFromData
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
