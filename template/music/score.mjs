// music/score.mjs — an original score synthesized from scratch (no samples, no dependencies), locked to src/config.js:
// tempo (bpm), length (duration), style (music.preset), energy per section (music.sections) and sync points (music.hits).
//   node music/score.mjs            → music/score.wav and assets/score.m4a (loudness-normalised to -14 LUFS with ffmpeg)
// You can't listen: verify with `ffmpeg -i assets/score.m4a -lavfi showspectrumpic=s=1200x400 out/check/spec.png` + per-section RMS,
// and tell the user you could not hear it. See references/sound.md.
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const P = require('../src/config.js'), M = P.music || {};
const SR = 44100, LEN = P.duration, TAIL = 1.5, N = Math.ceil(SR * (LEN + TAIL)), TAU = Math.PI * 2;
const BPM = M.bpm || P.bpm || 110, BEAT = 60 / BPM, BAR = BEAT * 4, OFF = P.beatOffset || 0;
const L = new Float32Array(N), R = new Float32Array(N), sL = new Float32Array(N), sR = new Float32Array(N), mL = new Float32Array(N), mR = new Float32Array(N);
const duck = new Float32Array(N).fill(1);
let seed = (M.seed ?? 3) * 7919 + 1; const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

// put(t0, len, gen(tt), opts): add a sound. bus 'mus' is ducked by the kick; rev = reverb send.
function put(t0, len, gen, { gain = 1, pan = 0, rev = 0, bus = 'drum' } = {}) {
  if (t0 >= LEN + TAIL) return;
  const i0 = Math.max(0, Math.floor(t0 * SR)), i1 = Math.min(N, Math.floor((t0 + len) * SR));
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4), BL = bus === 'mus' ? mL : L, BR = bus === 'mus' ? mR : R;
  for (let i = i0; i < i1; i++) { const v = gen(Math.max(0, i / SR - t0)); if (!Number.isFinite(v)) continue; BL[i] += v * gl; BR[i] += v * gr; sL[i] += v * gl * rev; sR[i] += v * gr * rev; }
}
// filtered noise (state-variable filter; f and q clamped — it blows up near f = 1)
function noise(t0, len, env, filt, o = {}) {
  let lp = 0, bp = 0;
  put(t0, len, tt => { const n = rnd() * 2 - 1, [fc, q0] = filt(tt), q = Math.max(q0, .45), f = Math.min(.85, 2 * Math.sin(Math.PI * Math.min(fc, SR / 7) / SR));
    lp += f * bp; const hp = n - lp - q * bp; bp += f * hp; return env(tt) * (o.hp ? hp : o.lp ? lp : bp); }, o);
}
const env = (tt, a, d) => Math.min(1, tt / a) * Math.exp(-tt * d);

// ───────── drums ─────────
const kick = (t, v = 1) => { put(t, .5, tt => v * Math.sin(TAU * (46 * tt + 120 * (1 - Math.exp(-tt * 30)) / 30)) * Math.exp(-tt * 7) * Math.min(1, tt / .002), { gain: .9 });
  const i0 = Math.floor(t * SR); for (let i = 0; i < SR * .28 && i0 + i < N; i++) duck[i0 + i] = Math.min(duck[i0 + i], 1 - .55 * v * Math.exp(-i / SR * 12)); };
const snare = (t, v = 1, big = false) => { noise(t, big ? .6 : .25, tt => v * .7 * Math.exp(-tt * (big ? 7 : 18)), () => [2400, .6], { gain: .6, rev: big ? .55 : .2 });
  put(t, .15, tt => v * .35 * Math.sin(TAU * 185 * tt) * Math.exp(-tt * 25), { gain: .6 }); };
