// s02 — the green hall. Flat elevation of a room (Rusty Lake Hotel / Roots interiors): moulded panels, a pink-brown
// doorway, a swaying candle chandelier. A maid stands in the doorway looking at the floor; she raises her eyes to us.
// Then the candles go out, one by one.
import { W, H, TAU, clamp, lerp, seg, ease, easeInOut, easeOut, hash, noise3, cam, shake, rgba, mix, fx } from '../engine.js';
import { INK, LW, shape, toPath, line, curve, smooth, hatch, marks, paperTooth, face, hand, tone, brush, hairCap, viewport, wallShadow, paintOver, foldedHands } from './kit.js';
import { cache, fbm, layer } from '../engine.js';

const T0 = 5.2, WALL = '#7c9a84', WALL_D = '#5d786a', MOULD = '#93b09a', FRAME = '#b48a7c', FLOOR = '#6a4a35';
const BX0 = 330, BX1 = 1590, BY = 860;                         // back wall box
const blinkAt = (t, list, d = .14) => { let o = 1; for (const b of list) { const k = Math.abs(t - b) / d; if (k < 1) o = Math.min(o, k); } return o; };

function room(c) {
  // back wall
  shape(c, [[BX0, -20], [BX1, -20], [BX1, BY], [BX0, BY]], WALL, { lw: 0 });
  { const g = c.createLinearGradient(0, 0, 0, 420); g.addColorStop(0, 'rgba(30,50,40,.3)'); g.addColorStop(1, 'rgba(30,50,40,0)'); c.fillStyle = g; c.fillRect(BX0, -20, BX1 - BX0, 440); }                                     // darker toward ceiling
  for (const [x0, x1] of [[380, 690], [1230, 1540]]) {                                                             // panel mouldings
    shape(c, [[x0, 150], [x1, 150], [x1, 790], [x0, 790]], null, { lw: 2.6, wob: .5, seed: x0 });
    shape(c, [[x0 + 16, 166], [x1 - 16, 166], [x1 - 16, 774], [x0 + 16, 774]], null, { lw: 1.6, wob: .5, seed: x0 + 1 });
    c.fillStyle = rgba(MOULD, .5); c.fillRect(x0 + 2, 152, x1 - x0 - 4, 12);
  }
  // cornice
  shape(c, [[BX0, 30], [BX1, 30], [BX1, 62], [BX0, 62]], MOULD, { lw: 2.4, seed: 3 });
  line(c, [[BX0, 46], [BX1, 46]], { lw: 1.4 });
  for (let x = BX0 + 10; x < BX1; x += 26) line(c, [[x, 62], [x, 76]], { lw: 1.6 });                            // dentils
  line(c, [[BX0, 76], [BX1, 76]], { lw: 2 });
  shape(c, [[BX0, 820], [BX1, 820], [BX1, BY], [BX0, BY]], WALL_D, { lw: 2.4, seed: 5 });                         // skirting
  // side walls in perspective
  const L = shape(c, [[0, -20], [BX0, -20], [BX0, BY], [0, H + 60]], WALL_D, { seed: 6 });
  tone(c, L, [[0, -20], [BX0, -20], [BX0, BY], [0, H + 60]], '#000', .12);
  const R = shape(c, [[W, -20], [BX1, -20], [BX1, BY], [W, H + 60]], WALL_D, { seed: 7 });
  tone(c, R, [[W, -20], [BX1, -20], [BX1, BY], [W, H + 60]], '#000', .2);
  // left wall: a second dark doorway, receding
  shape(c, [[70, 260], [250, 300], [250, 905], [70, 980]], FRAME, { seed: 8 });
  shape(c, [[100, 300], [230, 330], [230, 900], [100, 960]], '#1a1d1b', { seed: 9 });
  // right wall: a portrait hung in perspective
  shape(c, [[1660, 300], [1800, 270], [1800, 520], [1660, 510]], '#b8913e', { seed: 10 });
  shape(c, [[1676, 318], [1784, 294], [1784, 498], [1676, 494]], '#5d564a', { seed: 11 });
  c.save(); c.beginPath(); c.moveTo(1676, 318); c.lineTo(1784, 294); c.lineTo(1784, 498); c.lineTo(1676, 494); c.clip();
  c.translate(1730, 380); c.scale(.82, 1); face(c, { fw: 30, fh: 40, skin: '#c9b89a', shade: '#8e8068', open: 1, look: [-.4, 0], brow: -.2, lips: '#7a4a3e', seed: 12, ears: false, neck: 1.3 }); hairCap(c, 30, 40, '#4a3a2c', '#2c2118', { part: -8, line: .72, strands: 3, seed: 13 }); brush(c, [[-16, 24], [0, 20], [16, 24]], 5, { col: '#3a2a1e' });
  shape(c, [[-60, 50], [60, 50], [60, 140], [-60, 140]], '#3a332c', { seed: 13 });
  c.restore();
  // floor + boards converging
  const F = shape(c, [[0, H + 60], [BX0, BY], [BX1, BY], [W, H + 60]], FLOOR, { seed: 14 });
  c.save(); c.clip(F);
  for (let i = -16; i <= 16; i++) line(c, [[960 + i * 52, BY], [960 + i * 150, H + 60]], { lw: 1.5, alpha: .6 });
  for (const y of [905, 970, 1050]) line(c, [[0, y], [W, y]], { lw: 1.2, alpha: .35 });
  c.restore();
}

