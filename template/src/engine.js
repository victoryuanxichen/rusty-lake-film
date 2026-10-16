// engine.js — the motion-styles engine. Every frame is a pure function of t (seconds).
// Pipeline per frame: shot(s) paint a 2D canvas (and may composite three.js renders into it)
//   → transition between shots (if any) → bloom (canvas2D) → GL post pass (grain, vignette, chroma, VHS…) → #out.
// Render contract used by render.mjs: window.ready, renderAt(t), renderSheet(...), gpuInfo(), window.DUR, window.PROJECT.
// Full API reference: references/engine.md in the skill.
import * as THREE from 'three';
export { THREE };

export const P = window.PROJECT;
export const W = P.width, H = P.height, FPS = P.fps || 30, DUR = P.duration, BPM = P.bpm || 120, BEAT = 60 / BPM;
export const TAU = Math.PI * 2;
window.DUR = DUR;

// ───────────────────────── math ─────────────────────────
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => clamp((t - a) / (b - a));                 // 0→1 progress of t through [a, b]
export const remap = (x, a, b, c, d) => c + (d - c) * clamp((x - a) / (b - a));
export const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const easeIn = x => Math.pow(clamp(x), 3);
export const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
export const easeInOut = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const expoOut = x => { x = clamp(x); return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); };
export const expoInOut = x => { x = clamp(x); return x === 0 || x === 1 ? x : x < .5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2; };
export const backOut = (x, s = 1.7) => { x = clamp(x); return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
export const elasticOut = x => { x = clamp(x); return x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * TAU / 3) + 1; };
// damped spring 0→1 with overshoot; x in seconds since release
export const spring = (x, freq = 2.2, damp = 6) => x <= 0 ? 0 : 1 - Math.exp(-damp * x) * Math.cos(freq * TAU * x);
export const pingpong = x => 1 - Math.abs(((x % 2) + 2) % 2 - 1);

// stable randomness (never Math.random(): frames render in parallel and out of order)
export const hash = (i, j = 0) => { const x = Math.sin(i * 127.1 + j * 269.5 + 311.7) * 43758.5453; return x - Math.floor(x); };   // optional 2nd seed: hash(i, 1) and hash(i, 2) are independent
export const hash2 = (i, j) => hash(i * 57.31 + j * 113.17);
export const rng = seed => { let s = (seed * 2654435761) >>> 0 || 1; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
export const gauss = r => { const u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };

// simplex noise, 3D (2D = a slice). Output ≈ [-1, 1].
const G3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
const PERM = new Uint8Array(512);
{ const r = rng(1337), p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; }
export function noise3(x, y, z) {
  const F = 1 / 3, G = 1 / 6, s = (x + y + z) * F, i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
  const t = (i + j + k) * G, x0 = x - i + t, y0 = y - j + t, z0 = z - k + t;
  let i1, j1, k1, i2, j2, k2;
  if (x0 >= y0) { if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; } else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; } }
  else { if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; } else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; } else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } }
  const x1 = x0 - i1 + G, y1 = y0 - j1 + G, z1 = z0 - k1 + G, x2 = x0 - i2 + 2 * G, y2 = y0 - j2 + 2 * G, z2 = z0 - k2 + 2 * G, x3 = x0 - .5, y3 = y0 - .5, z3 = z0 - .5;
  const ii = i & 255, jj = j & 255, kk = k & 255;
  const c = (tx, ty, tz, g) => { let q = .6 - tx * tx - ty * ty - tz * tz; if (q < 0) return 0; q *= q; const v = G3[g % 12]; return q * q * (v[0] * tx + v[1] * ty + v[2] * tz); };
  return 32 * (c(x0, y0, z0, PERM[ii + PERM[jj + PERM[kk]]]) + c(x1, y1, z1, PERM[ii + i1 + PERM[jj + j1 + PERM[kk + k1]]])
    + c(x2, y2, z2, PERM[ii + i2 + PERM[jj + j2 + PERM[kk + k2]]]) + c(x3, y3, z3, PERM[ii + 1 + PERM[jj + 1 + PERM[kk + 1]]]));
}
export const noise2 = (x, y) => noise3(x, y, .37);
export const fbm = (x, y, z = 0, oct = 4) => { let a = .5, f = 1, s = 0; for (let o = 0; o < oct; o++) { s += a * noise3(x * f, y * f, z * f); a *= .5; f *= 2; } return s; };

// ───────────────────────── time ─────────────────────────
// stepped time: the picture changes `fps` times a second (12 = "on twos" for hand-drawn / stop-motion)
export const stepTime = (t, fps = 12) => Math.floor(t * fps + 1e-6) / fps;
// 1 on each beat, decaying until the next (k = sharpness)
export const beatPulse = (t, k = 7) => { const b = (t - (P.beatOffset || 0)) / BEAT; return Math.exp(-(b - Math.floor(b)) * k); };
export const beatOf = t => Math.floor((t - (P.beatOffset || 0)) / BEAT + 1e-6);

// ───────────────────────── colour ─────────────────────────
export const hex2rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h.slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
export const rgba = (h, a = 1) => { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; };
export const mix = (a, b, k) => { const A = hex2rgb(a), B = hex2rgb(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(k))).toString(16).padStart(2, '0')).join(''); };
// ramp(['#000', '#f80', '#fff'], k): piecewise mix through evenly spaced stops
export const ramp = (stops, k) => { k = clamp(k) * (stops.length - 1); const i = Math.min(stops.length - 2, Math.floor(k)); return mix(stops[i], stops[i + 1], k - i); };

// ───────────────────────── canvases ─────────────────────────
export const mk = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const out = document.getElementById('out'); out.width = W; out.height = H;
const main = mk(), mainCtx = main.getContext('2d');
const bufA = mk(), bufB = mk();
const reset = c => { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.shadowBlur = 0; c.shadowColor = 'transparent'; c.letterSpacing = '0px'; c.imageSmoothingEnabled = true; };
// layer(name): a reusable scratch canvas, cleared, for masks / offscreen compositing. Returns its 2D context (ctx.canvas is the canvas).
const LAYERS = {};
export function layer(name, w = W, h = H) {
  let c = LAYERS[name]; if (!c || c.width !== Math.round(w) || c.height !== Math.round(h)) c = LAYERS[name] = mk(w, h);
  const x = c.getContext('2d'); reset(x); x.clearRect(0, 0, c.width, c.height); return x;
}
// cache(key, w, h, draw): paint something static ONCE and reuse the canvas every frame (big speed-up for watercolour etc.)
const CACHE = {};
export function cache(key, w, h, draw) {
  if (!CACHE[key]) { const c = mk(w, h), x = c.getContext('2d'); draw(x, c); CACHE[key] = c; }
  return CACHE[key];
}
// 2D camera: look at world point (x, y) with zoom z and rotation rot, placed at screen point (cx, cy). Use inside save()/restore().
export function cam(c, { x = W / 2, y = H / 2, z = 1, rot = 0, cx = W / 2, cy = H / 2 } = {}) { c.translate(cx, cy); c.rotate(rot); c.scale(z, z); c.translate(-x, -y); }
// pixel art: draw into a low-res canvas, then blit nearest-neighbour
export function pixelLayer(name, w, h) { const x = layer(name, w, h); x.imageSmoothingEnabled = false; return x; }
// integer: whole-number scale only (every art pixel = the same number of screen pixels; the rest is letterbox in the shot's bg)
export function blitPixels(c, px, { fit = 'contain', integer = true } = {}) {
  let s = fit === 'cover' ? Math.max(W / px.canvas.width, H / px.canvas.height) : Math.min(W / px.canvas.width, H / px.canvas.height);
  if (integer && s >= 1) s = fit === 'cover' ? Math.ceil(s) : Math.floor(s);
  const w = px.canvas.width * s, h = px.canvas.height * s; c.imageSmoothingEnabled = false; c.drawImage(px.canvas, (W - w) / 2, (H - h) / 2, w, h); c.imageSmoothingEnabled = true;
}
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
export const dither = (v, x, y) => v > BAYER4[(y & 3) * 4 + (x & 3)];   // ordered dithering: is this pixel "on" at level v (0..1)?

