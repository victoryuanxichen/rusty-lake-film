// kit.js — Rusty Lake (Roots / Paradise / Hotel) drawing kit.
// The look: flat muted fills + one even, slightly wobbly dark-brown ink outline + fine hatching for shadow,
// pale deadpan faces (dot pupils, heavy lids, grey eye bags, down-turned mouths), faded floral wallpaper,
// old-photo vignette. Motion is paper-puppet: rigid parts rotating on pivots, slow, with rare sudden moves.
import { W, H, TAU, clamp, lerp, hash, noise3, fbm, mk, cache, rgba, mix, rng } from '../engine.js';

export const INK = '#151210';
export const LW = 5.6;

// ---------- ink primitives ----------
// fill + ink outline. pts = array of [x,y] (gets a gentle hand wobble) or a Path2D.
export function shape(c, p, fill, { lw = LW, ink = INK, wob = .8, seed = 1, close = true, stroke = true } = {}) {
  const path = p instanceof Path2D ? p : toPath(p, { wob, seed, close });
  if (fill) { c.fillStyle = fill; c.fill(path); }
  if (stroke && lw > 0) { c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = lw; c.strokeStyle = ink; c.stroke(path); }
  return path;
}
export function toPath(pts, { wob = .8, seed = 1, close = true } = {}) {
  const p = new Path2D();
  pts.forEach(([x, y], i) => { const dx = wob ? noise3(x * .02, y * .02, seed) * wob : 0, dy = wob ? noise3(x * .02 + 9, y * .02, seed) * wob : 0; i ? p.lineTo(x + dx, y + dy) : p.moveTo(x + dx, y + dy); });
  if (close) p.closePath();
  return p;
}
export function line(c, pts, { lw = LW * .7, ink = INK, alpha = 1 } = {}) {
  c.save(); c.globalAlpha *= alpha; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = lw; c.strokeStyle = ink;
  c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); c.restore();
}
export function curve(c, x0, y0, cx, cy, x1, y1, o = {}) { c.save(); c.lineCap = 'round'; c.lineWidth = o.lw ?? LW * .7; c.strokeStyle = o.ink ?? INK; c.globalAlpha *= o.alpha ?? 1; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx, cy, x1, y1); c.stroke(); c.restore(); }
// smooth closed/open outline through control points (Catmull-Rom), returned as point array
export function smooth(pts, n = 8, closed = true) {
  const out = [], N = pts.length;
  for (let i = 0; i < (closed ? N : N - 1); i++) {
    const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
    const q0 = closed || i > 0 ? p0 : p1, q3 = closed || i < N - 2 ? p3 : p2;
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => .5 * ((2 * p1[j]) + (-q0[j] + p2[j]) * t + (2 * q0[j] - 5 * p1[j] + 4 * p2[j] - q3[j]) * t2 + (-q0[j] + 3 * p1[j] - 3 * p2[j] + q3[j]) * t3))); }
  }
  if (!closed) out.push(pts[N - 1]);
  return out;
}
// hatching clipped to a path: parallel strokes with slightly irregular length/spacing
export function hatch(c, path, { x0, y0, x1, y1, ang = -.9, gap = 7, lw = 1.3, ink = INK, alpha = .55, seed = 3, mask = null } = {}) {
  c.save(); c.clip(path); c.lineCap = 'round'; c.lineWidth = lw; c.strokeStyle = ink; c.globalAlpha *= alpha;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2, ca = Math.cos(ang), sa = Math.sin(ang);
  c.beginPath();
  for (let d = -R, i = 0; d <= R; d += gap, i++) {
    const j = (hash(i, seed) - .5) * gap * .5, l0 = -R * (.6 + hash(i, seed + 1) * .4), l1 = R * (.6 + hash(i, seed + 2) * .4);
    const px = cx - sa * (d + j), py = cy + ca * (d + j);
    if (mask && !mask(px, py)) continue;
    c.moveTo(px + ca * l0, py + sa * l0); c.lineTo(px + ca * l1, py + sa * l1);
  }
  c.stroke(); c.restore();
}
// short hatch marks in a small zone (eye bags, cheek shadow, creases)
export function marks(c, x, y, n, len, { ang = -1.1, gap = 4, lw = 1.1, alpha = .6, ink = INK } = {}) {
  c.save(); c.lineCap = 'round'; c.lineWidth = lw; c.strokeStyle = ink; c.globalAlpha *= alpha; c.beginPath();
  for (let i = 0; i < n; i++) { const px = x + i * gap, l = len * (1 - Math.abs(i - (n - 1) / 2) / n); c.moveTo(px, y); c.lineTo(px + Math.cos(ang) * l, y + Math.sin(ang) * l); }
  c.stroke(); c.restore();
}