function doorway(c, t) {
  // dark room beyond, with a balustrade glimpsed
  shape(c, [[790, 330], [1130, 330], [1130, BY], [790, BY]], '#22302b', { seed: 20 });
  c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(790, 330, 340, 90);
  shape(c, [[790, 520], [1130, 520], [1130, 538], [790, 538]], '#3c4d45', { seed: 21, lw: 2 });
  for (let x = 806; x < 1130; x += 26) shape(c, smooth([[x - 6, 538], [x + 6, 538], [x + 8, 560], [x + 4, 600], [x + 7, 640], [x - 7, 640], [x - 4, 600], [x - 8, 560]], 2), '#33433c', { seed: x, lw: 1.6 });
  shape(c, [[790, 640], [1130, 640], [1130, 652], [790, 652]], '#3c4d45', { seed: 22, lw: 2 });
  shape(c, [[790, 760], [1130, 760], [1130, BY], [790, BY]], '#2b2420', { seed: 23, lw: 2 });                       // floor beyond
  // frame: pilasters + entablature
  for (const x of [740, 1130]) {
    const p = shape(c, [[x, 330], [x + 50, 330], [x + 50, BY], [x, BY]], FRAME, { seed: 24 + x });
    line(c, [[x + 14, 350], [x + 14, BY - 20]], { lw: 1.6 }); line(c, [[x + 36, 350], [x + 36, BY - 20]], { lw: 1.6 });
    tone(c, p, [[x + 36, 330], [x + 50, 330], [x + 50, BY], [x + 36, BY]], '#6e4a40', .55);
    shape(c, [[x - 10, 300], [x + 60, 300], [x + 54, 330], [x - 4, 330]], FRAME, { seed: 26 + x });
    shape(c, [[x - 6, BY - 30], [x + 56, BY - 30], [x + 60, BY], [x - 10, BY]], FRAME, { seed: 27 + x });
  }
  shape(c, [[720, 250], [1200, 250], [1200, 300], [720, 300]], FRAME, { seed: 30 });
  shape(c, [[704, 232], [1216, 232], [1206, 252], [714, 252]], mix(FRAME, '#fff', .15), { seed: 31 });
  line(c, [[730, 276], [1190, 276]], { lw: 1.4 });
  c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(790, 330, 340, 14);
}

