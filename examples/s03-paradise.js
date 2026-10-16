// s03 — Paradise-style grey room; the only colour is red. A deer-headed man in a white robe stands at an arched
// window holding up a beating heart; it beats on the music's beat, drips, and the drops land on the floor.
// A caption types itself across the black band at the top. Long-case clock ticks on the left.
import { W, H, TAU, BEAT, clamp, lerp, seg, ease, easeInOut, easeIn, easeOut, hash, noise3, cam, shake, rgba, beatPulse, text, fx } from '../engine.js';
import { INK, LW, shape, toPath, line, curve, smooth, hatch, marks, paperTooth, face, hand, tone, brush, viewport, wallShadow, paintOver } from './kit.js';
import { layer, cache, fbm } from '../engine.js';

const T0 = 9.8, G1 = '#c8c8c2', G2 = '#a9a9a3', G3 = '#8a8a85', G4 = '#5e5e5a', ROBE = '#e6e5df', RED = '#b3241f', RED_D = '#6e1210';
const FY = 900;                                                    // floor line
const CAPTION = 'Every memory has its price.';

function room(c) {
  // the room is a rounded box (Paradise frames its rooms with soft top corners)
  shape(c, [[0, 0], [W, 0], [W, FY], [0, FY]], G1, { lw: 0 });
  for (let i = 0; i < 46; i++) {                                                         // vertical water streaks
    const x = hash(i, 1) * W, w = 6 + hash(i, 2) * 26, y0 = hash(i, 3) * 200, y1 = y0 + 200 + hash(i, 4) * 600;
    const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, rgba(G3, 0)); g.addColorStop(.3, rgba(G3, .25 + hash(i, 5) * .25)); g.addColorStop(1, rgba(G3, 0));
    c.fillStyle = g; c.fillRect(x, y0, w, y1 - y0);
  }
  shape(c, [[0, FY - 30], [W, FY - 30], [W, FY], [0, FY]], G2, { lw: 2.4, seed: 2 });                                  // skirting
  const F = shape(c, [[0, FY], [W, FY], [W, H + 40], [0, H + 40]], G4, { seed: 3 });
  for (let i = -14; i <= 14; i++) line(c, [[960 + i * 70, FY], [960 + i * 170, H + 40]], { lw: 1.3, alpha: .4 });
  // a faint rectangle where a picture used to hang
  shape(c, [[560, 250], [800, 250], [800, 420], [560, 420]], 'rgba(255,255,255,.12)', { lw: 1.4, ink: 'rgba(42,36,32,.4)', seed: 4 });
  line(c, [[680, 200], [680, 236]], { lw: 1.4 });
}

function archWindow(c) {
  const x0 = 1110, x1 = 1530, y0 = 300, yb = 840, r = (x1 - x0) / 2, cx = (x0 + x1) / 2;
  const outer = new Path2D(); outer.moveTo(x0 - 26, yb + 20); outer.lineTo(x0 - 26, y0); outer.arc(cx, y0, r + 26, Math.PI, 0); outer.lineTo(x1 + 26, yb + 20); outer.closePath();
  shape(c, outer, G4, { seed: 10 });
  const glass = new Path2D(); glass.moveTo(x0, yb); glass.lineTo(x0, y0); glass.arc(cx, y0, r, Math.PI, 0); glass.lineTo(x1, yb); glass.closePath();
  c.save(); c.clip(glass);
  const g = c.createLinearGradient(0, y0 - r, 0, yb); g.addColorStop(0, '#9fa9ad'); g.addColorStop(1, '#d6dad8'); c.fillStyle = g; c.fillRect(x0, y0 - r, x1 - x0, yb - y0 + r);
  shape(c, [[x0, 700], [x0 + 80, 600], [x0 + 140, 650], [x0 + 230, 540], [x0 + 330, 640], [x1, 590], [x1, yb], [x0, yb]], '#8d9496', { seed: 11, lw: 2 });   // mountains
  shape(c, [[x0, 760], [x0 + 120, 700], [x0 + 260, 740], [x1, 690], [x1, yb], [x0, yb]], '#737a7b', { seed: 12, lw: 2 });
  for (let i = 0; i < 18; i++) line(c, [[x0 + hash(i, 13) * 420, y0 - r + hash(i, 14) * 300], [x0 + hash(i, 13) * 420 - 20, y0 - r + hash(i, 14) * 300 + 50]], { lw: 1, alpha: .2 });   // rain on glass
  c.restore();
  c.lineWidth = LW; c.strokeStyle = INK; c.stroke(glass);
  shape(c, [[cx - 7, y0 - r], [cx + 7, y0 - r], [cx + 7, yb], [cx - 7, yb]], G4, { seed: 14, lw: 2.4 });                // mullions
  shape(c, [[x0, 560], [x1, 560], [x1, 572], [x0, 572]], G4, { seed: 15, lw: 2.4 });
  shape(c, [[x0 - 40, yb], [x1 + 40, yb], [x1 + 30, yb + 24], [x0 - 30, yb + 24]], G2, { seed: 16 });                  // sill
}