// ---------- patterns ----------
export function houndstooth(a = '#3a3633', b = '#24211f', s = 14) {
  return cache(`ht${a}${b}${s}`, s * 2, s * 2, x => {
    x.fillStyle = a; x.fillRect(0, 0, s * 2, s * 2); x.fillStyle = b;
    const tooth = (ox, oy) => { x.beginPath(); x.moveTo(ox, oy); x.lineTo(ox + s * .5, oy); x.lineTo(ox + s, oy + s * .5); x.lineTo(ox + s, oy + s); x.lineTo(ox + s * .5, oy + s); x.lineTo(ox, oy + s * .5); x.closePath(); x.fill(); };
    tooth(0, 0); tooth(s, s); x.fillRect(s * .5, s * .15, s * .2, s * .2); x.fillRect(s * 1.5, s * 1.15, s * .2, s * .2);
  });
}
export function tweed(a = '#5b4636', s = 10) {
  return cache(`tw${a}${s}`, s * 4, s * 4, x => {
    x.fillStyle = a; x.fillRect(0, 0, s * 4, s * 4);
    for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(i * s, 0, s * .45, s * 4); x.fillStyle = 'rgba(255,240,220,.05)'; x.fillRect(0, i * s, s * 4, s * .4); }
  });
}

// ---------- faded floral wallpaper (painted, photographic: soft, dense, aged) ----------
function rose(x, cx, cy, r, col, dark, light, rot = 0) {
  x.save(); x.translate(cx, cy); x.rotate(rot);
  for (let k = 0; k < 7; k++) {                                                      // outer petals
    const a = k / 7 * TAU + .3, px = Math.cos(a) * r * .5, py = Math.sin(a) * r * .42;
    x.fillStyle = mix(col, light, .25 + .25 * Math.sin(a + 1)); x.beginPath(); x.ellipse(px, py, r * .55, r * .4, a, 0, TAU); x.fill();
    x.strokeStyle = rgba(dark, .45); x.lineWidth = r * .06; x.beginPath(); x.ellipse(px * 1.05, py * 1.05, r * .5, r * .34, a, a - 1.2, a + .6); x.stroke();
  }
  for (let k = 0; k < 4; k++) {                                                      // cupped centre, darker inward
    const rr = r * (.62 - k * .13); x.fillStyle = mix(col, dark, .15 + k * .2); x.beginPath(); x.ellipse(k * r * .03, -k * r * .02, rr, rr * .8, k * .7, 0, TAU); x.fill();
    x.strokeStyle = rgba(light, .5); x.lineWidth = r * .05; x.beginPath(); x.ellipse(k * r * .03, -k * r * .02, rr, rr * .8, k * .7, -2.6, -1.2); x.stroke();
  }
  x.fillStyle = dark; x.beginPath(); x.ellipse(r * .1, -r * .06, r * .12, r * .08, .4, 0, TAU); x.fill();
  x.restore();
}
function leaf(x, cx, cy, l, a, col, dark) {
  x.save(); x.translate(cx, cy); x.rotate(a);
  x.fillStyle = col; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(l * .45, -l * .34, l, 0); x.quadraticCurveTo(l * .45, l * .34, 0, 0); x.fill();
  x.fillStyle = dark; x.beginPath(); x.moveTo(0, 0); x.lineTo(l, 0); x.quadraticCurveTo(l * .45, l * .34, 0, 0); x.fill();       // shaded half
  x.strokeStyle = rgba(dark, .7); x.lineWidth = l * .04; x.beginPath(); x.moveTo(0, 0); x.lineTo(l * .95, 0); for (let k = 1; k < 5; k++) { x.moveTo(l * k / 5, 0); x.lineTo(l * k / 5 + l * .1, -l * .14); } x.stroke();
  x.restore();
}
export function floral({ w = W, h = H, paper = '#dccbb0', flower = '#837fa0', fdark = '#46425e', flight = '#d9d4e0', leafC = '#9aa391', leafD = '#6b7564', seed = 1, stain = .8 } = {}) {
  return cache(`floral3${w}${h}${paper}${flower}${seed}${stain}`, w, h, x => {
    x.fillStyle = paper; x.fillRect(0, 0, w, h);
    const r = rng(seed * 77);
    const tw = 210, th = 250;
    for (let ty = -th; ty < h + th; ty += th) for (let tx = -tw; tx < w + tw; tx += tw) {
      const ox = tx + ((Math.round(ty / th)) & 1) * tw / 2;
      x.strokeStyle = rgba(leafD, .8); x.lineWidth = 2.4; x.beginPath(); x.moveTo(ox + 30, ty + th + 20); x.bezierCurveTo(ox + 140, ty + 170, ox - 10, ty + 90, ox + 120, ty - 20); x.stroke();   // stem
      for (let k = 0; k < 11; k++) { const u = k / 10, sx = lerp(ox + 30, ox + 120, u) + Math.sin(u * 6) * 40, sy = lerp(ty + th, ty, u); leaf(x, sx, sy, 34 + r() * 22, (k % 2 ? -1 : 1) * (.6 + r() * .6) - Math.PI / 2 + (k % 2 ? Math.PI : 0) * 0, leafC, leafD); }
      rose(x, ox + 70, ty + 150, 46, flower, fdark, flight, r() * TAU); rose(x, ox + 140, ty + 30, 32, mix(flower, '#a49ab0', .4), fdark, flight, r() * TAU);
      rose(x, ox + 10, ty + 70, 24, mix(flower, paper, .2), fdark, flight, r() * TAU);
      for (let k = 0; k < 6; k++) { x.fillStyle = mix(flower, fdark, r() * .5); x.beginPath(); x.ellipse(ox + 160 + k * 7, ty + 190 - k * 12, 5, 7, .5, 0, TAU); x.fill(); }   // buds
    }
    // soften like a printed / photographed paper, then age it
    const tmp = mk(w, h), tx2 = tmp.getContext('2d'); tx2.filter = 'blur(1.3px)'; tx2.drawImage(x.canvas, 0, 0); x.clearRect(0, 0, w, h); x.drawImage(tmp, 0, 0);
    const im = x.getImageData(0, 0, w, h), d = im.data;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const o = (j * w + i) * 4, n = fbm(i / 300 + seed, j / 300, 1, 4), fade = .72 + .26 * n;
      d[o] = lerp(222, d[o], fade); d[o + 1] = lerp(204, d[o + 1], fade); d[o + 2] = lerp(170, d[o + 2], fade);
      const st = clamp(fbm(i / 140, j / 340, seed + 5, 4) * 2.0 - .35) * stain, gr = (hash(i * 1.7 + j * 3.3, seed) - .5) * 14;
      d[o] = d[o] * (1 - st * .3) + gr; d[o + 1] = d[o + 1] * (1 - st * .4) + gr; d[o + 2] = d[o + 2] * (1 - st * .58) + gr;
    }
    x.putImageData(im, 0, 0);
    for (let k = 0; k < 160; k++) { x.fillStyle = `rgba(140,90,40,${.04 + hash(k, seed) * .12})`; x.beginPath(); x.arc(hash(k, seed + 1) * w, hash(k, seed + 2) * h, 1 + hash(k, seed + 3) * 6, 0, TAU); x.fill(); }
  });
}

