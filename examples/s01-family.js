// s01 — the family photograph. Four stiff figures in front of painted rose paper; they hold still for the camera,
// but the bride's eyes drift to us, the masked man's head slowly tilts, someone blinks. Flash: the photo is taken.
// Look rules: bold near-black outlines, flat fills + hard-edged darker cel tones, one big soft shadow on the wall.
import { W, H, TAU, clamp, lerp, seg, ease, easeInOut, hash, cam, shake, rgba, mix, layer } from '../engine.js';
import { INK, LW, shape, toPath, line, curve, smooth, tone, brush, hairCap, houndstooth, tweed, floral, photoVignette, paperTooth, viewport, wallShadow, face, hand } from './kit.js';

const SKIN = '#e3ddd0', SHADE = '#b9b2a4';
const blinkAt = (t, list, d = .16) => { let o = 1; for (const b of list) { const k = Math.abs(t - b) / d; if (k < 1) o = Math.min(o, k); } return o; };
const breathe = (t, ph) => Math.sin(t * 1.6 + ph) * .5 + .5;
const btn = (c, x, y, r, col = '#ece6d8') => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.lineWidth = LW * .45; c.strokeStyle = INK; c.stroke(); c.fillStyle = INK; c.beginPath(); c.arc(x - r * .3, y, r * .14, 0, TAU); c.arc(x + r * .3, y, r * .14, 0, TAU); c.fill(); };