// ───────────────────────── geometry ─────────────────────────
export function poly(c, pts, close = true) { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); if (close) c.closePath(); }
// resample a polyline to points every `step` px
export function resample(pts, step = 6, closed = false) {
  if (!pts || pts.length < 2) return pts ? pts.slice() : [];
  const src = closed ? [...pts, pts[0]] : pts, res = [src[0]]; let carry = 0;
  for (let i = 1; i < src.length; i++) {
    const [ax, ay] = src[i - 1], [bx, by] = src[i], L = Math.hypot(bx - ax, by - ay); let d = step - carry;
    while (d <= L) { const k = d / L; res.push([ax + (bx - ax) * k, ay + (by - ay) * k]); d += step; }
    carry = L - (d - step);
  }
  const last = src[src.length - 1]; if (!closed) res.push(last); return res;
}
// Catmull-Rom spline through points (n samples per segment)
export function spline(pts, n = 10, closed = false) {
  const res = [], m = pts.length, at = i => closed ? pts[(i + m) % m] : pts[clamp(i, 0, m - 1)];
  for (let i = 0; i < (closed ? m : m - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let s = 0; s < n; s++) { const t = s / n, t2 = t * t, t3 = t2 * t;
      res.push([0, 1].map(k => .5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3))); }
  }
  if (!closed) res.push(pts[m - 1]); return res;
}
// organic closed blob (amp = radius wobble fraction; t animates it)
export function blob(cx, cy, r, { n = 64, amp = .15, freq = 1.2, seed = 0, t = 0 } = {}) {
  return Array.from({ length: n }, (_, i) => { const a = i / n * TAU, k = 1 + amp * noise3(Math.cos(a) * freq + seed, Math.sin(a) * freq, t); return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k]; });
}
// noisy displacement of a path (hand-drawn wobble). Same seed → same wobble.
export function wobble(pts, amp = 2, { seed = 0, freq = .015, t = 0, step = 8, closed = false } = {}) {
  return resample(pts, step, closed).map(([x, y]) => [x + amp * noise3(x * freq, y * freq, seed + t), y + amp * noise3(x * freq + 31.7, y * freq, seed + t)]);
}