const clap = (t, v = 1) => { for (let k = 0; k < 3; k++) noise(t + k * .011, .22, tt => v * (k === 2 ? .7 * Math.exp(-tt * 15) : .5 * Math.exp(-tt * 80)), () => [1500, .5], { gain: .65, rev: .25 }); };
const hat = (t, v = 1, open = false) => noise(t, open ? .28 : .05, tt => v * .4 * Math.exp(-tt * (open ? 13 : 75)), () => [9000, .6], { gain: .45, pan: .25, hp: true });
const shaker = (t, v = 1) => noise(t, .09, tt => v * .25 * Math.sin(Math.PI * clamp(tt / .09)), () => [7000, .8], { gain: .5, pan: -.3, hp: true });
const taiko = (t, v = 1) => { put(t, .9, tt => v * Math.sin(TAU * (62 * tt + 40 * (1 - Math.exp(-tt * 18)) / 18)) * Math.exp(-tt * 4.5) * Math.min(1, tt / .003), { gain: .95, rev: .35 });
  noise(t, .08, tt => v * .4 * Math.exp(-tt * 60), () => [900, .6], { gain: .5, lp: true }); };
const chipNoise = (t, v = 1, long = false) => { let ph = 0, last = 0; put(t, long ? .2 : .06, tt => { ph += 1; if (ph % 6 === 0) last = rnd() * 2 - 1; return v * .25 * last * Math.exp(-tt * (long ? 14 : 50)); }, { gain: .5 }); };
// ───────── tonal ─────────
const sine = (t, m, len, v = 1, o = {}) => put(t, len + .3, tt => v * .25 * Math.sin(TAU * mtof(m) * tt) * Math.min(1, tt / .01) * (tt > len ? Math.exp(-(tt - len) * 12) : 1), { gain: .8, bus: 'mus', ...o });
const bass = (t, m, len, v = 1) => { let ph = 0, lp = 0; put(t, len + .06, tt => { ph += mtof(m) / SR; const saw = 2 * (ph % 1) - 1; lp += (saw - lp) * .08;
  return v * .45 * (lp + .6 * Math.sin(TAU * ph)) * Math.min(1, tt / .004) * (tt < len ? 1 : Math.exp(-(tt - len) * 50)); }, { gain: .7, bus: 'mus' }); };
const sub = (t, m, len, v = 1) => put(t, len, tt => v * .5 * Math.sin(TAU * mtof(m) * tt) * Math.min(1, tt / .01) * Math.exp(-tt * 1.6), { gain: .7, bus: 'mus' });
const pluck = (t, m, v = 1, pan = 0, rev = .3) => put(t, .6, tt => v * .16 * (Math.sin(TAU * mtof(m) * tt) + .35 * Math.sin(TAU * mtof(m) * 2 * tt) * Math.exp(-tt * 12)) * Math.exp(-tt * 8) * Math.min(1, tt / .002), { gain: .8, pan, rev, bus: 'mus' });
// Karplus–Strong string: guzheng / harp / guitar-ish. bend = semitones of a slide at the start (guzheng 滑音)
function string(t, m, v = 1, { pan = 0, decay = .996, bright = .5, len = 2.2, rev = .4, bend = 0 } = {}) {
  const n = Math.max(2, Math.round(SR / mtof(m))), buf = new Float32Array(n); let idx = 0;
  for (let i = 0; i < n; i++) buf[i] = (rnd() * 2 - 1) * (rnd() < bright ? 1 : .3);
  put(t, len, () => { const a = buf[idx % n], b = buf[(idx + 1) % n]; buf[idx % n] = decay * .5 * (a + b); idx++; return v * .5 * a; }, { gain: .8, pan, rev, bus: 'mus' });
  if (bend) { let ph = 0; put(t, .3, tt => { ph += mtof(m - bend * Math.exp(-tt * 14)) / SR; return v * .07 * Math.sin(TAU * ph) * Math.exp(-tt * 7); }, { gain: .6, pan, rev, bus: 'mus' }); }
}
const epiano = (t, m, len, v = 1, pan = 0) => put(t, len + 1, tt => { const mod = Math.sin(TAU * mtof(m) * tt) * 1.2 * Math.exp(-tt * 3);
  return v * .12 * Math.sin(TAU * mtof(m) * tt + mod) * Math.exp(-tt * 1.6) * Math.min(1, tt / .004) * (tt > len ? Math.exp(-(tt - len) * 5) : 1); }, { gain: .8, pan, rev: .3, bus: 'mus' });