function topHatMan(c, t) {
  const hx = 600, hy = 292;
  c.save(); c.translate(0, -breathe(t, 0) * 1.2);
  // frock coat: houndstooth, arms read by sleeve seams, hard tone on the shadow side
  const coat = shape(c, smooth([[410, 1110], [418, 560], [440, 470], [500, 420], [560, 396], [640, 396], [700, 420], [760, 470], [782, 560], [790, 1110]], 4, false), c.createPattern(houndstooth('#4a4541', '#2e2a27', 9), 'repeat'), { seed: 11 });
  tone(c, coat, [[700, 380], [800, 380], [800, 1120], [710, 1120], [722, 600]], '#000', .28);
  tone(c, coat, [[400, 380], [452, 380], [446, 1120], [400, 1120]], '#000', .15);
  brush(c, [[478, 470], [470, 700], [476, 1000]], LW * .8); brush(c, [[722, 470], [730, 700], [724, 1000]], LW * .8);   // sleeve seams
  // shirt + red waistcoat
  shape(c, [[556, 398], [644, 398], [636, 720], [600, 780], [564, 720]], '#efebe2', { seed: 12 });
  const wc = shape(c, [[566, 540], [634, 540], [644, 660], [600, 716], [556, 660]], '#b5503f', { seed: 13 });
  tone(c, wc, [[606, 530], [650, 530], [650, 720], [606, 720]], '#7e2e22', .6);
  for (let k = 0; k < 3; k++) btn(c, 600, 572 + k * 40, 6.5, '#ece6d8');
  // lapels (darker, satin-faced)
  for (const m of [-1, 1]) { const lp = shape(c, [[600 + m * 44, 398], [600 + m * 74, 410], [600 + m * 92, 520], [600 + m * 62, 548], [600 + m * 74, 610], [600 + m * 34, 740], [600 + m * 28, 540]], '#2a2624', { seed: 14 + m }); tone(c, lp, [[600 + m * 70, 400], [600 + m * 100, 400], [600 + m * 100, 700], [600 + m * 60, 700]], '#000', .3); }
  // cravat: big floppy bow + long tails, cel-toned folds
  for (const m of [-1, 1]) { const w = shape(c, smooth([[600, 436], [600 + m * 30, 412], [600 + m * 68, 418], [600 + m * 70, 450], [600 + m * 34, 462]], 4), '#f2eee5', { seed: 16 + m }); tone(c, w, smooth([[600, 440], [600 + m * 40, 450], [600 + m * 66, 448], [600 + m * 50, 466], [600 + m * 20, 462]], 3), '#c9c3b6', .9); brush(c, [[600 + m * 14, 438], [600 + m * 40, 428], [600 + m * 56, 432]], LW * .4); }
  for (const m of [-1, 1]) { const tl = shape(c, smooth([[600 + m * 4, 448], [600 + m * 22, 520], [600 + m * 36, 600], [600 + m * 18, 604], [600 + m * 6, 520]], 3), '#f2eee5', { seed: 18 + m }); tone(c, tl, [[600 + m * 20, 450], [600 + m * 40, 450], [600 + m * 40, 610], [600 + m * 24, 610]], '#c9c3b6', .9); }
  shape(c, smooth([[588, 426], [612, 426], [616, 448], [584, 448]], 2), '#f2eee5', { seed: 20 });
  for (const m of [-1, 1]) shape(c, [[600 + m * 4, 400], [600 + m * 42, 386], [600 + m * 36, 420]], '#f5f2ea', { seed: 21 + m });   // collar wings
  // head
  c.save(); c.translate(hx, hy); c.rotate(Math.sin(t * .7) * .008); c.scale(1.28, 1.28);
  for (const m of [-1, 1]) { const sb = shape(c, smooth([[m * 46, -66], [m * 64, -60], [m * 66, 0], [m * 56, 30], [m * 50, -20]], 3), '#5d3c26', { seed: 22 + m }); tone(c, sb, [[m * 56, -70], [m * 70, -70], [m * 70, 40], [m * 58, 40]], '#3a2416', .8); }
  face(c, { fw: 54, fh: 70, skin: SKIN, shade: SHADE, open: .8 * blinkAt(t, [1.3, 3.9]), look: [lerp(0, .45, ease(seg(t, 2.4, 2.9))), .05], brow: -.25, jaw: .85, neck: 1.22, lips: '#a8675a', seed: 22, iris: '#6f6a64' });
  hairCap(c, 54, 70, '#5d3c26', '#3a2416', { part: null, line: .78, strands: 4, seed: 27 });
  // handlebar moustache with lighter strands
  const mo = shape(c, smooth([[0, 34], [-20, 28], [-44, 34], [-62, 26], [-72, 10], [-64, 18], [-48, 44], [-20, 46], [0, 40], [20, 46], [48, 44], [64, 18], [72, 10], [62, 26], [44, 34], [20, 28]], 3), '#3e2a1d', { seed: 23 });
  tone(c, mo, [[-80, 38], [80, 38], [80, 60], [-80, 60]], '#1e130b', .7);
  for (let k = -4; k <= 4; k++) if (k) brush(c, [[k * 8, 33], [k * 11, 40]], 1.6, { col: '#7a5a42' });
  // top hat: crown with vertical sheen tone, light band, brim with underside tone
  c.translate(0, 46);
  const crown = shape(c, [[-60, -232], [60, -232], [66, -112], [-66, -112]], '#2c2826', { seed: 24 });
  tone(c, crown, [[-44, -240], [-26, -240], [-28, -100], [-46, -100]], '#4a4542', .9); tone(c, crown, [[30, -240], [70, -240], [70, -100], [34, -100]], '#000', .35);
  shape(c, [[-65, -140], [65, -140], [66, -114], [-66, -114]], '#d9d4ca', { seed: 25 });
  const brim = shape(c, smooth([[-104, -104], [-70, -118], [70, -118], [104, -104], [96, -92], [66, -98], [-66, -98], [-96, -92]], 4), '#252220', { seed: 26 });
  tone(c, brim, [[-110, -100], [110, -100], [110, -88], [-110, -88]], '#000', .4);
  c.restore();
  c.restore();
}