// old photograph: warm burned rounded vignette
export function photoVignette(c, a = 1) {
  const g = c.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .95);
  g.addColorStop(0, 'rgba(60,35,15,0)'); g.addColorStop(.7, `rgba(70,40,15,${.35 * a})`); g.addColorStop(1, `rgba(20,10,4,${.95 * a})`);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = `rgba(232,200,150,${.35 * a})`; c.fillRect(0, 0, W, H); c.restore();
}
// paper tooth over everything (flat art needs it to not look vector)
export function paperTooth(c, a = .25, seed = 2) {
  const t = cache('tooth' + seed, W / 2, H / 2, x => { const w = W / 2, h = H / 2, im = x.createImageData(w, h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = 128 + (fbm(i / 60, j / 60, seed, 3) * 50 + (hash(i * 3.1 + j * 7.7, seed) - .5) * 40), o = (j * w + i) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = v; im.data[o + 3] = 255; } x.putImageData(im, 0, 0); });
  c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = a; c.drawImage(t, 0, 0, W, H); c.restore();
}

// ---------- cel tone, brush, frame ----------
// hard-edged darker tone (the games' cel shading): clipped to `clip`, no outline
export function tone(c, clip, pts, col, a = 1) { c.save(); c.clip(clip); c.globalAlpha *= a; c.fillStyle = col; c.fill(pts instanceof Path2D ? pts : toPath(pts, { wob: 0 })); c.restore(); }
// tapered bold stroke (brows, nose, strands) — pts get smoothed
export function brush(c, pts, w, { col = INK, taper = .8, n = 6 } = {}) { inkStroke(c, pts.length > 2 ? smooth(pts, n, false) : pts, w, col, taper); }
function inkStroke(c, p, w, col, taper) {
  const N = p.length; if (N < 2) return; const L = [], R = [];
  for (let i = 0; i < N; i++) { const a = p[Math.max(0, i - 1)], b = p[Math.min(N - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, u = i / (N - 1);
    const ww = w * .5 * ((1 - taper) + taper * Math.pow(Math.sin(Math.PI * u), .5)); L.push([p[i][0] - dy / d * ww, p[i][1] + dx / d * ww]); R.push([p[i][0] + dy / d * ww, p[i][1] - dx / d * ww]); }
  c.save(); c.fillStyle = col; c.beginPath(); [...L, ...R.reverse()].forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); c.restore();
}
// the rounded black viewport every Rusty Lake scene sits in
export function viewport(c, { r = 70, pad = 0, soft = 60 } = {}) {
  const k = cache(`vp${r}${pad}${soft}`, W, H, x => {
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'destination-out';
    x.filter = `blur(${soft / 3}px)`; x.beginPath(); x.roundRect(pad + soft * .5, pad + soft * .5, W - 2 * pad - soft, H - 2 * pad - soft, r); x.fill(); x.filter = 'none';
    x.globalCompositeOperation = 'source-over'; const g = x.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * 1.05); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  });
  c.drawImage(k, 0, 0);
}
// characters cast one big soft shadow onto the wall behind them: draw them into a layer, then call this
export function wallShadow(c, src, { dx = 34, dy = 14, blur = 18, a = .42 } = {}) {
  c.save(); c.globalAlpha = a; c.filter = `brightness(0) blur(${blur}px)`; c.drawImage(src, dx, dy); c.restore();
}