function maid(c, t, lt) {
  const x = 960, hy = 452, br = Math.sin(t * 1.5) * 1.6;
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x + 14, BY - 4, 80, 11, 0, 0, TAU); c.fill();
  c.save(); c.translate(0, -br * .4);
  shape(c, [[x - 24, 838], [x - 3, 838], [x - 3, 856], [x - 32, 856]], '#1d1a18', { seed: 40, lw: 2 });               // shoes
  shape(c, [[x + 3, 838], [x + 24, 838], [x + 32, 856], [x + 3, 856]], '#1d1a18', { seed: 41, lw: 2 });
  const dress = shape(c, smooth([[x - 22, 522], [x - 42, 536], [x - 44, 600], [x - 40, 640], [x - 56, 844], [x + 56, 844], [x + 40, 640], [x + 44, 600], [x + 42, 536], [x + 22, 522]], 4, false).concat([[x, 518]]), '#55524f', { seed: 42 });
  tone(c, dress, [[x + 20, 510], [x + 70, 510], [x + 70, 850], [x + 26, 850]], '#2f2d2b', .7);
  for (const dx of [-30, 34]) tone(c, dress, [[x + dx - 4, 700], [x + dx + 4, 700], [x + dx * 1.3 + 7, 850], [x + dx * 1.3 - 7, 850]], '#2f2d2b', .6);
  for (const m of [-1, 1]) { const ua = shape(c, smooth([[x + m * 32, 530], [x + m * 50, 548], [x + m * 52, 604], [x + m * 36, 612], [x + m * 30, 570]], 3), '#4c4946', { seed: 43 + m }); tone(c, ua, [[x + m * 44, 520], [x + m * 60, 520], [x + m * 60, 620], [x + m * 44, 620]], '#2f2d2b', .6); }   // upper arms
  shape(c, smooth([[x - 28, 616], [x + 28, 616], [x + 40, 760], [x + 38, 832], [x - 38, 832], [x - 40, 760]], 3), '#f0ede6', { seed: 45 });   // apron
  for (const [dx, w] of [[-16, 5], [6, 4], [22, 6]]) tone(c, toPath([[x - 40, 616], [x + 40, 616], [x + 40, 832], [x - 40, 832]], { wob: 0 }), [[x + dx - 2, 640], [x + dx + 2, 640], [x + dx * 1.2 + w, 832], [x + dx * 1.2 - w, 832]], '#cfccc4', 1);
  shape(c, [[x - 30, 604], [x + 30, 604], [x + 30, 618], [x - 30, 618]], '#f0ede6', { seed: 46, lw: 2 });              // waistband
  shape(c, smooth([[x - 14, 596], [x + 16, 596], [x + 22, 610], [x - 20, 610]], 2), '#f0ede6', { seed: 47, lw: 1.8 });   // bib top
  foldedHands(c, x, 640, { elbowDX: 52, elbowDY: -42 });
  shape(c, smooth([[x - 20, 516], [x, 534], [x + 20, 516], [x + 14, 510], [x, 522], [x - 14, 510]], 3), '#f0ede6', { seed: 48, lw: 2 });   // collar
  shape(c, [[x - 10, 482], [x + 10, 482], [x + 11, 514], [x - 11, 514]], '#ddd6c7', { seed: 49, lw: 2.2 });
  const up = easeInOut(seg(lt, 1.6, 2.5));
  c.save(); c.translate(x, hy); c.rotate(lerp(.05, -.02, up)); c.scale(1.12, 1.12);
  shape(c, smooth([[-14, -50], [14, -50], [18, -36], [0, -30], [-18, -36]], 3), '#4a3b30', { seed: 52 });   // bun
  face(c, { fw: 28, fh: 38, skin: '#ddd6c7', shade: '#aaa293', open: lerp(.42, 1, up) * blinkAt(lt, [3.3]), look: [0, lerp(.9, 0, up)], brow: .3, lips: '#99574b', seed: 51, bags: 1.1, neck: 1.6, iris: '#77736e', jaw: .35 });
  hairCap(c, 28, 38, '#4a3b30', '#2e241c', { part: 0, line: .7, side: 1.04, low: -.25, strands: 4, seed: 54 });
  shape(c, smooth([[-26, -42], [-18, -60], [0, -64], [18, -60], [26, -42], [0, -48]], 4), '#f0ede6', { seed: 53, lw: 2 });   // frilled cap
  for (let k = 0; k < 6; k++) { c.save(); c.lineWidth = 2; c.strokeStyle = INK; c.fillStyle = '#f0ede6'; c.beginPath(); c.arc(-22 + k * 8.8, -58 + Math.abs(k - 2.5) * 2, 4.6, Math.PI, 0); c.fill(); c.stroke(); c.restore(); }
  c.restore();
  c.restore();
}

