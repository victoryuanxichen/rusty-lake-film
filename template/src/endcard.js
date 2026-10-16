// endcard.js — the closing frame of every video: the Claude Code character + wordmark + a typed terminal line.
// It is a creator credit ("made with Claude Code"), not official Anthropic material: no Anthropic logo, no claims.
// Usage (src/main.js):  shots([...s01, ...s02, endCardShot()]);   settings in PROJECT.endcard (src/config.js).
// See references/endcard.md for how to hand the last shot over smoothly.
import { P, W, H, DUR, TAU, clamp, seg, lerp, spring, easeOut, easeInOut, hash, text, typeset, measure } from './engine.js';

export const CLAUDE_ORANGE = '#D97757';
// the Claude Code character as pixel art ('#' body, 'e' eye)
const CLAWD = [
  '  ##########  ',
  '  ##########  ',
  '  ###e##e###  ',
  '  ###e##e###  ',
  '##############',
  '##############',
  '  ##########  ',
  '  # #    # #  ',
  '  # #    # #  ',
];
export const THEMES = {
  dark:  { bg: '#141413', fg: '#F0EEE6', dim: '#8A877F', accent: CLAUDE_ORANGE, eye: '#141413' },
  light: { bg: '#F0EEE6', fg: '#141413', dim: '#6B6862', accent: CLAUDE_ORANGE, eye: '#141413' },
};

// drawClawd(c, cx, cy, px, {k, blink, squash, col, eye, from}) — k 0→1 assembles the pixels from scattered positions
// (or from `from(i) → [x, y]`, e.g. the last shot's focal point, for a seamless hand-over)
export function drawClawd(c, cx, cy, px, o = {}) {
  const w = CLAWD[0].length, h = CLAWD.length, k = o.k ?? 1, sq = o.squash ?? 1;
  const x0 = cx - w * px / 2, yb = cy + h * px / 2;               // squash around the feet
  let i = 0;
  CLAWD.forEach((row, j) => [...row].forEach((ch, x) => {
    if (ch === ' ') return; i++;
    const d = clamp((k - hash(i * 3.1) * .45) / .55); if (d <= 0) return;
    const e = easeOut(d), [fx, fy] = o.from ? o.from(i) : [cx + (hash(i * 7.7) - .5) * W * 1.1, cy + (hash(i * 9.3) - .5) * H * 1.1];
    const tx = x0 + x * px + (x - w / 2) * px * (1 / sq - 1) * .5, ty = yb - (h - j) * px * sq;
    const X = lerp(fx, tx, e), Y = lerp(fy, ty, e), eye = ch === 'e' && !(o.blink && j === 3);
    c.globalAlpha = Math.min(1, d * 3); c.fillStyle = eye ? (o.eye || '#141413') : (o.col || CLAUDE_ORANGE);
    c.fillRect(Math.round(X), Math.round(Y), Math.ceil(px / sq ** .5) + 1, Math.ceil(px * sq) + 1);   // +1: no hairline seams
  }));
  c.globalAlpha = 1;
}

// endCardShot({at, len, theme, title, line, family, mono, cjk, tr}) → a shot for shots([...])
export function endCardShot(opt = {}) {
  const E = { on: true, len: 3.2, theme: 'dark', title: 'Claude Code', line: '> made with Claude Code', family: 'Space Grotesk', mono: 'JetBrains Mono', tr: { type: 'pixelate', len: .8 }, ...(P.endcard || {}), ...opt };
  const T = typeof E.theme === 'string' ? THEMES[E.theme] || THEMES.dark : { ...THEMES.dark, ...E.theme };
  const at = E.at ?? DUR - E.len;
  const U = Math.min(W, H) / 1080, V = H > W;
  function draw(c, t, s) {
    const lt = s.lt;
    c.fillStyle = T.bg; c.fillRect(0, 0, W, H);
    // faint dot grid + a warm glow behind the character: depth without clutter
    c.fillStyle = T.fg; c.globalAlpha = .05; for (let x = 24 * U; x < W; x += 48 * U) for (let y = 24 * U; y < H; y += 48 * U) c.fillRect(x, y, 2 * U, 2 * U); c.globalAlpha = 1;
    const px = (V ? 20 : 19) * U, ts = (V ? 120 : 132) * U, gap = 56 * U;
    const tw = measure(c, E.title, { size: ts, family: E.family, weight: 700, track: -2 * U });
    const cw = 14 * px, totalW = V ? Math.max(cw, tw) : cw + gap + tw;
    const cx = V ? W / 2 : W / 2 - totalW / 2 + cw / 2, cy = V ? H / 2 - 150 * U : H / 2 - 20 * U;
    const glow = c.createRadialGradient(cx, cy, 0, cx, cy, 420 * U); glow.addColorStop(0, T.accent + '33'); glow.addColorStop(1, T.accent + '00');
    c.globalAlpha = easeOut(seg(lt, .4, 1.4)); c.fillStyle = glow; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
    // character: assemble (0–1.0 s), land with a squash, blink at 2.0 s, small hop at 2.5 s
    const land = lt - 1.0, sq = land > 0 ? 1 - .14 * Math.exp(-land * 7) * Math.cos(land * 22) : 1;
    const hop = lt > 2.5 ? Math.max(0, Math.sin(clamp((lt - 2.5) / .35) * Math.PI)) * 26 * U : 0;
    c.save(); c.globalAlpha = .25 * easeOut(seg(lt, .8, 1.1)); c.fillStyle = '#000'; c.beginPath();
    c.ellipse(cx, cy + 4.6 * px, 6 * px * (1 - hop / (120 * U)), 1.1 * px, 0, 0, TAU); c.fill(); c.restore();
    drawClawd(c, cx, cy - hop, px, { k: seg(lt, 0, 1.0), squash: sq, blink: lt > 2.0 && lt < 2.08, col: T.accent, eye: T.eye });
    // wordmark: letters rise in on springs
    const tx = V ? W / 2 : cx + cw / 2 + gap, ty = V ? cy + 5.2 * px + 90 * U : cy - 10 * U;
    typeset(c, E.title, tx, ty, { size: ts, family: E.family, weight: 700, col: T.fg, track: -2 * U, align: V ? 'center' : 'left' },
      i => { const a = spring(lt - 1.0 - i * .035, 1.8, 7); return { s: Math.max(0, a), dy: (1 - clamp(a)) * 40 * U, a: clamp(a * 2) }; });
    // terminal line, typed, with a blinking block cursor
    const n = Math.floor(clamp((lt - 1.55) / .9) * [...E.line].length), shown = [...E.line].slice(0, n).join('');
    const ly = ty + (V ? 110 : 108) * U, lx = V ? W / 2 - measure(c, E.line, { size: 34 * U, family: E.mono, weight: 500 }) / 2 : tx + 6 * U;
    if (lt > 1.45) {
      const w = text(c, shown, lx, ly, { size: 34 * U, family: E.mono, weight: 500, col: T.dim, align: 'left' });
      if (Math.floor(lt * 2.4) % 2 === 0 || n < [...E.line].length) { c.fillStyle = T.accent; c.fillRect(lx + w + 6 * U, ly - 18 * U, 18 * U, 36 * U); }
    }
  }
  return { at, draw, tr: E.tr, bg: T.bg };
}