function bride(c, t) {
  const hx = 960, hy = 318;
  c.save(); c.translate(0, -breathe(t, 1.3) * 1.2);
  // back hair: shoulder-length red waves
  const hb = shape(c, smooth([[hx - 66, hy - 100], [hx, hy - 118], [hx + 68, hy - 100], [hx + 98, hy - 40], [hx + 100, hy + 30], [hx + 112, hy + 92], [hx + 84, hy + 118], [hx + 56, hy + 96], [hx - 56, hy + 96], [hx - 84, hy + 118], [hx - 112, hy + 92], [hx - 100, hy + 30], [hx - 98, hy - 40]], 4), '#b9552f', { seed: 30 });
  tone(c, hb, [[hx + 50, hy - 120], [hx + 130, hy - 120], [hx + 130, hy + 130], [hx + 70, hy + 130]], '#86341a', .9);
  // dress: white with grey cel tones
  const dress = shape(c, smooth([[858, 432], [902, 404], [1018, 404], [1062, 432], [1070, 560], [1032, 648], [1128, 1110], [792, 1110], [888, 648], [850, 560]], 5), '#ecebe6', { seed: 31 });
  tone(c, dress, [[1000, 404], [1090, 404], [1140, 1110], [1060, 1110], [1020, 660], [1030, 520]], '#c9c7bf', 1);
  for (const [x0, x1, w] of [[930, 900, 16], [968, 966, 12], [1010, 1036, 18]]) tone(c, dress, smooth([[x0 - w * .3, 660], [x0 + w * .3, 660], [x1 + w, 1110], [x1 - w, 1110]], 2), '#d3d1c9', 1);   // skirt folds
  for (const x of [930, 990, 1040]) brush(c, [[x - 10, 690], [x, 900], [x + 8, 1100]], LW * .35);
  brush(c, [[884, 650], [960, 666], [1036, 650]], LW * .8);
  brush(c, [[904, 442], [960, 516], [1016, 442]], LW * .6); brush(c, [[912, 432], [960, 488], [1008, 432]], LW * .45);
  brush(c, [[960, 520], [960, 580]], LW * .45);
  shape(c, smooth([[904, 410], [960, 446], [1016, 410], [1000, 402], [920, 402]], 4), SKIN, { seed: 32 });
  // arms + puff sleeves with gathers
  for (const m of [-1, 1]) {
    const sx = 960 + m * 94;
    const arm = shape(c, smooth([[sx - m * 18, 484], [sx + m * 20, 492], [sx + m * 30, 640], [sx + m * 32, 766], [sx + m * 6, 770], [sx - m * 8, 640], [sx - m * 22, 520]], 3), SKIN, { seed: 33 + m });
    tone(c, arm, [[sx - m * 30, 480], [sx - m * 4, 480], [sx + m * 2, 780], [sx - m * 20, 780]], SHADE, .8);
    brush(c, [[sx + m * 4, 610], [sx + m * 14, 620], [sx + m * 24, 614]], LW * .35);
    const sl = shape(c, smooth([[sx - m * 30, 420], [sx + m * 12, 404], [sx + m * 42, 452], [sx + m * 36, 512], [sx - m * 20, 516], [sx - m * 36, 470]], 5), '#f1f0eb', { seed: 35 + m });
    tone(c, sl, smooth([[sx - m * 40, 480], [sx + m * 44, 470], [sx + m * 40, 520], [sx - m * 30, 520]], 2), '#cfcdc5', 1);
    for (const k of [-18, 0, 18]) brush(c, [[sx + m * k, 488], [sx + m * (k + 2), 514]], LW * .35);
    brush(c, [[sx - m * 26, 512], [sx + m * 36, 508]], LW * .7);
    hand(c, sx + m * 19, 770, 1.15, m * .06, SKIN, { flip: m, curl: .25 });
  }
  shape(c, [[938, 360], [982, 360], [986, 410], [934, 410]], SKIN, { seed: 37 });
  // head
  c.save(); c.translate(hx, hy); c.rotate(Math.sin(t * .5 + 1) * .006); c.scale(1.28, 1.28);
  const look = [lerp(-.7, 0, easeInOut(seg(t, 1.5, 2.5))), lerp(.1, 0, ease(seg(t, 1.5, 2.5)))];
  face(c, { fw: 50, fh: 66, skin: '#e7e4dc', shade: '#c4c0b6', open: .92 * blinkAt(t, [3.3]), look, brow: .05, jaw: .3, neck: 1.12, lips: '#b45848', seed: 38, ears: false, iris: '#7b7a7a' });
  hairCap(c, 50, 66, '#b9552f', '#86341a', { part: 0, line: .66, side: 1.12, low: .3, strands: 6, seed: 47 });
  // spiral curls at the jaw
  for (const m of [-1, 1]) {
    const cx = m * 82, cy = 62, cl = shape(c, smooth([[cx - 26, cy - 20], [cx, cy - 34], [cx + 26, cy - 18], [cx + 28, cy + 14], [cx, cy + 30], [cx - 24, cy + 14]], 4), '#b9552f', { seed: 48 + m });
    tone(c, cl, [[cx + m * 4, cy - 40], [cx + m * 40, cy - 40], [cx + m * 40, cy + 40], [cx + m * 4, cy + 40]], '#86341a', .8);
    const sp = []; for (let k = 0; k <= 20; k++) { const a = k / 20 * TAU * 1.3 * m, rr = 22 - k * .9; sp.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * .9]); }
    brush(c, sp, LW * .55, { col: '#4a1a0a', taper: .7, n: 2 });
  }
  // flower crown
  for (let k = -3; k <= 3; k++) { const fx0 = k * 15, fy0 = -86 + Math.abs(k) * 5; for (let p = 0; p < 5; p++) { const a = p / 5 * TAU + k; shape(c, smooth([[fx0, fy0], [fx0 + Math.cos(a - .45) * 9, fy0 + Math.sin(a - .45) * 9], [fx0 + Math.cos(a) * 12, fy0 + Math.sin(a) * 12], [fx0 + Math.cos(a + .45) * 9, fy0 + Math.sin(a + .45) * 9]], 3), '#f4f2ec', { lw: 2.2, seed: 50 + k * 5 + p }); } c.fillStyle = '#d6ad48'; c.beginPath(); c.arc(fx0, fy0, 3.4, 0, TAU); c.fill(); }
  c.restore();
  c.restore();
}

