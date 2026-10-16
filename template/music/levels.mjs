// music/levels.mjs — loudness per section, read straight from music/score.wav (you can't listen: check the energy arc with numbers)
//   node music/levels.mjs                 → one line per PROJECT.music.sections entry
//   node music/levels.mjs 0:2.5 8.5:20.5  → custom ranges in seconds
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const P = createRequire(import.meta.url)('../src/config.js'), buf = readFileSync('music/score.wav');
const sr = buf.readUInt32LE(24), ch = buf.readUInt16LE(22), data = 44, n = (buf.length - data) / 2 / ch;
const rms = (a, b) => { const i0 = Math.max(0, Math.floor(a * sr)), i1 = Math.min(n, Math.floor(b * sr)); let s = 0, k = 0;
  for (let i = i0; i < i1; i++) for (let c = 0; c < ch; c++) { const v = buf.readInt16LE(data + (i * ch + c) * 2) / 32768; s += v * v; k++; } return 20 * Math.log10(Math.sqrt(s / Math.max(1, k)) + 1e-9); };
const args = process.argv.slice(2), secs = (P.music?.sections || [{ at: 0 }]).slice().sort((a, b) => a.at - b.at);
const ranges = args.length ? args.map(r => r.split(':').map(Number)) : secs.map((s, i) => [s.at, secs[i + 1]?.at ?? P.duration, s.energy]);
for (const [a, b, e] of ranges) console.log(`${a.toFixed(2).padStart(6)}–${b.toFixed(2).padEnd(6)} s   RMS ${rms(a, b).toFixed(1).padStart(6)} dBFS${e != null ? `   (energy ${e})` : ''}`);