const bell = (t, m, v = 1, pan = 0) => put(t, 2.5, tt => v * .1 * Math.sin(TAU * mtof(m) * tt + 2 * Math.sin(TAU * mtof(m) * 3.5 * tt) * Math.exp(-tt * 4)) * Math.exp(-tt * 1.8) * Math.min(1, tt / .002), { gain: .8, pan, rev: .5, bus: 'mus' });
const pad = (t, notes, len, v = 1, bright = .5) => notes.forEach((m, i) => { const det = [1, 1.0045, .9958];
  put(t, len + 1.2, tt => { let s = 0; for (const d of det) for (let h = 1; h <= 5; h++) s += Math.sin(TAU * mtof(m) * d * h * tt + h * 1.3) / Math.pow(h, 2.2 - bright);
    return v * .022 * s * Math.min(1, tt / .6) * (tt > len ? Math.exp(-(tt - len) * 3) : 1); }, { gain: .8, pan: (i - 1) * .45, rev: .6, bus: 'mus' }); });
const sawLead = (t, m, len, v = 1, pan = 0) => { let ph = 0, lp = 0; put(t, len + .2, tt => { ph += mtof(m) * (1 + .003 * Math.sin(TAU * 5 * tt)) / SR; const s = 2 * (ph % 1) - 1;
  lp += (s - lp) * (.05 + .25 * Math.exp(-tt * 6)); return v * .16 * lp * Math.min(1, tt / .005) * (tt > len ? Math.exp(-(tt - len) * 20) : 1); }, { gain: .8, pan, rev: .4, bus: 'mus' }); };
const square = (t, m, len, v = 1, duty = .5, pan = 0) => { let ph = 0; put(t, len, tt => { ph += mtof(m) / SR; return v * .1 * ((ph % 1) < duty ? 1 : -1) * (tt < len - .01 ? 1 : 0); }, { gain: .7, pan, bus: 'mus' }); };
const tri = (t, m, len, v = 1) => { let ph = 0; put(t, len, tt => { ph += mtof(m) / SR; const x = ph % 1; return v * .3 * (x < .5 ? 4 * x - 1 : 3 - 4 * x) * (tt < len - .01 ? 1 : 0); }, { gain: .7, bus: 'mus' }); };
const crackle = (t0, len, v = 1) => { for (let t = t0; t < t0 + len; t += .02 + rnd() * .12) noise(t, .01, tt => v * .25 * Math.exp(-tt * 600), () => [3000 + rnd() * 3000, .5], { gain: .4, pan: rnd() * 2 - 1 }); };