// ---------- the face ----------
// Rusty Lake face, front view. local: (0,0) between the eyes' line and the nose; fw = half width at the cheekbones,
// fh ≈ eye-line→chin. Bold near-black lines; cel tones: eye-bag crescents, cheek hollows, nose side, under-jaw.
// o: { skin, shade, iris, open 0..1, look [-1..1,-1..1], brow (+ = sad inner-up, - = stern), lips, age, bags, mask, ears, jaw (0 round..1 square) }
export function face(c, o) {
  const { fw = 60, fh = 80, skin = '#e4dfd2', shade = '#b6b0a3', iris = '#8e8a84', open = 1, look = [0, 0], brow = .1, lips = '#b56a5c', age = 0, bags = 1, seed = 1, mask = false, ears = true, jaw = .5, browCol = INK, browW = 1, neck = 1.7 } = o;
  const lw = Math.max(3.2, fw * .085);
  const jy = fh * .62, jx = fw * lerp(.7, .84, jaw);
  const P = [[0, -fh * 1.15], [fw * .72, -fh * 1.02], [fw * .98, -fh * .6], [fw, -fh * .12], [fw * .96, fh * .28], [jx, jy], [fw * .42, fh * .94], [fw * .16, fh * 1.04], [0, fh * 1.06]];
  const headPts = smooth([...P, ...P.slice(1, -1).reverse().map(([x, y]) => [-x, y])], 5);
  // neck (behind the jaw) with the under-chin cel shadow
  const NK = fh * neck, neckP = toPath([[-fw * .44, fh * .7], [fw * .44, fh * .7], [fw * .48, NK], [-fw * .48, NK]], { seed });
  c.fillStyle = skin; c.fill(neckP);
  tone(c, neckP, smooth([[-fw * .5, fh * .7], [fw * .5, fh * .7], [fw * .5, fh * 1.22], [0, fh * 1.36], [-fw * .5, fh * 1.22]], 4), shade, .9);
  c.save(); c.lineWidth = lw; c.strokeStyle = INK; c.lineCap = 'round'; c.beginPath(); c.moveTo(-fw * .44, fh * .8); c.lineTo(-fw * .48, NK); c.moveTo(fw * .44, fh * .8); c.lineTo(fw * .48, NK); c.stroke(); c.restore();
  if (age > 0 && neck > 1.3) for (const m of [-1, 1]) brush(c, [[m * fw * .18, fh * 1.2], [m * fw * .22, fh * 1.45], [m * fw * .2, NK * .97]], lw * .5);
  // ears
  if (ears && !mask) for (const m of [1, -1]) {
    const ep = shape(c, smooth([[m * fw * .95, -fh * .28], [m * fw * 1.2, -fh * .34], [m * fw * 1.26, -fh * .05], [m * fw * 1.14, fh * .28], [m * fw * .92, fh * .3]], 5, false), skin, { lw, seed: seed + 5, close: false });
    brush(c, [[m * fw * 1.14, -fh * .2], [m * fw * 1.04, -fh * .05], [m * fw * 1.1, fh * .14]], lw * .6);
  }
  const head = toPath(headPts, { seed, wob: .6 });
  c.fillStyle = mask ? '#ecebe6' : skin; c.fill(head);
  if (!mask) {
    // cel tones: far-side cheek, cheek hollows under the cheekbones, temple, eye sockets
    tone(c, head, [[fw * .62, -fh * 1.2], [fw * 1.1, -fh * 1.2], [fw * 1.1, fh * 1.1], [fw * .3, fh * 1.1], [fw * .62, fh * .62], [fw * .74, fh * .1], [fw * .7, -fh * .5]], shade, .75);
    for (const m of [-1, 1]) tone(c, head, smooth([[m * fw * .9, fh * .08], [m * fw * .62, fh * .3], [m * fw * .56, fh * .62], [m * fw * .7, fh * .72], [m * fw * .98, fh * .3]], 4), shade, m > 0 ? .55 : .7);
  }
  c.save(); c.lineWidth = lw; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke(head); c.restore();

  const ey = 0, ex = fw * .42, ew = fw * .27, eh = ew * .46;
  for (const m of [-1, 1]) {
    const x0 = m * ex;
    if (mask) {                                                           // white mask: hollow sockets with a real eye inside
      shape(c, smooth([[x0 - ew * 1.1, ey], [x0, ey - eh * 1.5], [x0 + ew * 1.1, ey], [x0, ey + eh * 1.4]], 6), '#121010', { lw: lw * .6 });
      const px = x0 + look[0] * ew * .3, py = ey + look[1] * eh * .25;
      c.fillStyle = '#cfcac0'; c.beginPath(); c.ellipse(px, py, ew * .5, eh * .7 * Math.max(.05, open), 0, 0, TAU); c.fill();
      c.fillStyle = INK; c.beginPath(); c.arc(px, py, eh * .38 * Math.max(.15, open), 0, TAU); c.fill();
      continue;
    }
    const ix = x0 - m * ew * .05;
    // eye-bag crescent (the tired Rusty Lake look) + socket shadow above the lid
    if (bags > 0) shape(c, smooth([[ix - ew * 1.05, ey + eh * .1], [ix - ew * .2, ey + eh * (1.3 + bags * .9)], [ix + ew * 1.15, ey - eh * .1], [ix + ew * .2, ey + eh * 1.0]], 5), rgba(shade, .95), { lw: 0 });
    shape(c, smooth([[ix - ew * 1.1, ey - eh * .2], [ix, ey - eh * 2.0], [ix + ew * 1.2, ey - eh * .5], [ix, ey - eh * 1.15]], 5), rgba(shade, .6), { lw: 0 });
    const eye = toPath(smooth([[ix - ew, ey + eh * .1], [ix - ew * .35, ey - eh * .95], [ix + ew * .55, ey - eh * .85], [ix + ew * 1.05, ey - eh * .05], [ix + ew * .3, ey + eh * .85], [ix - ew * .5, ey + eh * .75]], 6), { wob: 0 });
    c.fillStyle = '#ebe8e1'; c.fill(eye);
    c.save(); c.clip(eye);
    const px = ix + look[0] * ew * .42, py = ey + look[1] * eh * .35, ir = eh * .86;
    c.fillStyle = iris; c.beginPath(); c.arc(px, py, ir, 0, TAU); c.fill(); c.lineWidth = lw * .45; c.strokeStyle = INK; c.stroke();
    c.fillStyle = INK; c.beginPath(); c.arc(px, py, ir * .48, 0, TAU); c.fill();
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(ix - ew * 1.2, ey - eh * 1.2, ew * 2.4, eh * .55);          // lid shadow on the eyeball
    if (open < 1) { const ly = lerp(ey + eh * .9, ey - eh * 1.05, open); c.fillStyle = skin; c.fillRect(ix - ew * 1.3, ey - eh * 1.6, ew * 2.6, ly - (ey - eh * 1.6)); }
    c.restore();
    c.save(); c.lineWidth = lw * .45; c.strokeStyle = INK; c.stroke(eye); c.restore();
    const ly = lerp(ey + eh * .8, ey - eh * .95, open);
    brush(c, [[ix - ew * 1.12, ey + eh * .2], [ix - ew * .3, lerp(ey + eh * .85, ey - eh * 1.02, open)], [ix + ew * .6, lerp(ey + eh * .8, ey - eh * .9, open)], [ix + ew * 1.22, ey + eh * .05]], lw * .95, { taper: .5 });   // heavy upper lid
    brush(c, [[ix - ew * .7, ey + eh * .85], [ix + ew * .2, ey + eh * .98], [ix + ew * .85, ey + eh * .55]], lw * .32, { taper: .9 });
    // brows: bold, mostly straight; brow>0 lifts the inner end (sorrow), brow<0 pulls it down (stern)
    const by = ey - eh * 2.7;
    brush(c, [[x0 - m * ew * 1.0, by - brow * eh * 1.4], [x0, by - eh * .35 - brow * eh * .3], [x0 + m * ew * 1.25, by + eh * .25]], lw * 1.15 * browW, { col: browCol, taper: .55 });
  }
  if (mask) {
    brush(c, [[-fw * .2, fh * .62], [0, fh * .6], [fw * .2, fh * .62]], lw * .7);
    brush(c, [[fw * .52, -fh * .9], [fw * .4, -fh * .6], [fw * .46, -fh * .4]], lw * .35);
    brush(c, [[-fw * .36, fh * .2], [-fw * .42, fh * .48]], lw * .35);
    return;
  }
  // nose: the bold "7" — from the inner brow down the shadow side, hooked into the nostril
  tone(c, head, smooth([[fw * .1, -fh * .05], [fw * .2, fh * .3], [fw * .06, fh * .4], [fw * .02, fh * .2]], 3), shade, .9);
  brush(c, [[fw * .08, -fh * .12], [fw * .12, fh * .12], [fw * .2, fh * .32], [fw * .12, fh * .4]], lw * .95, { taper: .6 });
  brush(c, [[fw * .12, fh * .4], [0, fh * .42], [-fw * .12, fh * .36]], lw * .8, { taper: .7 });
  brush(c, [[-fw * .14, fh * .3], [-fw * .17, fh * .37]], lw * .5);
  // mouth: pale lips, dark parting line with dropped corners, shadow under the lower lip
  const my = fh * .66, mw = fw * .3;
  shape(c, smooth([[-mw, my], [-mw * .4, my - fh * .07], [0, my - fh * .04], [mw * .4, my - fh * .07], [mw, my], [0, my + fh * .02]], 4), lips, { lw: 0 });
  shape(c, smooth([[-mw * .9, my + fh * .01], [0, my + fh * .02], [mw * .9, my + fh * .01], [mw * .5, my + fh * .1], [0, my + fh * .12], [-mw * .5, my + fh * .1]], 4), mix(lips, '#ffffff', .2), { lw: 0 });
  tone(c, head, smooth([[-mw * .45, my + fh * .14], [mw * .45, my + fh * .14], [0, my + fh * .22]], 3), shade, .8);
  brush(c, [[-mw * 1.08, my + fh * .04], [-mw * .4, my - fh * .005], [0, my + fh * .01], [mw * .4, my - fh * .005], [mw * 1.08, my + fh * .04]], lw * .75, { taper: .7 });
  if (age > 0) {
    for (const m of [-1, 1]) {
      brush(c, [[m * fw * .32, fh * .3], [m * fw * .44, fh * .5], [m * fw * .4, fh * .74]], lw * .5 * age);               // nasolabial
      brush(c, [[m * mw * 1.1, my + fh * .08], [m * mw * 1.2, my + fh * .22]], lw * .45 * age);                              // marionette
      brush(c, [[m * fw * .78, -fh * .08], [m * fw * .9, -fh * .02]], lw * .4 * age);
    }
    for (let k = 0; k < 3; k++) brush(c, [[-fw * .45, -fh * (.7 + k * .12)], [0, -fh * (.74 + k * .12)], [fw * .45, -fh * (.7 + k * .12)]], lw * .4 * age, { taper: .9 });
    brush(c, [[fw * .05, fh * .9], [fw * .14, fh * .98]], lw * .45 * age);
  } else brush(c, [[-fw * .06, fh * .92], [fw * .06, fh * .93]], lw * .45);
}