function clock(c, t) {
  const x = 300;
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x, FY + 12, 140, 14, 0, 0, TAU); c.fill();
  const body = shape(c, [[x - 70, 430], [x + 70, 430], [x + 70, 820], [x - 70, 820]], '#d7d6d0', { seed: 20 });
  tone(c, body, [[x + 34, 420], [x + 80, 420], [x + 80, 830], [x + 34, 830]], '#a9a8a2', 1);
  shape(c, [[x - 100, 820], [x + 100, 820], [x + 104, 900], [x - 104, 900]], '#d7d6d0', { seed: 21 });                 // plinth
  shape(c, smooth([[x - 60, 850], [x - 30, 836], [x, 852], [x + 30, 836], [x + 60, 850], [x + 30, 870], [x, 856], [x - 30, 870]], 3), null, { lw: 1.6, seed: 22 });
  shape(c, [[x - 104, 200], [x + 104, 200], [x + 104, 430], [x - 104, 430]], '#dcdbd5', { seed: 23 });                 // hood
  shape(c, smooth([[x - 120, 200], [x - 60, 150], [x, 168], [x + 60, 150], [x + 120, 200]], 4, false), '#dcdbd5', { seed: 24 });
  for (const m of [-1, 1]) shape(c, [[x + m * 96, 214], [x + m * 84, 214], [x + m * 84, 420], [x + m * 96, 420]], '#cfcec8', { seed: 25 + m, lw: 2 });   // columns
  const cy = 312, R = 66;                                                                                              // dial
  shape(c, toPath(Array.from({ length: 40 }, (_, k) => [x + Math.cos(k / 40 * TAU) * R, cy + Math.sin(k / 40 * TAU) * R])), '#efeeea', { seed: 27 });
  c.save(); c.translate(x, cy); c.fillStyle = INK; c.font = '600 15px "IM Fell English", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((n, k) => { const a = k / 12 * TAU; c.fillText(n, Math.sin(a) * R * .76, -Math.cos(a) * R * .76); });
  const sec = Math.floor((t - .001) / BEAT);
  for (const [a, l, w] of [[-.9, .45, 3.2], [2.2, .62, 2.4], [sec * TAU / 60, .7, 1.2]]) line(c, [[0, 0], [Math.sin(a) * R * l, -Math.cos(a) * R * l]], { lw: w });
  c.fillStyle = INK; c.beginPath(); c.arc(0, 0, 4, 0, TAU); c.fill(); c.restore();
  // trunk door with pendulum
  shape(c, [[x - 44, 470], [x + 44, 470], [x + 44, 780], [x - 44, 780]], '#4b4b47', { seed: 28, lw: 2.6 });
  const ang = .16 * Math.sin(Math.PI * t / BEAT);
  c.save(); c.beginPath(); c.rect(x - 44, 470, 88, 310); c.clip(); c.translate(x, 450); c.rotate(ang);
  line(c, [[0, 0], [0, 260]], { lw: 2.4, ink: '#c9c9c3' });
  shape(c, toPath(Array.from({ length: 24 }, (_, k) => [Math.cos(k / 24 * TAU) * 22, 260 + Math.sin(k / 24 * TAU) * 22])), '#d8d7d1', { seed: 29 });
  c.restore();
}

function table(c) {
  const x = 760;
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x, FY + 30, 150, 14, 0, 0, TAU); c.fill();
  for (const dx of [-100, 100]) shape(c, [[x + dx - 8, 760], [x + dx + 8, 760], [x + dx + 6 + dx * .06, FY + 26], [x + dx - 6 + dx * .06, FY + 26]], '#7a7a74', { seed: 30 + dx });
  shape(c, [[x - 140, 744], [x + 140, 744], [x + 136, 772], [x - 136, 772]], '#8e8e88', { seed: 32 });
  shape(c, smooth([[x - 150, 744], [x, 732], [x + 150, 744], [x, 752]], 5), '#9c9c96', { seed: 33 });
  shape(c, [[x - 40, 738], [x + 30, 734], [x + 34, 744], [x - 36, 748]], '#efeeea', { seed: 34, lw: 1.8 });               // a note
}