// ───────────────────────── handmade media ─────────────────────────
// pencil: several jittery, slightly broken passes (blue-pencil sketch, construction lines)
export function pencil(c, pts, { col = '#5b7fd6', w = 1.6, passes = 3, jitter = 1.4, alpha = .55, seed = 1, closed = false, step = 7, reveal = 1 } = {}) {
  const r = rng(seed * 13 + 7); let p = resample(pts, step, closed); p = p.slice(0, Math.max(2, Math.ceil(p.length * clamp(reveal)))); if (p.length < 2) return;
  c.save(); c.lineCap = 'round'; c.strokeStyle = col;
  for (let k = 0; k < passes; k++) {
    const ox = (r() - .5) * jitter * 2, oy = (r() - .5) * jitter * 2, q = p.map(([x, y]) => [x + ox + (r() - .5) * jitter, y + oy + (r() - .5) * jitter]);
    for (let i = 0; i < q.length - 1; i++) {
      const n = noise3(q[i][0] * .03, q[i][1] * .03, seed + k * 7.3);
      if (n < -.55) continue;                                   // little gaps: graphite skipping on paper grain
      c.globalAlpha = alpha * (k ? .55 : 1) * (.6 + .4 * n); c.lineWidth = w * (.7 + .5 * r());
      c.beginPath(); c.moveTo(q[i][0], q[i][1]); c.lineTo(q[i + 1][0], q[i + 1][1]); c.stroke();
    }
  }
  c.restore();
}
// ink: a filled, variable-width brush/pen stroke with tapered ends
export function ink(c, pts, { col = '#1d1a17', w = 4, taper = .85, wob = .3, seed = 1, closed = false, step = 4, reveal = 1 } = {}) {
  let p = resample(pts, step, closed); p = p.slice(0, Math.max(2, Math.ceil(p.length * clamp(reveal)))); const n = p.length; if (n < 2) return;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const u = i / (n - 1), prof = closed ? 1 : (1 - taper) + taper * Math.pow(Math.sin(Math.PI * u), .6);
    const ww = w * .5 * prof * (1 + wob * noise3(p[i][0] * .02, p[i][1] * .02, seed));
    L.push([p[i][0] - dy / d * ww, p[i][1] + dx / d * ww]); R.push([p[i][0] + dy / d * ww, p[i][1] - dx / d * ww]);
  }
  c.save(); c.fillStyle = col; poly(c, [...L, ...R.reverse()]); c.fill(); c.restore();
}
// watercolour (Tyler Hobbs' layered deformed polygons): soft bleeding edges, darker pigment rim. Cache it when static!
function deform(pts, depth, vari, r) {
  let p = pts.map(q => [q[0], q[1], q[2] ?? 1]);
  for (let d = 0; d < depth; d++) {
    const q = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), g = gauss(r) * L * vari * a[2], an = r() * TAU;
      q.push(a, [(a[0] + b[0]) / 2 + Math.cos(an) * g, (a[1] + b[1]) / 2 + Math.sin(an) * g, a[2] * (.55 + r() * .9)]);
    }
    p = q;
  }
  return p;
}
// col2: a second pigment the layers drift toward (hue/value variation, like a real wash) · granulation 0..1: pigment
// settling into the paper grain · backruns n: "cauliflower" blooms where water flowed back (lighter centre, dark rim)
export function watercolor(c, pts, { col = '#6fa3c8', col2 = null, alpha = .045, layers = 28, spread = .35, seed = 1, base = 3, detail = 3, rim = .35, granulation = 0, backruns = 0 } = {}) {
  // long edges must be subdivided first: deformation scales with edge length, so a 4-point rectangle would shatter into huge shards
  const perim = pts.reduce((acc, p, i) => acc + Math.hypot(p[0] - pts[(i + 1) % pts.length][0], p[1] - pts[(i + 1) % pts.length][1]), 0), step = clamp(perim / 90, 14, 46);
  const longest = Math.max(...pts.map((p, i) => Math.hypot(p[0] - pts[(i + 1) % pts.length][0], p[1] - pts[(i + 1) % pts.length][1])));
  if (longest > step * 1.5) { pts = resample(pts, step, true); base = Math.min(base, 2); detail = Math.min(detail, 2); }
  const r = rng(seed * 101 + 3), b = deform(pts, base, spread, r), str = typeof col === 'string';
  c.save();
  for (let k = 0; k < layers; k++) { c.globalAlpha = alpha; c.fillStyle = str && col2 ? mix(col, col2, clamp(.5 + .7 * noise3(k * .37, seed, 3))) : col; poly(c, deform(b, detail, spread * .7, r)); c.fill(); }
  if (granulation > 0 || backruns > 0) {
    const xs = b.map(q => q[0]), ys = b.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    c.save(); poly(c, b); c.clip(); const dark = str ? mix(col, '#1a1410', .45) : 'rgba(30,20,15,1)';
    if (granulation > 0) { const n = Math.min(9000, (x1 - x0) * (y1 - y0) / 60 * granulation); c.fillStyle = dark;
      for (let i = 0; i < n; i++) { const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), g = noise3(x * .02, y * .02, seed); if (g < -.1) continue;
        c.globalAlpha = (.08 + .22 * r()) * (g + .2); c.fillRect(x, y, .8 + r() * 1.6, .8 + r() * 1.6); } }
    for (let i = 0; i < backruns; i++) { const cx = lerp(x0, x1, .2 + .6 * r()), cy = lerp(y0, y1, .2 + .6 * r()), rad = Math.min(160, Math.min(x1 - x0, y1 - y0) * (.07 + .09 * r())), bp = blob(cx, cy, rad, { amp: .16, freq: 2.2, seed: seed + i * 7 });
      c.globalCompositeOperation = 'destination-out'; c.globalAlpha = .13; poly(c, bp); c.fill();
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = .14; c.strokeStyle = dark; c.lineWidth = 1.2; poly(c, bp); c.stroke(); }
    c.restore();
  }
  if (rim > 0) { c.globalAlpha = rim * .35; c.strokeStyle = str ? col : 'rgba(0,0,0,.4)'; c.lineWidth = 1.2; poly(c, deform(b, 1, .05, r)); c.stroke(); }
  c.restore();
}
// paper: cached grain + fibres. Draw it first (background) or last with multiply.
export function paper(c, { tone = '#f3ecdf', grain = .07, fibres = 260, seed = 3, blend = 'source-over' } = {}) {
  const tex = cache(`paper:${tone}:${grain}:${fibres}:${seed}:${W}x${H}`, W, H, (x, cv) => {
    x.fillStyle = tone; x.fillRect(0, 0, W, H);
    const s = 2, w = Math.ceil(W / s), h = Math.ceil(H / s), im = x.createImageData(w, h), r = rng(seed);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const v = fbm(i * .012, j * .012, seed, 4) * .6 + (r() - .5) * .8, k = (j * w + i) * 4;
      im.data[k] = im.data[k + 1] = im.data[k + 2] = v > 0 ? 255 : 0; im.data[k + 3] = Math.abs(v) * 255 * grain;
    }
    const t = mk(w, h); t.getContext('2d').putImageData(im, 0, 0); x.drawImage(t, 0, 0, W, H);
    x.lineCap = 'round';
    for (let i = 0; i < fibres; i++) { const px = r() * W, py = r() * H, a = r() * TAU, L = 6 + r() * 26; x.strokeStyle = r() < .5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.18)'; x.lineWidth = .6 + r() * .8;
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + .6) * L * .5, py + Math.sin(a + .6) * L * .5, px + Math.cos(a) * L, py + Math.sin(a) * L); x.stroke(); }
  });
  c.save(); c.globalCompositeOperation = blend; c.drawImage(tex, 0, 0); c.restore();
}
// hatching inside a polygon (pencil shading, engraving, blueprint fills)
export function hatch(c, pts, { angle = .8, gap = 8, col = '#333', w = 1, jitter = .8, alpha = .7, seed = 2 } = {}) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const R = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + gap, r = rng(seed);
  c.save(); poly(c, pts); c.clip(); c.strokeStyle = col; c.lineWidth = w; c.globalAlpha = alpha; c.lineCap = 'round';
  const ca = Math.cos(angle), sa = Math.sin(angle);
  for (let d = -R; d <= R; d += gap) { const j1 = (r() - .5) * jitter * 2, j2 = (r() - .5) * jitter * 2;
    c.beginPath(); c.moveTo(cx + ca * -R - sa * (d + j1), cy + sa * -R + ca * (d + j1)); c.lineTo(cx + ca * R - sa * (d + j2), cy + sa * R + ca * (d + j2)); c.stroke(); }
  c.restore();
}
// halftone dots over a rect; fn(u, v) → darkness 0..1 (u, v in 0..1 across the rect)
export function halftone(c, x, y, w, h, { size = 10, angle = .4, col = '#111', fn = () => .5 } = {}) {
  const ca = Math.cos(angle), sa = Math.sin(angle), R = Math.hypot(w, h);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = col;
  for (let j = -R; j < R; j += size) for (let i = -R; i < R; i += size) {
    const px = x + w / 2 + i * ca - j * sa, py = y + h / 2 + i * sa + j * ca; if (px < x - size || px > x + w + size || py < y - size || py > y + h + size) continue;
    const d = clamp(fn((px - x) / w, (py - y) / h)); if (d < .02) continue;
    c.beginPath(); c.arc(px, py, size * .55 * Math.sqrt(d), 0, TAU); c.fill();
  }
  c.restore();
}