// ───────── sfx (picture sync) ─────────
const SFX = {
  pop: (t, v = 1) => put(t, .12, tt => v * .35 * Math.sin(TAU * (300 * tt + 900 * (1 - Math.exp(-tt * 40)) / 40)) * Math.exp(-tt * 30), { gain: .8, rev: .15 }),
  tick: (t, v = 1) => put(t, .03, tt => v * .3 * Math.sin(TAU * 2600 * tt) * Math.exp(-tt * 180), { gain: .5, pan: -.2 }),
  ding: (t, v = 1, m = 88) => bell(t, m, v * 2.2),
  chime: (t, v = 1, m = 84) => [0, 4, 7, 12].forEach((d, i) => bell(t + i * .06, m + d, v * 1.4, (i - 1.5) * .3)),
  whoosh: (t, v = 1) => put(t, .5, tt => v * .12 * Math.sin(TAU * (300 * tt + 700 * tt * tt)) * Math.sin(Math.PI * clamp(tt / .5)), { gain: .6, rev: .5, bus: 'mus' }),   // tonal, not a noise blast
  boom: (t, v = 1) => { kick(t, v); put(t, 1.8, tt => v * .45 * Math.sin(TAU * (34 * tt + 25 * (1 - Math.exp(-tt * 6)) / 6)) * Math.exp(-tt * 2), { gain: .8, rev: .3 }); },
  riser: (t, v = 1, len = 1.5) => put(t - len, len, tt => v * .09 * Math.sin(TAU * (200 * tt + 500 * tt * tt / len)) * Math.pow(tt / len, 2), { gain: .7, rev: .5, bus: 'mus' }),
  glitch: (t, v = 1) => { for (let k = 0; k < 8; k++) { const f = 300 + 3000 * rnd(); put(t + k * .03, .025, x => v * .2 * Math.sign(Math.sin(TAU * f * x)), { gain: .5, pan: rnd() * 2 - 1 }); } },
  type: (t, v = 1) => noise(t, .03, tt => v * .5 * Math.exp(-tt * 200), () => [3500 + rnd() * 2000, .7], { gain: .5, pan: rnd() - .5 }),
  stamp: (t, v = 1) => { put(t, .25, tt => v * .6 * Math.sin(TAU * 90 * tt) * Math.exp(-tt * 22), { gain: .8 }); noise(t, .1, tt => v * .5 * Math.exp(-tt * 40), () => [700, .6], { gain: .6, lp: true }); },
  shutter: (t, v = 1) => { noise(t, .02, tt => v * .6 * Math.exp(-tt * 300), () => [5000, .5], { gain: .5 }); noise(t + .06, .03, tt => v * .5 * Math.exp(-tt * 200), () => [4000, .5], { gain: .5 }); },
  drip: (t, v = 1) => put(t, .25, tt => v * .3 * Math.sin(TAU * (500 * tt + 1200 * (1 - Math.exp(-tt * 25)) / 25)) * Math.exp(-tt * 18), { gain: .7, rev: .5 }),
  snap: (t, v = 1) => noise(t, .04, tt => v * .8 * Math.exp(-tt * 150), () => [2500, .5], { gain: .6, rev: .2 }),
};

// ───────── presets ─────────
// chords as MIDI triads/sevenths; scale for melodies (semitones from key root)
const KEY = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 57, B: 59 }[M.key || 'C'] ?? 60, k = n => KEY + n;
const MAJ = [0, 2, 4, 5, 7, 9, 11], PENTA = [0, 2, 4, 7, 9], MINP = [0, 3, 5, 7, 10];
const PRESETS = {
  lofi:     { prog: [[5, 9, 12, 16], [4, 7, 11, 14], [2, 5, 9, 12], [0, 4, 7, 11]], swing: .12, drums: 'lofi', keys: 'epiano', lead: null, crackle: true },
  pop:      { prog: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], swing: 0, drums: 'pop', keys: 'pluck', lead: 'pluck', scale: MAJ },
  synthwave:{ prog: [[-3, 0, 4], [-7, -3, 0], [-12, -8, -5], [-5, -1, 2]], swing: 0, drums: 'synthwave', keys: 'pad', lead: 'saw', arp: true, scale: MINP, root: -3 },
  cinematic:{ prog: [[-3, 0, 4], [-7, -3, 0], [-12, -8, -5], [-5, -1, 2]], swing: 0, drums: 'sparse', keys: 'pad', lead: 'bell', scale: MINP, root: -3 },
  chiptune: { prog: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], swing: 0, drums: 'chip', keys: 'chip', lead: 'square', arp: true, scale: PENTA },
  guofeng:  { prog: [[0, 7, 14], [-3, 4, 9], [2, 9, 14], [-5, 2, 7]], swing: 0, drums: 'taiko', keys: 'drone', lead: 'string', scale: PENTA },
  tech:     { prog: [[-3, 0, 4], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], swing: 0, drums: 'tech', keys: 'pulse', lead: null, scale: MINP, root: -3 },
  ambient:  { prog: [[0, 4, 7, 11], [5, 9, 12, 16], [-3, 0, 4, 7], [7, 11, 14, 17]], swing: 0, drums: 'none', keys: 'pad', lead: 'bell', scale: PENTA },
};
const S = PRESETS[M.preset || 'pop'] || PRESETS.pop, sections = (M.sections || [{ at: 0, energy: .8 }]).slice().sort((a, b) => a.at - b.at);
const energyAt = t => { let e = sections[0].energy; for (const s of sections) if (t >= s.at) e = s.energy; return e; };
const end = LEN - BEAT * .5;                               // music stops on the last beat; the tail rings out