// the heart: a beating, dripping heart with vessels — the one colour in the room
function heart(c, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s); c.rotate(-.18);
  const tube = (pts, w, col) => {                                                        // vessel: ink tube + flesh core + dark opening
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [lw, cc] of [[w + 5 / s, INK], [w, col]]) { c.lineWidth = lw; c.strokeStyle = cc; c.beginPath(); c.moveTo(...pts[0]); c.quadraticCurveTo(...pts[1], ...pts[2]); c.stroke(); }
    const [ex, ey] = pts[2]; c.fillStyle = RED_D; c.beginPath(); c.ellipse(ex, ey, w * .36, w * .2, 0, 0, TAU); c.fill(); c.lineWidth = 1.4 / s; c.strokeStyle = INK; c.stroke();
  };
  tube([[-22, -20], [-30, -50], [-22, -64]], 13, '#8d4a5a');                              // vena cava (bluish)
  tube([[4, -24], [-6, -70], [-34, -60]], 18, '#b8372c');                                 // aortic arch
  tube([[20, -20], [30, -48], [44, -56]], 14, '#a5302a');                                 // pulmonary trunk
  const hp = shape(c, smooth([[-30, -30], [-4, -36], [26, -32], [48, -10], [44, 26], [22, 54], [4, 70], [-12, 56], [-40, 24], [-50, -4]], 5), RED, { lw: 3 / s, seed: 45 });
  tone(c, hp, [[14, -40], [60, -40], [60, 80], [0, 80], [12, 20]], RED_D, .6);
  curve(c, -14, -28, 8, 14, 6, 62, { lw: 1.8 / s, ink: RED_D });                          // interventricular groove
  curve(c, 8, 14, 24, 16, 40, 4, { lw: 1.3 / s, ink: RED_D });
  shape(c, smooth([[-34, -26], [-16, -34], [-12, -18], [-30, -10]], 2), '#c94a3c', { lw: 1.8 / s, seed: 46 });              // atrium lobe
  c.fillStyle = 'rgba(255,230,220,.4)'; c.beginPath(); c.ellipse(-26, 6, 5, 10, -.5, 0, TAU); c.fill();
  c.restore();
}