// hand: palm + four fingers + thumb, bold outline. a = rotation; s = scale (≈ 1 → 40px long); curl 0..1 bends the fingers
export function hand(c, x, y, s, a, skin = '#e4dfd2', { curl = .2, spread = .15, shade = '#b6b0a3', flip = 1 } = {}) {
  c.save(); c.translate(x, y); c.rotate(a); c.scale(s * flip, s);
  const lw = Math.min(LW, 4.6 * s) / s;
  // fingers first (behind the palm edge)
  for (let k = 0; k < 4; k++) {
    const fx = -9 + k * 6.2, ang = (k - 1.5) * spread, L = [16, 19, 18, 14][k], cb = curl * 10;
    c.save(); c.translate(fx, 10); c.rotate(ang);
    shape(c, smooth([[-3.1, 0], [-3.3, L * .6], [-2.2 + cb * .2, L], [2.6 + cb * .2, L + .5], [3.1, L * .55], [3, 0]], 3), skin, { lw: lw * .8, wob: 0 });
    c.restore();
  }
  const palm = shape(c, smooth([[-12, -14], [12, -14], [14, 4], [12, 13], [-12, 13], [-14, 2]], 3), skin, { lw, wob: 0 });
  tone(c, palm, [[4, -16], [16, -16], [16, 16], [6, 16]], shade, .7);
  shape(c, smooth([[-12, -6], [-22, 4], [-20, 13], [-12, 8]], 3), skin, { lw: lw * .85, wob: 0 });                 // thumb
  c.restore();
}