// ───────────────────────── craft helpers (references/craft.md) ─────────────────────────
// bounce(t, o): a dropped object with real gravity, restitution, impact squash and fall stretch. t = seconds since release.
// → { y: height of its base above the rest surface, sy: vertical scale, sx: horizontal scale (volume kept), contact: 1→0 on each impact, impacts: [times] }
// Squash makes the object WIDER: keep neighbours at least squashClearance(width, squash) apart or they will interpenetrate.
export function bounce(t, { h = 5, g = 30, e = .55, squash = .22, stretch = .12, dur = .08, n = 5, axes = 2 } = {}) {
  const T0 = Math.sqrt(2 * h / g), vs = s => axes === 3 ? 1 / Math.sqrt(s) : 1 / s, impacts = [T0];
  if (t < 0) return { y: h, sy: 1, sx: 1, contact: 0, impacts };
  if (t < T0) { const sy = 1 + stretch * (t / T0) ** 2; return { y: h - .5 * g * t * t, sy, sx: vs(sy), contact: 0, impacts }; }
  let tt = t - T0, v = g * T0, at = T0;
  for (let k = 0; k < n; k++) {
    const amt = squash * v / (g * T0);
    if (tt < dur) { const sy = 1 - amt * Math.sin(Math.PI * tt / dur); return { y: 0, sy, sx: vs(sy), contact: 1 - tt / dur, impacts }; }
    tt -= dur; at += dur; v *= e; const Tb = 2 * v / g; impacts.push(at + Tb);
    if (tt < Tb) { const sy = 1 + stretch * .5 * (v / (g * T0)) * Math.abs(1 - 2 * tt / Tb); return { y: v * tt - .5 * g * tt * tt, sy, sx: vs(sy), contact: 0, impacts }; }
    tt -= Tb; at += Tb;
  }
  return { y: 0, sy: 1, sx: 1, contact: 0, impacts };
}
export const squashClearance = (width, squash = .22, axes = 2) => width * ((axes === 3 ? 1 / Math.sqrt(1 - squash) : 1 / (1 - squash)) - 1);
// handheld camera: organic drift + micro jitter. → [dx, dy, rot]
export function shake(t, { amp = 1, freq = 1, seed = 0, rot = .002 } = {}) {
  const f = t * freq; return [amp * (fbm(f * .7, seed, 0, 3) * 10 + noise3(f * 9, seed, 5) * .6), amp * (fbm(f * .7, seed + 9, 0, 3) * 7 + noise3(f * 9, seed + 3, 5) * .5), rot * amp * fbm(f * .5, seed + 4, 0, 2) * 4];
}
// a fill that reads as lit from one side (gives flat shapes volume): returns a CanvasGradient across the box
export function litFill(c, x0, y0, x1, y1, col, { light = .28, dark = .22, lightCol = '#ffffff', darkCol = '#1a1430' } = {}) {
  const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, mix(col, lightCol, light)); g.addColorStop(.55, col); g.addColorStop(1, mix(col, darkCol, dark)); return g;
}
// a sphere-ish radial fill with an off-centre highlight and a darker terminator
export function ballFill(c, cx, cy, r, col, { lx = -.35, ly = -.4, light = .45, dark = .35 } = {}) {
  const g = c.createRadialGradient(cx + lx * r, cy + ly * r, r * .05, cx, cy, r); g.addColorStop(0, mix(col, '#ffffff', light)); g.addColorStop(.6, col); g.addColorStop(1, mix(col, '#140c20', dark)); return g;
}
// aerial perspective: far things lose contrast and take the sky colour
export const atmos = (col, depth, fog = '#c9d6e6') => mix(col, fog, clamp(depth) * .85);
// draw into a scratch layer and composite it with depth-of-field blur / alpha / blend
export function withLayer(c, name, draw, { blur = 0, alpha = 1, blend = 'source-over' } = {}) {
  const L = layer(name); draw(L); c.save(); c.globalAlpha *= alpha; c.globalCompositeOperation = blend; if (blur > .3) c.filter = `blur(${blur.toFixed(1)}px)`; c.drawImage(L.canvas, 0, 0); c.restore();
}

// ───────────────────────── text ─────────────────────────
const SEEN = new Set(); let LOADED = null; const WARNED = new Set();
const FONTS = P.fonts || [];
export function font(size, { family = FONTS[0]?.family || 'sans-serif', weight = 700, italic = false } = {}) { return `${italic ? 'italic ' : ''}${weight} ${size}px "${family}", sans-serif`; }
function note(str) { for (const ch of str) { SEEN.add(ch); if (LOADED && ch.charCodeAt(0) > 127 && !LOADED.has(ch) && !WARNED.has(ch)) { WARNED.add(ch); console.warn(`glyph "${ch}" was not preloaded; add it to PROJECT.chars`); } } }
// text(c, str, x, y, {size, family, weight, italic, col, align, baseline, track, strokes:[{w, col}], shadow:{x,y,blur,col}, alpha})
export function text(c, str, x, y, o = {}) {
  str = String(str); note(str);
  c.save(); c.font = font(o.size || 64, o); c.textAlign = o.align || 'center'; c.textBaseline = o.baseline || 'middle';
  c.letterSpacing = `${o.track || 0}px`; if (o.alpha != null) c.globalAlpha *= o.alpha;
  if (o.shadow) { c.shadowOffsetX = o.shadow.x || 0; c.shadowOffsetY = o.shadow.y || 0; c.shadowBlur = o.shadow.blur || 0; c.shadowColor = o.shadow.col || 'rgba(0,0,0,.35)'; }
  c.lineJoin = 'round'; c.miterLimit = 2;
  for (const s of (o.strokes || []).slice().sort((a, b) => b.w - a.w)) { c.lineWidth = s.w; c.strokeStyle = s.col; c.strokeText(str, x, y); c.shadowColor = 'transparent'; }
  if (o.col !== null) { c.fillStyle = o.col || '#111'; c.fillText(str, x, y); }
  const w = c.measureText(str).width; c.restore(); return w;
}
export function measure(c, str, o = {}) { c.save(); c.font = font(o.size || 64, o); c.letterSpacing = `${o.track || 0}px`; const w = c.measureText(String(str)).width; c.restore(); return w; }
// typeset: per-character animation. fx(i, n, ch) → {dx, dy, s, rot, a, col} (any subset)
export function typeset(c, str, x, y, o = {}, fx = () => ({})) {
  const chars = [...String(str)], n = chars.length; note(String(str));
  const ws = chars.map(ch => measure(c, ch, { ...o, track: 0 })), tr = o.track || 0, total = ws.reduce((a, b) => a + b, 0) + tr * (n - 1);
  let cx = (o.align === 'left' ? x : o.align === 'right' ? x - total : x - total / 2);
  chars.forEach((ch, i) => {
    const f = fx(i, n, ch) || {}, mx = cx + ws[i] / 2; cx += ws[i] + tr;
    if ((f.a ?? 1) <= 0 || (f.s ?? 1) <= 0) return;
    c.save(); c.translate(mx + (f.dx || 0), y + (f.dy || 0)); c.rotate(f.rot || 0); c.scale(f.s ?? 1, f.s ?? 1);
    text(c, ch, 0, 0, { ...o, align: 'center', track: 0, alpha: (o.alpha ?? 1) * (f.a ?? 1), col: f.col || o.col }); c.restore();
  });
  return total;
}