function deerMan(c, t, lt) {
  const x = 1320, br = Math.sin(t * 1.4) * 1.5;
  c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x + 20, FY + 22, 150, 16, 0, 0, TAU); c.fill();
  c.save(); c.translate(x, 912); c.scale(.88, .88); c.translate(-x, -912); c.translate(0, -br * .4);
  // robe
  const robe = shape(c, smooth([[x - 70, 470], [x - 112, 520], [x - 120, 700], [x - 140, 912], [x + 140, 912], [x + 120, 700], [x + 112, 520], [x + 70, 470]], 4, false).concat([[x, 462]]), ROBE, { seed: 50 });
  tone(c, robe, [[x + 60, 460], [x + 150, 460], [x + 150, 920], [x + 70, 920], [x + 80, 680]], '#bdbcb5', 1);
  for (const [dx, w] of [[-84, 10], [-40, 7], [30, 8], [76, 9]]) tone(c, robe, [[x + dx - 3, 664], [x + dx + 3, 664], [x + dx * 1.15 + w, 912], [x + dx * 1.15 - w, 912]], '#c9c8c1', 1);
  for (const dx of [-84, -40, 30, 76]) brush(c, [[x + dx, 680], [x + dx * 1.08, 800], [x + dx * 1.15, 906]], LW * .4);
  shape(c, smooth([[x - 4, 470], [x + 40, 600], [x + 20, 740], [x - 10, 600]], 3), '#d9d8d1', { seed: 51, lw: 2 });          // lapel overlap
  shape(c, [[x - 112, 640], [x + 112, 640], [x + 110, 664], [x - 112, 664]], '#d4d3cc', { seed: 52, lw: 2.2 });            // sash
  shape(c, smooth([[x + 40, 660], [x + 58, 740], [x + 44, 750], [x + 30, 664]], 2), '#d4d3cc', { seed: 53, lw: 2 });
  // left arm hangs; right arm raised holding the heart out toward us
  shape(c, smooth([[x + 80, 490], [x + 118, 520], [x + 128, 700], [x + 100, 712], [x + 92, 560]], 3), ROBE, { seed: 54 });
  hand(c, x + 112, 712, 1.1, .1, '#d6cbb8', { fingers: 4 });
  const lift = easeOut(seg(lt, .3, 1.4)), hx = lerp(x - 130, x - 190, lift), hy = lerp(600, 470, lift);
  shape(c, smooth([[x - 70, 490], [x - 112, 520], [hx + 30, hy + 60], [hx + 4, hy + 30], [hx - 10, hy + 50], [x - 100, 600]], 3), ROBE, { seed: 55 });
  hand(c, hx, hy + 10, 1.15, Math.PI + .2, '#d6cbb8', { fingers: 4, fist: .3 });
  const beat = beatPulse(t, 8), hs = 1.05 + beat * .12;
  heart(c, hx - 4, hy - 46, hs);
  // neck + deer head; the head turns from the heart to us
  const nk = shape(c, smooth([[x - 30, 396], [x + 30, 396], [x + 40, 478], [x + 10, 470], [x, 484], [x - 12, 470], [x - 40, 478]], 3), '#9a7b5e', { seed: 56 });
  tone(c, nk, [[x + 10, 390], [x + 50, 390], [x + 50, 490], [x + 14, 490]], '#6e543f', .9);
  for (let k = 0; k < 5; k++) brush(c, [[x - 20 + k * 10, 446], [x - 22 + k * 11, 474]], LW * .3);
  const turn = easeInOut(seg(lt, 2.0, 2.9));
  c.save(); c.translate(x, 340); c.rotate(lerp(-.16, .02, turn));
  // antlers (behind)
  for (const m of [-1, 1]) {
    const pts = [[m * 30, -60], [m * 50, -120], [m * 60, -190], [m * 52, -250]];
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [lw, col] of [[16, INK], [10, '#e6e1d4']]) {
      c.lineWidth = lw; c.strokeStyle = col; c.beginPath(); c.moveTo(...pts[0]); for (const p of pts.slice(1)) c.lineTo(...p);
      for (const [i, bx, by] of [[1, 100, -150], [2, 108, -220], [2, 20, -230], [1, 6, -160]]) { c.moveTo(...pts[i]); c.lineTo(m * bx, by); }
      c.stroke();
    }
  }
  for (const m of [-1, 1]) {                                                              // ears: long, cupped, pale inside
    const ear = shape(c, smooth([[m * 30, -44], [m * 70, -78], [m * 112, -74], [m * 98, -50], [m * 50, -26]], 4), '#9a7b5e', { seed: 60 + m });
    shape(c, smooth([[m * 42, -46], [m * 74, -68], [m * 100, -66], [m * 86, -52], [m * 52, -38]], 3), '#e3d6c3', { lw: LW * .45, seed: 62 + m });
    tone(c, ear, [[m * 40, -40], [m * 110, -60], [m * 110, -40], [m * 40, -20]], '#6e543f', .6);
  }
  const head = shape(c, smooth([[0, -64], [34, -60], [52, -34], [50, -6], [36, 28], [26, 60], [22, 84], [0, 96], [-22, 84], [-26, 60], [-36, 28], [-50, -6], [-52, -34], [-34, -60]], 5), '#a0805f', { seed: 64 });
  tone(c, head, [[18, -70], [70, -70], [70, 110], [12, 110], [24, 40], [34, 0]], '#7a5e45', .95);          // shadow side
  tone(c, head, smooth([[-10, -58], [10, -58], [8, 20], [0, 40], [-8, 20]], 3), '#b9997a', .9);             // pale blaze down the nose
  shape(c, smooth([[-22, 58], [0, 52], [22, 58], [24, 82], [0, 98], [-24, 82]], 4), '#ece4d6', { seed: 65, lw: LW * .7 });   // pale muzzle
  const nose = shape(c, smooth([[-17, 64], [0, 60], [17, 64], [15, 78], [0, 84], [-15, 78]], 3), '#1d1715', { seed: 66, lw: LW * .6 });
  c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(-5, 66, 5, 2, -.2, 0, TAU); c.fill();
  for (const m of [-1, 1]) { c.fillStyle = '#000'; c.beginPath(); c.ellipse(m * 8, 74, 3.5, 2.4, m * .5, 0, TAU); c.fill(); }
  brush(c, [[0, 84], [0, 92]], LW * .5); brush(c, [[-10, 94], [0, 92], [10, 94]], LW * .5);
  const ex = lerp(-4, 0, turn);
  for (const m of [-1, 1]) {                                                              // eyes: wide-set, black, in dark sockets
    const cx = m * 30 + ex;
    shape(c, smooth([[cx - 15, -10], [cx, -20], [cx + 15, -10], [cx, 4]], 4), '#5e4734', { lw: 0 });
    shape(c, smooth([[cx - 10, -9], [cx, -15], [cx + 10, -8], [cx, -1]], 4), '#0f0c0b', { lw: LW * .5 });
    c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(cx - 3, -10, 2.2, 0, TAU); c.fill();
    brush(c, [[cx - m * 9, -4], [cx - m * 14, 8]], LW * .4);                               // tear line
    brush(c, [[cx - 14, -22], [cx, -26], [cx + 14, -20]], LW * .55);                       // brow ridge
  }
  for (let k = 0; k < 5; k++) brush(c, [[-12 + k * 6, -58], [-14 + k * 7, -48]], LW * .3);   // forehead fur
  brush(c, [[-36, 30], [-28, 50]], LW * .4); brush(c, [[36, 30], [28, 50]], LW * .4);
  c.restore();
  c.restore();
}