// hair covering the top of the head (draw after face). part: x of the parting (null = swept back).
// col/dark: base + cel tone; strands: number of bold flow lines. Local coords match face().
export function hairCap(c, fw, fh, col, dark, { part = 0, line = .62, side = 1.04, low = -.2, strands = 5, seed = 1 } = {}) {
  const lw = Math.max(3.2, fw * .085), hl = -fh * line;
  const pts = [[-fw * side, -fh * low * -1], [-fw * side * 1.02, -fh * .7], [-fw * .8, -fh * 1.2], [0, -fh * 1.34], [fw * .8, -fh * 1.2], [fw * side * 1.02, -fh * .7], [fw * side, -fh * low * -1],
    [fw * .9, -fh * .3], [fw * .7, hl], [part === null ? fw * .2 : part + fw * .14, hl - fh * .12], [part ?? 0, hl - fh * (part === null ? .04 : .2)], [part === null ? -fw * .2 : part - fw * .14, hl - fh * .12], [-fw * .7, hl], [-fw * .9, -fh * .3]];
  const p = shape(c, smooth(pts, 4), col, { lw, seed });
  tone(c, p, [[fw * .3, -fh * 1.5], [fw * 1.3, -fh * 1.5], [fw * 1.3, fh * .2], [fw * .62, fh * .2], [fw * .55, -fh * .9]], dark, .9);
  for (let k = 0; k < strands; k++) { const u = (k + .5) / strands, m = u < .5 ? -1 : 1, x0 = (part ?? 0) + m * fw * .08, xe = lerp(-fw * .95, fw * .95, u);
    const ye = lerp(hl - fh * .08, -fh * .42, Math.pow(Math.abs(2 * u - 1), 2.5)); brush(c, [[x0, hl - fh * .2 - Math.abs(u - .5) * fh * .3], [lerp(x0, xe, .5), -fh * (1.05 + Math.sin(u * Math.PI) * .12)], [xe * 1.02, ye]], lw * .4, { col: dark }); }
}