// ───────────────────────── three.js ─────────────────────────
let GL = null;
// gl(): the shared WebGLRenderer (W×H, transparent). Shots set their own toneMapping etc. each frame — it is shared.
export function gl() {
  if (!GL) { GL = new THREE.WebGLRenderer({ canvas: mk(), antialias: true, alpha: true, preserveDrawingBuffer: true }); GL.setPixelRatio(1); GL.setSize(W, H, false); GL.outputColorSpace = THREE.SRGBColorSpace; }
  return GL;
}
// render a three scene and composite it into the 2D frame
export function draw3D(c, scene, camera, { toneMapping = THREE.ACESFilmicToneMapping, exposure = 1, alpha = 1, blend = 'source-over' } = {}) {
  const r = gl(); r.toneMapping = toneMapping; r.toneMappingExposure = exposure; r.setClearColor(0x000000, 0); r.clear(); r.render(scene, camera);
  c.save(); c.globalAlpha *= alpha; c.globalCompositeOperation = blend; c.drawImage(r.domElement, 0, 0, W, H); c.restore();
}
// envMap(): a neutral studio environment for PBR / glass / chrome (RoomEnvironment through PMREM), cached
let ENV = null;
export async function loadEnv() { if (ENV) return ENV; const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'); const pm = new THREE.PMREMGenerator(gl()); ENV = pm.fromScene(new RoomEnvironment(), .04).texture; return ENV; }
export const envMap = () => ENV;

// ───────────────────────── lighting (references/lighting.md) ─────────────────────────
// lightRig(scene, {preset}): key + fill + rim + hemisphere + studio environment, soft shadows from the key.
// presets: studio (default product look) · soft (pastel, low contrast) · golden (sunset, warm key / cool fill)
//          night (cool key, neon fill/rim) · dramatic (one hard key, deep shadows, strong rim)
const RIGS = {
  studio:   { key: ['#FFF4E8', 2.6, [-5, 8, 6]],  fill: ['#DDE8FF', .6, [6, 3, 5]],  rim: ['#FFFFFF', 2.0, [3, 5, -7]], sky: '#FFFFFF', ground: '#B9AEA3', hemi: .4, env: .55 },
  soft:     { key: ['#FFFFFF', 1.6, [-3, 10, 4]], fill: ['#FFFFFF', .8, [5, 4, 6]],   rim: ['#FFFFFF', .8, [0, 6, -6]],  sky: '#FFFFFF', ground: '#E6E0D8', hemi: .7, env: .8 },
  golden:   { key: ['#FFBE7D', 3.2, [-9, 3.5, 3]], fill: ['#7F9BFF', .45, [6, 3, 5]], rim: ['#FFD39A', 2.6, [4, 4, -8]], sky: '#FFE0BF', ground: '#4E4060', hemi: .3, env: .35 },
  night:    { key: ['#A9BEFF', 1.1, [-4, 7, 4]],  fill: ['#FF6FB5', .7, [6, 2, 3]],   rim: ['#2DE2E6', 2.6, [0, 4, -8]], sky: '#2A2F5A', ground: '#0B0B18', hemi: .3, env: .2 },
  dramatic: { key: ['#FFF1E0', 4.0, [-6, 6, 2]],  fill: ['#9FB4FF', .15, [6, 2, 5]],  rim: ['#FFFFFF', 3.0, [2, 4, -8]], sky: '#222222', ground: '#000000', hemi: .1, env: .15 },
};
export function lightRig(scene, { preset = 'studio', intensity = 1, shadows = true, size = 8, target = [0, 0, 0], env = true } = {}) {
  const R = RIGS[preset] || RIGS.studio, r = gl(), tg = new THREE.Vector3(...target);
  if (shadows) { r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; }
  const dir = ([col, I, pos]) => { const l = new THREE.DirectionalLight(col, I * intensity); l.position.set(...pos).add(tg); l.target.position.copy(tg); scene.add(l, l.target); return l; };
  const key = dir(R.key), fill = dir(R.fill), rim = dir(R.rim), hemi = new THREE.HemisphereLight(R.sky, R.ground, R.hemi * intensity); scene.add(hemi);
  if (shadows) { key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0003; key.shadow.normalBias = .02;
    Object.assign(key.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: .5, far: 80 }); key.shadow.camera.updateProjectionMatrix(); }
  if (env) preload(loadEnv().then(e => { if (!scene.environment) { scene.environment = e; scene.environmentIntensity = R.env; } }));
  return { key, fill, rim, hemi };
}
// contactShadow(): a soft dark blob that grounds an object (cheap ambient occlusion). Each frame: sh.follow(obj, groundY)
let BLOB = null;
export function contactShadow({ size = 2, opacity = .5 } = {}) {
  if (!BLOB) { const cv = mk(256, 256), x = cv.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.4, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); BLOB = new THREE.CanvasTexture(cv); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: BLOB, color: '#000000', transparent: true, opacity, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = -1;
  // higher above the ground → bigger and fainter
  m.follow = (obj, groundY = 0, h0 = 1) => { const h = Math.max(0, obj.position.y - groundY); m.position.set(obj.position.x, groundY + .003, obj.position.z); m.scale.setScalar(1 + h / h0 * .6); m.material.opacity = opacity / (1 + h / h0 * 1.5); };
  return m;
}

// ───────────────────────── assets ─────────────────────────
const PENDING = [];
// asset('assets/photo.jpg') → an <img> that is guaranteed loaded before the first frame. Call at module top level.
export function asset(src) { const im = new Image(); PENDING.push(new Promise((ok, bad) => { im.onload = ok; im.onerror = () => bad(new Error('asset failed: ' + src)); })); im.src = src; return im; }
// preload(promise): anything async (envMap, a JSON…) that must finish before rendering
export function preload(p) { PENDING.push(p); return p; }