function oldWoman(c, t) {
  const hx = 330, hy = 536;
  c.save(); c.translate(70, 0); c.translate(0, -breathe(t, 2.1) * 1.2);
  const jk = shape(c, smooth([[140, 1110], [150, 770], [194, 684], [266, 654], [394, 654], [466, 684], [508, 770], [518, 1110]], 4, false), '#7f9b7b', { seed: 60 });
  tone(c, jk, [[420, 640], [530, 640], [530, 1110], [440, 1110], [452, 780]], '#5d7a5b', 1);
  brush(c, [[212, 700], [204, 900], [210, 1100]], LW * .8);
  // striped jabot with pearl buttons
  const jb = shape(c, [[298, 664], [362, 664], [374, 1110], [286, 1110]], '#ece6d6', { seed: 61 });
  for (const dx of [-26, -14, 14, 26]) tone(c, jb, [[330 + dx - 2, 660], [330 + dx + 2, 660], [330 + dx * 1.15 + 2, 1110], [330 + dx * 1.15 - 2, 1110]], '#b9b09c', 1);
  for (let k = 0; k < 10; k++) { const y = 704 + k * 40; c.fillStyle = '#f4f0e6'; c.beginPath(); c.arc(330, y, 6, 0, TAU); c.fill(); c.lineWidth = 2.4; c.strokeStyle = INK; c.stroke(); }
  brush(c, [[298, 664], [286, 1110]], LW * .7); brush(c, [[362, 664], [374, 1110]], LW * .7);
  // high collar + yellow bow
  shape(c, [[296, 610], [364, 610], [368, 664], [292, 664]], '#ece6d6', { seed: 62 });
  for (const m of [-1, 1]) { const b = shape(c, smooth([[330, 668], [330 + m * 34, 650], [330 + m * 58, 660], [330 + m * 52, 684], [330 + m * 22, 680]], 3), '#d8b445', { seed: 63 + m }); tone(c, b, smooth([[330 + m * 20, 676], [330 + m * 56, 672], [330 + m * 50, 690], [330 + m * 20, 690]], 2), '#a8852a', 1); }
  for (const m of [-1, 1]) shape(c, smooth([[330 + m * 6, 676], [330 + m * 22, 720], [330 + m * 34, 716], [330 + m * 14, 674]], 2), '#d8b445', { seed: 66 + m });
  shape(c, smooth([[318, 662], [342, 662], [344, 682], [316, 682]], 2), '#d8b445', { seed: 68 });
  // hand to chest
  const sl = shape(c, smooth([[196, 1110], [208, 960], [246, 900], [296, 884], [306, 926], [262, 958], [250, 1110]], 3), '#7f9b7b', { seed: 69 });
  tone(c, sl, [[240, 940], [320, 920], [320, 1110], [250, 1110]], '#5d7a5b', .9);
  hand(c, 304, 860, 1.25, -2.0 + Math.sin(t * 3.1) * .015, '#8a6a52', { curl: .5, spread: .25, shade: '#5e4636' });   // gloved hand
  // head
  c.save(); c.translate(hx, hy); c.rotate(-.025 + Math.sin(t * .6 + 2) * .008); c.scale(1.28, 1.28);
  face(c, { fw: 52, fh: 64, skin: '#dcd5c6', shade: '#aaa293', open: .85 * blinkAt(t, [.7, 2.9]), look: [.15, .05], brow: -.15, jaw: .55, neck: 1.0, lips: '#a0675b', age: 1, seed: 71, iris: '#6c6863' });
  // grey hair: full waved sides puffed out over the ears, swept up under the hat
  for (const m of [-1, 1]) { const pf = shape(c, smooth([[m * 40, -70], [m * 76, -72], [m * 84, -30], [m * 72, 8], [m * 58, -20], [m * 50, -46]], 4), '#9b938a', { seed: 75 + m }); tone(c, pf, [[m * 60, -90], [m * 100, -90], [m * 100, 20], [m * 70, 20]], '#6f675e', .8); for (let k = 0; k < 4; k++) brush(c, [[m * 46, -58 + k * 14], [m * 66, -64 + k * 16], [m * 80, -48 + k * 16]], 2.6, { col: '#5a534b' }); }
  hairCap(c, 52, 64, '#9b938a', '#6f675e', { part: null, line: .8, side: 1.0, low: -.4, strands: 7, seed: 70 });
  // green hat with teal ribbon, seated on the hair
  c.save(); c.translate(0, 8);
  const hat = shape(c, smooth([[-66, -96], [-48, -146], [36, -152], [70, -116], [76, -94]], 4, false), '#2f5e52', { seed: 72 });
  tone(c, hat, [[24, -160], [90, -160], [90, -90], [30, -90]], '#1d4038', .9);
  const br = shape(c, smooth([[-98, -84], [0, -104], [96, -92], [86, -78], [0, -90], [-88, -72]], 4), '#244c42', { seed: 73 });
  const rb = shape(c, smooth([[-44, -132], [-92, -168], [-112, -146], [-88, -118], [-60, -118]], 4), '#5c9a96', { seed: 74 });
  tone(c, rb, [[-120, -150], [-80, -150], [-80, -110], [-120, -110]], '#3f7470', .9);
  brush(c, [[-52, -132], [-88, -156], [-102, -150]], 2.6);
  c.restore();
  c.restore();
  c.restore();
}