// a seeded melody motif (8 eighths), re-used with variation every 2 bars
const motif = Array.from({ length: 8 }, (_, i) => i % 2 && rnd() < .35 ? null : Math.floor(rnd() * 5));
const scaleNote = (deg, oct = 0) => { const sc = S.scale || MAJ, n = sc.length; const o = Math.floor(deg / n); return KEY + (S.root || 0) + sc[((deg % n) + n) % n] + 12 * (o + oct); };

for (let bar = 0, t = OFF; t < end; bar++, t += BAR) {
  const ch = S.prog[bar % S.prog.length].map(n => k(n)), e = energyAt(t), last = t + BAR >= end;
  // harmony
  if (S.keys === 'epiano') ch.forEach((m, i) => epiano(t + i * .012, m, BAR * .9, .9, (i - 1.5) * .3));
  if (S.keys === 'pad') pad(t, ch.slice(0, 3), BAR, e < .3 ? .7 : 1, M.preset === 'synthwave' ? .9 : .4);
  if (S.keys === 'drone') { pad(t, [ch[0] - 12, ch[0] - 5], BAR, .8, .2); }
  if (S.keys === 'pulse') for (let s = 0; s < 16; s++) sine(t + s * BEAT / 4, ch[0] - 12 + (s % 4 === 2 ? 12 : 0), BEAT / 5, .5 + .3 * e);
  if (S.keys === 'pluck') for (let s = 0; s < 8; s++) pluck(t + s * BEAT / 2, ch[s % ch.length] + (s >= 4 ? 12 : 0), .7, (s % 2 ? .3 : -.3));
  if (S.keys === 'chip') for (let s = 0; s < 16; s++) square(t + s * BEAT / 4, ch[s % 3] + 12, BEAT / 4, .35, .25, .2);
  // bass
  if (e > .15 && S.drums !== 'none') {
    const root = ch[0] - 24 + (ch[0] - 24 < 28 ? 12 : 0);
    if (S.drums === 'chip') for (let b = 0; b < 8; b++) tri(t + b * BEAT / 2, root + (b % 2 ? 12 : 0), BEAT / 2.2, .9);
    else if (S.drums === 'synthwave') for (let b = 0; b < 16; b++) bass(t + b * BEAT / 4, root + (b % 2 ? 12 : 0), BEAT / 5, .55);
    else if (S.drums === 'sparse' || S.drums === 'taiko') sub(t, root, BAR, .8);
    else for (let b = 0; b < 4; b++) bass(t + b * BEAT + (b % 2 ? S.swing * BEAT : 0), root + (b === 3 ? 7 : 0), BEAT * .8, .7);
  }
  // melody
  if (S.lead && e > .25) for (let i = 0; i < 8; i++) {
    const d = motif[(i + (bar % 4 === 3 ? 3 : 0)) % 8]; if (d == null || (S.lead === 'bell' && i % 2)) continue;
    const m = scaleNote(d + (bar % 2 ? 2 : 0), S.lead === 'string' ? 0 : 1), tt = t + i * BEAT / 2;
    if (S.lead === 'pluck') pluck(tt, m, .8, .1); else if (S.lead === 'saw') sawLead(tt, m, BEAT * .45, .8); else if (S.lead === 'square') square(tt, m, BEAT * .45, .55, .5, -.1);
    else if (S.lead === 'bell') bell(tt, m, 1, (i % 4 - 1.5) * .3); else if (S.lead === 'string') string(tt, m, 1, { pan: (i % 3 - 1) * .3, bend: i === 0 ? 2 : 0 });
  }
  if (S.arp && e > .3) for (let s = 0; s < 16; s++) pluck(t + s * BEAT / 4, ch[s % ch.length] + 12 + (s % 8 >= 4 ? 12 : 0), .45, s % 2 ? .4 : -.4, .25);
  if (S.crackle) crackle(t, BAR, .6);
  // drums
  if (e >= .15) for (let b = 0; b < 4; b++) {
    const tb = t + b * BEAT, sw = S.swing * BEAT, full = e >= .4;
    if (last && b === 3) break;
    switch (S.drums) {
      case 'lofi': if (b === 0 || (b === 2 && full)) kick(tb, .8); if (b === 1 || b === 3) snare(tb, .55); for (let h = 0; h < 2; h++) hat(tb + h * (BEAT / 2 + sw), h ? .35 : .5); break;
      case 'pop': kick(tb, b ? .85 : 1); if (b % 2) clap(tb, .7); if (full) for (let h = 0; h < 2; h++) hat(tb + h * BEAT / 2, h ? .6 : .35, h === 1 && b === 3); shaker(tb + BEAT * .75, .5); break;
      case 'synthwave': kick(tb, .9); if (b % 2) snare(tb, .8, true); if (full) for (let h = 0; h < 4; h++) hat(tb + h * BEAT / 4, h % 2 ? .45 : .25); break;
      case 'sparse': if (b === 0) kick(tb, .5 + .4 * e); if (b === 2 && full) SFX.tick(tb, .5); break;
      case 'chip': chipNoise(tb, b === 0 || b === 2 ? 1 : .5, b % 2 === 1); if (full) chipNoise(tb + BEAT / 2, .35); break;
      case 'taiko': if (b === 0) taiko(tb, .9); if (b === 2 && full) taiko(tb, .6); if (b === 3 && full) taiko(tb + BEAT / 2, .4); break;
      case 'tech': kick(tb, .85); if (full) { hat(tb + BEAT / 2, .4); SFX.tick(tb + BEAT / 4, .4); } if (b === 2 && full) clap(tb, .4); break;
      default: break;
    }
  }
}
// final chord: ring out on the last beat
const lastCh = S.prog[Math.max(0, Math.floor((end - OFF) / BAR)) % S.prog.length].map(n => k(n));
if (S.drums !== 'none') { kick(end, .8); }
if (S.lead === 'string') lastCh.forEach((m, i) => string(end + i * .05, m, .9, { pan: (i - 1) * .4 }));
else lastCh.forEach((m, i) => bell(end + i * .03, m + 12, 1.1, (i - 1) * .4));
// end card (PROJECT.endcard): pixels land, letters rise, terminal types — synced automatically
if (P.endcard && P.endcard.on !== false) { const e0 = P.endcard.at ?? LEN - (P.endcard.len || 3.2);
  SFX.riser(e0 + .95, .7, .9); SFX.pop(e0 + 1.0, .9); SFX.chime(e0 + 1.05, .8, 79);
  for (let i = 0; i < 12; i++) SFX.type(e0 + 1.6 + i * .075, .45); SFX.pop(e0 + 2.5, .5); }