// drops fall from the heart every ~1.4 s, land, and the puddle grows (all a pure function of t)
function drops(c, t, lt) {
  const x = 1320, lift = easeOut(seg(lt, .3, 1.4)), hx = x + (lerp(x - 130, x - 190, lift) - 4 - x) * .88, hy = 912 + (lerp(600, 470, lift) - 46 + 70 * 1.1 - 912) * .88;
  const N = Math.floor(Math.max(0, lt - 1.2) / 1.4) + 1;
  for (let i = 0; i < N; i++) {
    const t0 = 1.2 + i * 1.4, k = lt - t0; if (k < 0) continue;
    const g = 2400, y = hy + .5 * g * k * k;
    if (y < FY + 30) { c.fillStyle = RED; c.beginPath(); c.ellipse(hx, y, 4, 7 + Math.min(10, k * 30), 0, 0, TAU); c.fill(); c.lineWidth = 1.5; c.strokeStyle = INK; c.stroke(); }
    else { const tk = k - Math.sqrt(2 * (FY + 30 - hy) / g); if (tk < .25) for (const m of [-1, 1]) { c.fillStyle = RED; c.beginPath(); c.arc(hx + m * (6 + tk * 90), FY + 30 - tk * 60 + tk * tk * 240, 2.6, 0, TAU); c.fill(); } }
  }
  const landed = Math.max(0, Math.floor((lt - 1.2 - .3) / 1.4) + 1);
  if (landed > 0) { const r = 10 + landed * 7; shape(c, smooth(Array.from({ length: 10 }, (_, k) => { const a = k / 10 * TAU, rr = r * (1 + (hash(k, 7) - .5) * .4); return [hx + Math.cos(a) * rr * 1.6, FY + 30 + Math.sin(a) * rr * .3]; }), 3), RED_D, { lw: 2, seed: 70 }); }
}

function caption(c, lt) {
  c.fillStyle = '#0c0c0c'; c.fillRect(0, 0, W, 110);
  const n = Math.floor(clamp((lt - .5) / 1.6) * CAPTION.length);
  if (n > 0) text(c, CAPTION.slice(0, n), W / 2, 58, { size: 44, family: 'IM Fell English', weight: 400, col: '#f2f1ec' });
}

function paradise(c, t, s) {
  const lt = s.lt, z = lerp(1, 1.06, easeInOut(seg(lt, 0, 5))), [sx, sy] = shake(t, { amp: .7, freq: .3, seed: 9 });
  c.save(); cam(c, { x: lerp(960, 1010, easeInOut(seg(lt, 0, 5))) + sx, y: 560 + sy, z });
  c.drawImage(paradiseRoom(), 0, 0); clock(c, t);
  c.restore();
  const Lr = layer('deer'); Lr.save(); cam(Lr, { x: lerp(960, 1010, easeInOut(seg(lt, 0, 5))) + sx, y: 560 + sy, z }); table(Lr); deerMan(Lr, t, lt); Lr.restore();
  wallShadow(c, Lr.canvas, { dx: -46, dy: 8, blur: 24, a: .32 });
  c.drawImage(Lr.canvas, 0, 0);
  c.save(); cam(c, { x: lerp(960, 1010, easeInOut(seg(lt, 0, 5))) + sx, y: 560 + sy, z }); drops(c, t, lt); c.restore();
  paperTooth(c, .3, 4);
  viewport(c);
  caption(c, lt);
  const out = seg(lt, 4.5, 5.2); if (out > 0) { c.fillStyle = rgba('#000', easeIn(out)); c.fillRect(0, 0, W, H); }
  fx({ vignette: .45 });
}

const paradiseRoom = () => cache('par-room', W, H, x => {
  room(x); archWindow(x);
  paintOver(x, { alpha: .4, seed: 5, scale: 80, streak: 50 });
});

export const SHOTS = [{ at: T0, draw: paradise, name: 'paradise', tr: { type: 'fade', len: .5 } }];