const CAND = [-120, -80, -40, 40, 80, 120];
function chandelier(c, t, lt) {
  const sw = Math.sin(t * 1.1) * .035;
  c.save(); c.translate(960, -74); c.rotate(sw);
  line(c, [[0, 0], [0, 150]], { lw: 3 });
  for (let y = 20; y < 150; y += 22) shape(c, smooth([[-5, y], [0, y - 6], [5, y], [0, y + 6]], 2), '#b9bdb9', { lw: 1.6, seed: y });
  shape(c, smooth([[-10, 150], [10, 150], [16, 200], [8, 260], [-8, 260], [-16, 200]], 3), '#c3c6c2', { seed: 60 });
  shape(c, smooth([[-6, 260], [6, 260], [0, 290]], 2), '#c3c6c2', { seed: 61, lw: 2 });
  c.lineWidth = 3; c.strokeStyle = INK; c.lineCap = 'round';
  for (const dx of CAND) { c.beginPath(); c.moveTo(0, 210); c.bezierCurveTo(dx * .3, 250, dx, 250, dx, 214); c.stroke(); c.lineWidth = 1.6; c.strokeStyle = '#d4d7d3'; c.stroke(); c.lineWidth = 3; c.strokeStyle = INK; }
  shape(c, smooth([[-130, 206], [0, 222], [130, 206], [0, 236]], 4), null, { lw: 2 });
  for (let i = 0; i < CAND.length; i++) {
    const dx = CAND[i], out = seg(lt, 3.4 + i * .12, 3.5 + i * .12);
    shape(c, [[dx - 12, 214], [dx + 12, 214], [dx + 8, 204], [dx - 8, 204]], '#c3c6c2', { seed: 70 + i, lw: 2 });
    shape(c, [[dx - 6, 204], [dx + 6, 204], [dx + 6, 168], [dx - 6, 168]], '#f0ece0', { seed: 80 + i, lw: 2 });
    line(c, [[dx, 168], [dx, 160]], { lw: 1.4 });
    if (out < 1) {
      const fl = 1 + noise3(t * 5, i, 1) * .2, a = 1 - out;
      c.save(); c.globalAlpha = a; c.fillStyle = rgba('#ffe7a6', .25); c.beginPath(); c.arc(dx, 150, 22 * fl, 0, TAU); c.fill();
      shape(c, smooth([[dx, 162], [dx - 6, 152], [dx + noise3(t * 4, i, 3) * 2, 132 - 4 * fl], [dx + 6, 152]], 3), '#f7d26a', { seed: 90 + i, lw: 1.6 });
      c.restore();
    } else {                                                                                                                // smoke wisp after it goes out
      const k = seg(lt, 3.5 + i * .12, 4.6 + i * .12);
      c.save(); c.globalAlpha = (1 - k) * .6; c.lineWidth = 1.6; c.strokeStyle = '#d9d9d4'; c.beginPath();
      for (let j = 0; j < 12; j++) { const y = 158 - j * 6 * (.4 + k), xx = dx + Math.sin(j * .7 + t * 3) * 4 * (j / 12); j ? c.lineTo(xx, y) : c.moveTo(xx, y); } c.stroke(); c.restore();
    }
  }
  c.restore();
}

function sideTable(c) {
  const x = 1440;
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, 1010, 90, 14, 0, 0, TAU); c.fill();
  shape(c, smooth([[x - 18, 830], [x + 18, 830], [x + 10, 900], [x + 26, 990], [x + 60, 1004], [x - 60, 1004], [x - 26, 990], [x - 10, 900]], 3), '#e6e2d8', { seed: 100 });
  shape(c, smooth([[x - 120, 820], [x, 806], [x + 120, 820], [x, 836]], 6), '#efebe2', { seed: 101 });
  shape(c, [[x - 120, 820], [x + 120, 820], [x + 120, 834], [x - 120, 834]], '#d8d3c8', { seed: 102, lw: 2.4 });
  shape(c, smooth([[x - 50, 812], [x + 10, 808], [x + 10, 816], [x - 50, 820]], 2), '#f6f3ea', { seed: 103, lw: 1.8 });   // a folded letter
  line(c, [[x - 40, 813], [x - 4, 811]], { lw: 1, alpha: .5 });
}

function hall(c, t, s) {
  const lt = s.lt, z = lerp(1, 1.16, easeInOut(seg(lt, 0, 4.6))), [sx, sy] = shake(t, { amp: .7, freq: .3, seed: 5 });
  c.save(); cam(c, { x: 960 + sx, y: lerp(540, 560, seg(lt, 0, 4.6)) + sy, z });
  c.drawImage(roomPainted(), 0, 0); maid(c, t, lt); sideTable(c); chandelier(c, t, lt);
  c.restore();
  paperTooth(c, .28, 3);
  // candlelight: warm wash that dies with the candles, then darkness
  const lit = 1 - seg(lt, 3.5, 4.3);
  c.save(); c.globalCompositeOperation = 'soft-light'; c.fillStyle = rgba('#ffcf7a', .35 * lit); c.fillRect(0, 0, W, H); c.restore();
  const dark = easeInOut(seg(lt, 3.5, 4.5)) * .97;
  if (dark > 0) { c.fillStyle = rgba('#050606', dark); c.fillRect(0, 0, W, H); }
  viewport(c);
  fx({ vignette: .3 });
}

// the set is painted once: flat elevation + mottled brushwork so walls read as paint, not vector fills
const roomPainted = () => cache('hall-room', W, H, x => {
  room(x); doorway(x, 0);
  paintOver(x, { alpha: .35, seed: 3 });
});

export const SHOTS = [{ at: T0, draw: hall, name: 'hall', tr: { type: 'fade', len: .5 } }];