// sync points from the picture
for (const h of (M.hits || [])) { const f = SFX[h.sfx || 'pop']; if (f) f(h.t, h.v ?? 1, h.note); else console.warn('unknown sfx', h.sfx); }

// ───────── mix: duck the music bus, reverb, glue, fade, normalise ─────────
for (let i = 0; i < N; i++) { L[i] += mL[i] * duck[i]; R[i] += mR[i] * duck[i]; }
// section energy also shapes the overall level (quiet sections really are quieter), smoothed over ~0.4 s
{ let g = .45 + .55 * energyAt(0); const a = 1 / (SR * .4); for (let i = 0; i < N; i++) { g += ((.45 + .55 * energyAt(i / SR)) - g) * a; L[i] *= g; R[i] *= g; sL[i] *= g; sR[i] *= g; } }
const comb = (d, fb) => { const b = new Float32Array(d); let i = 0, f = 0; return x => { const y = b[i]; f = y * .8 + f * .2; b[i] = x + f * fb; i = (i + 1) % d; return y; }; };
const ap = d => { const b = new Float32Array(d); let i = 0; return x => { const y = b[i], o = -x + y; b[i] = x + y * .5; i = (i + 1) % d; return o; }; };
const mkRev = sp => { const cs = [1116, 1188, 1277, 1356, 1422, 1491].map(d => comb(d + sp, .82)), as = [556, 441, 341].map(d => ap(d + sp)); return x => { let s = 0; for (const c of cs) s += c(x); s *= .12; for (const a of as) s = a(s); return s; }; };
const rvL = mkRev(0), rvR = mkRev(23);
for (let i = 0; i < N; i++) { L[i] += rvL(sL[i]) * .9; R[i] += rvR(sR[i]) * .9; }
const fadeIn = .02, fadeOutStart = LEN - .02;
// bring the raw sum to a sane level BEFORE the soft clipper, otherwise everything saturates to the same loudness (and distorts)
let pre = 0; for (let i = 0; i < N; i++) pre = Math.max(pre, Math.abs(L[i]), Math.abs(R[i])); const drive = pre > 0 ? .9 / pre : 1;
let peak = 0; for (let i = 0; i < N; i++) { const t = i / SR; let g = Math.min(1, t / fadeIn); if (t > fadeOutStart + TAIL - .6) g *= clamp((LEN + TAIL - t) / .6);
  L[i] = Math.tanh(L[i] * drive * 1.1) * g; R[i] = Math.tanh(R[i] * drive * 1.1) * g; peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
const norm = peak > 0 ? .89 / peak : 1, NS = Math.ceil(SR * (LEN + .8)), buf = Buffer.alloc(44 + NS * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + NS * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(NS * 4, 40);
for (let i = 0; i < NS; i++) { const g = i / SR > LEN + .3 ? clamp((LEN + .8 - i / SR) / .5) : 1; buf.writeInt16LE(Math.round(clamp(L[i] * norm * g, -1, 1) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(clamp(R[i] * norm * g, -1, 1) * 32767), 46 + i * 4); }
mkdirSync('music', { recursive: true }); writeFileSync('music/score.wav', buf);
console.log(`music/score.wav  ${(NS / SR).toFixed(2)} s  preset=${M.preset || 'pop'}  bpm=${BPM}  hits=${(M.hits || []).length}`);
if (!existsSync('assets')) mkdirSync('assets');
// two-pass *linear* loudness normalisation to -14 LUFS: keeps the section dynamics (single-pass loudnorm would flatten them)
const LN = 'loudnorm=I=-14:TP=-1.2:LRA=20';
const m1 = spawnSync('ffmpeg', ['-hide_banner', '-i', 'music/score.wav', '-af', `highpass=f=30,${LN}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
const js = (() => { try { const t = m1.stderr; return JSON.parse(t.slice(t.lastIndexOf('{'), t.lastIndexOf('}') + 1)); } catch { return null; } })();
const af = js ? `highpass=f=30,${LN}:linear=true:measured_I=${js.input_i}:measured_TP=${js.input_tp}:measured_LRA=${js.input_lra}:measured_thresh=${js.input_thresh}:offset=${js.target_offset}` : `highpass=f=30,${LN}`;
const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 'music/score.wav', '-af', af, '-ar', '44100', '-c:a', 'aac', '-b:a', '192k', 'assets/score.m4a'], { stdio: 'inherit' });
console.log(ff.status === 0 ? `assets/score.m4a  (${js ? 'linear two-pass' : 'single-pass'} loudnorm -14 LUFS)` : 'ffmpeg failed: encode assets/score.m4a yourself');