// ───────────────────────── post ─────────────────────────
let FX = {};
// fx({...}): override post settings for THIS frame (call inside a shot). Keys: grain, vignette, chroma, scan, vhs, curve,
// sat, contrast, bright, warm, poster, flash, flashCol, bloom:{amount, radius, threshold, tint}, letterbox (0..0.15), lens (0..1),
// grade:{lift:'#hex', gain:'#hex', gamma, shadows:'#hex', highlights:'#hex', split}
export function fx(o) { Object.assign(FX, o); }
const R2 = new THREE.WebGLRenderer({ canvas: out, antialias: false, preserveDrawingBuffer: true });
R2.setPixelRatio(1); R2.setSize(W, H, false); R2.outputColorSpace = THREE.LinearSRGBColorSpace;
const TEX = new THREE.CanvasTexture(main); TEX.colorSpace = THREE.NoColorSpace; TEX.minFilter = TEX.magFilter = THREE.LinearFilter; TEX.generateMipmaps = false;
const v3 = (x = 1, y = x, z = x) => ({ value: new THREE.Vector3(x, y, z) }), rawRGB = (h, v) => { const [r, g, b] = hex2rgb(h); v.set(r / 255, g / 255, b / 255); };   // raw sRGB, no colour management
const U = { tDiffuse: { value: TEX }, res: { value: new THREE.Vector2(W, H) }, time: { value: 0 }, flashCol: v3(1), lift: v3(0), gain: v3(1), shadowTint: v3(.5), highTint: v3(.5) };
const UK = ['grain', 'vignette', 'chroma', 'scan', 'vhs', 'curve', 'sat', 'contrast', 'bright', 'warm', 'poster', 'flash', 'gamma', 'split', 'letterbox', 'lens'];
UK.forEach(k => U[k] = { value: 0 });
const postMat = new THREE.ShaderMaterial({
  uniforms: U, depthTest: false, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 res; uniform vec3 flashCol, lift, gain, shadowTint, highTint;
    uniform float time, grain, vignette, chroma, scan, vhs, curve, sat, contrast, bright, warm, poster, flash, gamma, split, letterbox, lens; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      if (curve > 0.) { vec2 c = uv * 2. - 1.; c *= 1. + curve * dot(c, c) * .25; uv = c * .5 + .5;
        if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) { gl_FragColor = vec4(0., 0., 0., 1.); return; } }
      if (vhs > 0.) { float line = floor(uv.y * res.y / 3.); uv.x += (h(vec2(line, floor(time * 30.))) - .5) * vhs * .006 + sin(uv.y * 30. + time * 6.) * vhs * .002;
        uv.x += step(.985, h(vec2(floor(uv.y * 40.), floor(time * 12.)))) * vhs * .02; }
      if (lens > 0.) { vec2 c = uv - .5; uv = .5 + c * (1. - lens * .08) * (1. + lens * .08 * dot(c, c) * 4.); }   // gentle barrel, no black corners
      vec2 d = (uv - .5) * (chroma + lens * .6 * length(uv - .5) * 2.) * .012;
      vec3 col = vec3(texture2D(tDiffuse, uv + d).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d).b);
      if (vhs > 0.) { vec3 b = (texture2D(tDiffuse, uv + vec2(.004, 0.)).rgb + texture2D(tDiffuse, uv + vec2(.008, 0.)).rgb) * .5;
        col = mix(col, vec3(mix(col.r, b.r, .6), col.g, mix(col.b, b.b, .6)), vhs * .7); col += (h(uv * res + time) - .5) * vhs * .06; }
      if (poster > 0.) col = floor(col * poster + .5) / poster;
      col = (col - .5) * (1. + contrast) + .5; col *= 1. + bright;
      float l = dot(col, vec3(.299, .587, .114)); col = mix(vec3(l), col, 1. + sat);
      col += vec3(warm * .05, warm * .01, -warm * .05);
      col = pow(max(col, 0.), vec3(1. / max(.2, 1. + gamma))); col = col * gain + lift * (1. - col);           // lift / gamma / gain
      if (split > 0.) { float lum = dot(col, vec3(.299, .587, .114)); col += split * .3 * (mix(shadowTint, highTint, smoothstep(.15, .85, lum)) - .5); }   // split toning
      if (scan > 0.) col *= 1. - scan * .45 * (.5 + .5 * sin(uv.y * res.y * 3.14159));
      vec2 v = vUv - .5; v.x *= res.x / res.y; float r = length(v) / length(vec2(res.x / res.y, 1.) * .5);
      col *= 1. - vignette * smoothstep(.35, 1.05, r);
      col += (h(vUv * res + fract(time * 7.13) * 91.7) - .5) * grain;
      col = mix(col, flashCol, clamp(flash, 0., 1.));
      if (letterbox > 0. && abs(vUv.y - .5) > .5 - letterbox) col = vec3(0.);
      gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
    }`,
});
const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
const BL = mk(Math.ceil(W / 4), Math.ceil(H / 4)), blc = BL.getContext('2d');
function bloom({ amount = .6, radius = 24, threshold = .5, tint = null } = {}) {
  reset(blc); blc.clearRect(0, 0, BL.width, BL.height);
  blc.filter = `brightness(${1 - threshold * .45}) contrast(${1 + threshold * 3}) blur(${radius / 4}px)`;
  blc.drawImage(main, 0, 0, BL.width, BL.height); blc.filter = 'none';
  if (tint) { blc.globalCompositeOperation = 'multiply'; blc.fillStyle = tint; blc.fillRect(0, 0, BL.width, BL.height); blc.globalCompositeOperation = 'source-over'; }   // halation
  reset(mainCtx); mainCtx.globalCompositeOperation = 'screen'; mainCtx.globalAlpha = clamp(amount, 0, 2) > 1 ? 1 : amount;
  mainCtx.drawImage(BL, 0, 0, W, H); if (amount > 1) { mainCtx.globalAlpha = amount - 1; mainCtx.drawImage(BL, 0, 0, W, H); } reset(mainCtx);
}
function post(t) {
  if (FX.bloom && FX.bloom.amount > 0) bloom(FX.bloom);
  TEX.needsUpdate = true; U.time.value = t;
  UK.forEach(k => U[k].value = +FX[k] || 0); rawRGB(FX.flashCol || '#ffffff', U.flashCol.value);
  const G = FX.grade || {}; rawRGB(G.lift || '#000000', U.lift.value); rawRGB(G.gain || '#ffffff', U.gain.value); rawRGB(G.shadows || '#808080', U.shadowTint.value); rawRGB(G.highlights || '#808080', U.highTint.value);
  U.gamma.value = G.gamma || 0; U.split.value = G.split ?? (G.shadows || G.highlights ? 1 : 0);
  R2.render(postScene, postCam);
}

// ───────────────────────── timeline & transitions ─────────────────────────
// shots([{at, draw(c, t, s), tr: {type, len, ...}}, ...]) — `at` = start time; a shot lasts until the next one starts.
// s = {lt (local time), dur, p (0→1 progress), i}. A transition `tr` belongs to the INCOMING shot and starts at its `at`;
// during it the outgoing shot keeps drawing past its end (lt > dur), so make shots tolerate that.
let SHOTS = [];
export function shots(list) { SHOTS = list.slice().sort((a, b) => a.at - b.at).map((s, i, a) => ({ ...s, i, end: a[i + 1] ? a[i + 1].at : DUR })); window.SHOT_LIST = SHOTS.map(s => ({ at: s.at, end: s.end, name: s.name || s.draw?.name || `shot${s.i}` })); }
function drawShot(s, c, t) {
  reset(c); c.clearRect(0, 0, W, H); c.fillStyle = s.bg || P.bg || '#000'; c.fillRect(0, 0, W, H);
  const dur = s.end - s.at; c.save(); s.draw(c, t, { lt: t - s.at, dur, p: clamp((t - s.at) / dur), i: s.i }); c.restore(); reset(c);
}
const LUMA = {};
// smear: draw img at (x, y) as n copies spread along (dx, dy) — directional motion blur
function smear(c, img, x, y, dx, dy, n = 9) {
  if (Math.hypot(dx, dy) < 1) { c.drawImage(img, x, y); return; }
  const L = layer('smear'); L.globalCompositeOperation = 'lighter'; L.globalAlpha = 1 / n;
  for (let i = 0; i < n; i++) { const f = i / (n - 1) - .5; L.drawImage(img, x + dx * f, y + dy * f); }
  c.drawImage(L.canvas, 0, 0);
}
export const TRANSITIONS = {
  cut: (c, A, B) => c.drawImage(B, 0, 0),
  fade: (c, A, B, k) => { c.drawImage(A, 0, 0); c.globalAlpha = ease(k); c.drawImage(B, 0, 0); },
  dip: (c, A, B, k, o) => { c.drawImage(k < .5 ? A : B, 0, 0); c.globalAlpha = 1 - Math.abs(k * 2 - 1); c.fillStyle = o.color || '#000'; c.fillRect(0, 0, W, H); },
  wipe: (c, A, B, k, o) => { const e = easeInOut(k), d = o.dir || 'left'; c.drawImage(A, 0, 0); c.save(); c.beginPath();
    if (d === 'left') c.rect(W * (1 - e), 0, W, H); else if (d === 'right') c.rect(0, 0, W * e, H); else if (d === 'up') c.rect(0, H * (1 - e), W, H); else c.rect(0, 0, W, H * e);
    c.clip(); c.drawImage(B, 0, 0); c.restore(); },
  iris: (c, A, B, k, o) => { const e = easeInOut(k), x = o.x ?? W / 2, y = o.y ?? H / 2, R = Math.hypot(Math.max(x, W - x), Math.max(y, H - y));
    c.drawImage(A, 0, 0); c.save(); c.beginPath(); c.arc(x, y, Math.max(.01, R * e), 0, TAU); c.clip(); c.drawImage(B, 0, 0); c.restore();
    if (o.ring) { c.strokeStyle = o.ring; c.lineWidth = 10 * (1 - e); c.beginPath(); c.arc(x, y, Math.max(.01, R * e), 0, TAU); c.stroke(); } },
  // slide / push: B pushes A out, with directional motion blur (smear) at speed
  slide: (c, A, B, k, o) => { const e = expoInOut(k), d = o.dir || 'left', sx = d === 'left' ? -1 : d === 'right' ? 1 : 0, sy = d === 'up' ? -1 : d === 'down' ? 1 : 0;
    const sp = (o.blur ?? 1) * Math.pow(Math.sin(Math.PI * k), 2) * .12;   // smear length as a fraction of the frame
    c.drawImage(B, 0, 0);   // backdrop: smear edges never show the empty canvas
    smear(c, A, sx * W * e, sy * H * e, sx * W * sp, sy * H * sp); smear(c, B, -sx * W * (1 - e), -sy * H * (1 - e), sx * W * sp, sy * H * sp); },
  zoom: (c, A, B, k, o) => { const e = easeInOut(k), x = o.x ?? W / 2, y = o.y ?? H / 2;
    c.save(); c.translate(x, y); c.scale(1 + e * (o.amount || 3), 1 + e * (o.amount || 3)); c.translate(-x, -y); c.drawImage(A, 0, 0); c.restore();
    c.save(); c.globalAlpha = seg(k, .35, .8); c.translate(x, y); const s = lerp(.6, 1, easeOut(seg(k, .3, 1))); c.scale(s, s); c.translate(-x, -y); c.drawImage(B, 0, 0); c.restore(); },
  whip: (c, A, B, k, o) => { const d = o.dir === 'right' ? 1 : -1, e = expoInOut(k), sp = Math.pow(Math.sin(Math.PI * k), 2) * .35;
    const cur = k < .5 ? A : B; c.save(); c.filter = 'blur(40px)'; c.drawImage(cur, -W * .05, -H * .05, W * 1.1, H * 1.1); c.restore();   // blurred backdrop fills the smear's edges
    if (k < .5) smear(c, A, d * W * e, 0, d * W * sp, 0); else smear(c, B, -d * W * (1 - e), 0, d * W * sp, 0); },
  // blur: cross-dissolve through a soft focus pull (both frames defocus toward the middle)
  blur: (c, A, B, k, o) => { const b = (o.amount ?? 28) * Math.sin(Math.PI * k);
    c.filter = b > .3 ? `blur(${b.toFixed(1)}px)` : 'none'; c.drawImage(A, 0, 0); c.globalAlpha = easeInOut(k); c.drawImage(B, 0, 0); c.filter = 'none'; },
  // luma: organic noise dissolve (ink bleed, burn, paint, fog). o.seed, o.scale (noise size), o.soft (edge width 0..1),
  // o.dir + o.bias (0..1): bias the reveal to sweep from a side ('left'|'right'|'up'|'down'|'center'), o.edge: colour of a glowing rim
  luma: (c, A, B, k, o) => {
    const sc = 8, w = Math.ceil(W / sc), h = Math.ceil(H / sc), key = `${o.seed || 1}:${o.scale || 1}:${o.dir || ''}:${o.bias || 0}:${w}x${h}`;
    let F = LUMA[key];
    if (!F) { F = LUMA[key] = new Float32Array(w * h); const f = .016 / (o.scale || 1), b = o.bias ?? (o.dir ? .7 : 0);   // large, soft noise blobs
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const n = clamp(.5 + fbm(i * f, j * f, o.seed || 1, 3) * 1.2);
        const g = o.dir === 'left' ? i / w : o.dir === 'right' ? 1 - i / w : o.dir === 'up' ? j / h : o.dir === 'down' ? 1 - j / h : o.dir === 'center' ? Math.hypot(i / w - .5, (j / h - .5) * h / w) * 1.4 : 0;
        F[j * w + i] = lerp(n, g, b); } }
    const soft = o.soft ?? .08, kk = lerp(-soft, 1 + soft, easeInOut(k)), m = layer('luma', w, h), im = m.createImageData(w, h);
    for (let p = 0; p < w * h; p++) { im.data[p * 4] = im.data[p * 4 + 1] = im.data[p * 4 + 2] = 255; im.data[p * 4 + 3] = clamp((kk - F[p]) / soft * .5 + .5) * 255; }
    m.putImageData(im, 0, 0);
    c.drawImage(A, 0, 0); const L = layer('lumaB'); L.drawImage(m.canvas, 0, 0, W, H); L.globalCompositeOperation = 'source-in'; L.drawImage(B, 0, 0); c.drawImage(L.canvas, 0, 0);
    if (o.edge) { for (let p = 0; p < w * h; p++) { const a = 1 - Math.abs((kk - F[p]) / (soft * .35)); im.data[p * 4 + 3] = Math.pow(clamp(a), 2) * 255 * (o.edgeAmount ?? .4); }   // thin rim at the dissolve front
      m.putImageData(im, 0, 0); const E = layer('lumaE'); E.drawImage(m.canvas, 0, 0, W, H); E.globalCompositeOperation = 'source-in'; E.fillStyle = o.edge; E.fillRect(0, 0, W, H);
      c.save(); c.globalCompositeOperation = 'lighter'; c.filter = 'blur(6px)'; c.drawImage(E.canvas, 0, 0); c.restore(); } },
  // pixelate: A breaks into growing blocks, they cross over at the peak, B resolves back to sharp (o.size = max block px)
  pixelate: (c, A, B, k, o) => {
    const e = easeInOut(1 - Math.abs(k * 2 - 1)), size = Math.max(1, Math.round(lerp(1, o.size || 56, e))), m = clamp((k - .42) / .16);
    const px = (img, a) => { if (a <= 0) return; if (size <= 1) { c.globalAlpha = a; c.drawImage(img, 0, 0); c.globalAlpha = 1; return; }
      const sw = Math.ceil(W / size), sh = Math.ceil(H / size), L = layer('pix', sw, sh); L.drawImage(img, 0, 0, sw, sh);
      c.imageSmoothingEnabled = false; c.globalAlpha = a; c.drawImage(L.canvas, 0, 0, sw * size, sh * size); c.globalAlpha = 1; c.imageSmoothingEnabled = true; };
    px(A, 1); px(B, m); },
  // mask: o.mask(c, k) builds a path that reveals B (paint splash, ink bloom, torn paper edge, shape iris…)
  mask: (c, A, B, k, o) => { c.drawImage(A, 0, 0); c.save(); c.beginPath(); o.mask(c, k); c.clip(); c.drawImage(B, 0, 0); c.restore(); },
};
// blend two shots' post settings (numbers lerp, bloom lerps per field, others switch at the midpoint)
function blendFX(A, B, k) {
  const o = {}, keys = new Set([...Object.keys(A), ...Object.keys(B)]);
  for (const key of keys) {
    const a = A[key], b = B[key];
    if (key === 'bloom') { const z = { amount: 0, radius: 24, threshold: .5 }, x = { ...z, ...(a || {}) }, y = { ...z, ...(b || {}) }, r = {};
      for (const f of ['amount', 'radius', 'threshold']) r[f] = lerp(a ? x[f] : (f === 'amount' ? 0 : y[f]), b ? y[f] : (f === 'amount' ? 0 : x[f]), k); o.bloom = r; }
    else if (typeof (a ?? b) === 'number') o[key] = lerp(+a || 0, +b || 0, k);
    else o[key] = k < .5 ? (a ?? b) : (b ?? a);
  }
  return o;
}
let TT = 0, DRY = false;
const ACC = mk(), accCtx = ACC.getContext('2d');
// frame(t): with PROJECT.motionBlur = {samples, shutter} the picture is the average of `samples` sub-frames spread over
// `shutter` × the frame interval (0.5 = 180° shutter) — real motion blur on everything that moves. A shot can opt out with mb: false,
// or override per shot with mb: {samples, shutter} (fast camera moves over text/fine lines need 10–16 samples or they strobe into ghosts).
function frame(t) {
  const M = P.motionBlur || {}, tt0 = P.drawFps ? stepTime(t, P.drawFps) : t;
  let si = 0; while (si + 1 < SHOTS.length && tt0 >= SHOTS[si + 1].at) si++;
  const ov = SHOTS[si]?.mb, n = DRY || P.drawFps || ov === false ? 1 : Math.max(1, (ov?.samples ?? M.samples) | 0);
  if (n === 1) { const tt = composite(t); post(tt); return; }
  const sh = ov?.shutter ?? M.shutter ?? .5; reset(accCtx); accCtx.clearRect(0, 0, W, H); let tt = t;
  for (let k = 0; k < n; k++) { tt = composite(t + ((k + .5) / n - .5) * sh / FPS); accCtx.globalAlpha = 1 / (k + 1); accCtx.drawImage(main, 0, 0); }
  reset(mainCtx); mainCtx.drawImage(ACC, 0, 0); post(t);
}
function composite(t) {
  TT = t; FX = { ...(P.post || {}) };
  const tt = P.drawFps ? stepTime(t, P.drawFps) : t;
  let i = 0; while (i + 1 < SHOTS.length && tt >= SHOTS[i + 1].at) i++;
  const s = SHOTS[i]; if (!s) { reset(mainCtx); mainCtx.fillStyle = '#000'; mainCtx.fillRect(0, 0, W, H); return tt; }
  const tr = s.tr;
  if (tr && tr.type !== 'cut' && i > 0 && tt < s.at + (tr.len || .5)) {
    const a = bufA.getContext('2d'), b = bufB.getContext('2d');
    const base = FX; FX = { ...base }; drawShot(SHOTS[i - 1], a, tt); const fxA = FX;
    FX = { ...base }; drawShot(s, b, tt); const fxB = FX;
    FX = blendFX(fxA, fxB, seg(tt, s.at, s.at + (tr.len || .5)));   // post effects cross-fade with the picture
    reset(mainCtx); mainCtx.clearRect(0, 0, W, H);
    (TRANSITIONS[tr.type] || TRANSITIONS.fade)(mainCtx, bufA, bufB, seg(tt, s.at, s.at + (tr.len || .5)), tr); reset(mainCtx);
  } else drawShot(s, mainCtx, tt);
  return tt;
}

// ───────────────────────── render contract & preview ─────────────────────────
window.renderAt = async (t, type = 'image/png', q = .92) => { frame(t); return out.toDataURL(type, q); };
window.renderSheet = async (times, cols = 3, w = 640, crop = null) => {
  const [cx0, cy0, cw, ch] = crop || [0, 0, W, H], h = Math.round(w * ch / cw), rows = Math.ceil(times.length / cols), sc = mk(cols * w, rows * h), c = sc.getContext('2d'), ms = [];
  for (let i = 0; i < times.length; i++) {
    const t0 = performance.now(); frame(times[i]); ms.push(Math.round(performance.now() - t0));
    const x = (i % cols) * w, y = Math.floor(i / cols) * h;
    c.drawImage(out, cx0, cy0, cw, ch, x, y, w, h); c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(x, y, 70, 22); c.fillStyle = '#fff'; c.font = '14px sans-serif'; c.fillText(times[i].toFixed(2) + 's', x + 6, y + 16);
  }
  return { url: sc.toDataURL('image/jpeg', .9), ms };
};
window.gpuInfo = () => { const g = R2.getContext(), e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); };

async function loadFonts() {
  if (!FONTS.length) return;
  const web = FONTS.filter(f => !f.src);
  for (const f of FONTS.filter(f => f.src)) { const ff = new FontFace(f.family, `url(${f.src})`, { weight: String(f.weights?.[0] || 400) }); document.fonts.add(await ff.load()); }
  if (web.length) {
    const fam = web.map(f => `family=${encodeURIComponent(f.family).replace(/%20/g, '+')}` + (f.italic ? `:ital,wght@${(f.weights || [400]).flatMap(w => [`0,${w}`]).concat((f.weights || [400]).map(w => `1,${w}`)).join(';')}` : `:wght@${(f.weights || [400]).join(';')}`)).join('&');
    await new Promise(ok => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = `https://fonts.googleapis.com/css2?${fam}&display=block`; l.onload = ok; l.onerror = () => { console.warn('Google Fonts unreachable: put .woff2 files in assets/fonts and give fonts[].src'); ok(); }; document.head.appendChild(l); });
  }
  DRY = true;
  for (let t = 0; t < DUR; t += .2) {                   // dry pass: collect every glyph the shots draw
    try { frame(t); } catch (e) { throw new Error(`shot threw at t=${t.toFixed(2)}s: ${e.message}`); } }
  const chars = [...new Set([...(P.chars || ''), ...SEEN, ...'0123456789'])].join('');
  await Promise.all(FONTS.flatMap(f => (f.weights || [400]).flatMap(w => [false, ...(f.italic ? [true] : [])].map(it =>
    document.fonts.load(font(40, { family: f.family, weight: w, italic: it }), chars).catch(e => console.warn('font load failed', f.family, e.message))))));
  DRY = false; LOADED = new Set(chars);
  for (const k in CACHE) delete CACHE[k];             // anything cached during the dry pass was drawn before the fonts arrived
}
export async function start() {
  try { await Promise.all(PENDING); } catch (e) { console.error(e.message); }
  try { await loadFonts(); } catch (e) { window.failed = e.message + '\n' + (e.stack || ''); console.error(window.failed); return; }
  window.ready = true;
  if (!location.search.includes('render')) preview();
}
function preview() {
  const s = document.getElementById('scrub'), lab = document.getElementById('tt'), play = document.getElementById('play');
  if (!s) return; s.max = DUR; let playing = false, t0 = 0, from = 0;
  const go = () => { const a = performance.now(); frame(+s.value); lab.textContent = `${(+s.value).toFixed(2)}s / ${DUR}s · ${Math.round(performance.now() - a)} ms`; };
  s.addEventListener('input', () => { playing = false; go(); });
  play.addEventListener('click', () => { playing = !playing; t0 = performance.now(); from = +s.value >= DUR - .05 ? 0 : +s.value; if (playing) requestAnimationFrame(tick); });
  const tick = () => { if (!playing) return; const t = from + (performance.now() - t0) / 1000; s.value = t % DUR; go(); requestAnimationFrame(tick); };
  s.value = new URLSearchParams(location.search).get('t') || 0; go();
}