// painted-set texture: overlay mottled brushwork onto a cached background so flat fills read as paint (use inside cache())
export function paintOver(x, { alpha = .35, seed = 3, scale = 90, streak = 40 } = {}) {
  const w = W / 2, h = H / 2, n = mk(w, h), nx = n.getContext('2d'), im = nx.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = 128 + fbm(i / scale, j / scale, seed, 4) * 66 + fbm(i / 11, j / streak, seed + 4, 2) * 18, o = (j * w + i) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = v; im.data[o + 3] = 255; }
  nx.putImageData(im, 0, 0); x.save(); x.globalCompositeOperation = 'overlay'; x.globalAlpha = alpha; x.drawImage(n, 0, 0, W, H); x.restore();
}

// hands folded at the waist (servants, mourners, portraits): forearms angle in from the elbows (ex,ey ± side), white cuffs,
// right hand resting on the left with fingers together. x,y = where the hands meet. s scales the whole gesture.
export function foldedHands(c, x, y, { s = 1, skin = '#ddd6c7', shade = '#b3ab9c', sleeve = '#4c4946', sleeveD = '#2f2d2b', cuff = '#f0ede6', elbowDX = 52, elbowDY = -42 } = {}) {
  c.save(); c.translate(x, y); c.scale(s, s); const lw = 3.2 / Math.max(.6, s) * Math.min(1, s * 1.2);
  for (const m of [-1, 1]) {
    const fa = shape(c, smooth([[m * elbowDX, elbowDY], [m * (elbowDX - 18), elbowDY - 4], [m * 14, -10], [m * 14, 6], [m * (elbowDX - 8), elbowDY + 20]], 2), sleeve, { lw, seed: 140 + m });
    tone(c, fa, [[m * 10, 2], [m * (elbowDX + 8), elbowDY + 14], [m * (elbowDX + 8), elbowDY + 32], [m * 10, 14]], sleeveD, .7);
    shape(c, [[m * 20, -12], [m * 12, -10], [m * 12, 8], [m * 20, 8]], cuff, { lw: lw * .8, seed: 142 + m });
  }
  shape(c, smooth([[-12, -6], [8, -4], [22, 2], [24, 10], [8, 12], [-12, 8]], 3), skin, { lw, seed: 144 });
  for (let k = 0; k < 3; k++) brush(c, [[8 + k * 5, 6], [12 + k * 5, 11]], 1.6);
  const rh = shape(c, smooth([[12, -10], [-6, -12], [-22, -8], [-26, -1], [-20, 4], [-4, 4], [12, 6]], 3), skin, { lw, seed: 146 });
  tone(c, rh, [[-30, 0], [14, 0], [14, 8], [-30, 8]], shade, .9);
  for (let k = 0; k < 3; k++) brush(c, [[-6 - k, -10 + k * 4.4], [-22 + k * 1.5, -7 + k * 3.6]], 1.6);
  brush(c, [[6, -6], [9, -1]], 1.4);
  c.restore();
}