function maskedMan(c, t) {
  const hx = 1390, hy = 282;
  c.save(); c.translate(0, -breathe(t, 3.3) * 1.2);
  const suit = shape(c, smooth([[1196, 1110], [1200, 540], [1232, 450], [1300, 410], [1340, 396], [1440, 396], [1480, 410], [1548, 450], [1580, 540], [1584, 1110]], 4, false), c.createPattern(tweed('#6e4d35'), 'repeat'), { seed: 80 });
  tone(c, suit, [[1500, 390], [1600, 390], [1600, 1120], [1510, 1120], [1520, 600]], '#000', .3);
  brush(c, [[1260, 470], [1252, 760], [1258, 1100]], LW * .8); brush(c, [[1520, 470], [1528, 760], [1522, 1100]], LW * .8);
  shape(c, [[1346, 398], [1434, 398], [1424, 730], [1356, 730]], '#d8cfb8', { seed: 81 });
  for (let k = 0; k < 4; k++) btn(c, 1390, 474 + k * 62, 5.5, '#efe9dc');
  for (const m of [-1, 1]) { const lp = shape(c, [[1390 + m * 44, 398], [1390 + m * 76, 404], [1390 + m * 98, 540], [1390 + m * 66, 566], [1390 + m * 80, 620], [1390 + m * 34, 760], [1390 + m * 30, 560]], '#5b3e2a', { seed: 82 + m }); tone(c, lp, [[1390 + m * 70, 400], [1390 + m * 110, 400], [1390 + m * 110, 720], [1390 + m * 60, 720]], '#000', .25); }
  for (const y of [810, 900, 990]) btn(c, 1430, y, 10, '#c9bfae');
  shape(c, [[1470, 880], [1546, 880], [1546, 906], [1470, 906]], '#5b3e2a', { seed: 85 });
  for (const m of [-1, 1]) shape(c, [[1390 + m * 4, 400], [1390 + m * 40, 388], [1390 + m * 34, 422]], '#efe9dc', { seed: 86 + m });
  // head tilts slowly (the only one that moves its head)
  const tilt = lerp(0, .1, easeInOut(seg(t, 1.8, 4.0)));
  c.save(); c.translate(hx, hy + 80); c.rotate(tilt); c.translate(0, -80); c.scale(1.28, 1.28);
  face(c, { fw: 56, fh: 74, mask: true, neck: 1.25, open: blinkAt(t, [3.05], .12), look: [lerp(.6, 0, ease(seg(t, .6, 1.6))), .1], seed: 88 });
  hairCap(c, 56, 74, '#2a221e', '#120e0c', { part: -18, line: .9, side: 1.06, low: -.3, strands: 4, seed: 89 });
  c.restore();
  c.restore();
}

function family(c, t, s) {
  const lt = s.lt, z = lerp(1, 1.06, easeInOut(seg(lt, 0, 5))), [sx, sy] = shake(t, { amp: .8, freq: .3, seed: 2 });
  c.save(); cam(c, { x: 960 + sx, y: 520 + sy, z });
  c.drawImage(floral({ seed: 1 }), 0, 0);
  c.restore();
  // characters in their own layer: soft shadow on the wall first, then the figures
  const L = layer('fam');
  L.save(); cam(L, { x: 960 + sx, y: 520 + sy, z }); L.translate(960, 1080 + 300); L.scale(1.22, 1.22); L.translate(-960, -1080);
  topHatMan(L, t); maskedMan(L, t); bride(L, t); oldWoman(L, t);
  L.restore();
  wallShadow(c, L.canvas, { dx: 40, dy: 10, blur: 22, a: .45 });
  c.drawImage(L.canvas, 0, 0);
  paperTooth(c, .22, 2);
  photoVignette(c, .7);
  viewport(c);
  const f = lt >= 4.75 ? lerp(1, .82, seg(lt, 4.75, 5.6)) : 0;
  if (f > 0) { c.fillStyle = rgba('#fff8ea', f); c.fillRect(0, 0, W, H); }
}

export const SHOTS = [{ at: 0, draw: family, name: 'family' }];
