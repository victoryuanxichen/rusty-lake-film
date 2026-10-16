// render.mjs — drives index.html in headless Chrome, frame by frame. Size, fps and length come from src/config.js.
//
//   LOOK (open every image with the Read tool):
//     node render.mjs --overview=12 [--cols=4] [--w=480] --out=out/check/overview.jpg     N evenly spaced frames of the whole video
//     node render.mjs --sheet=0.5,1,1.5,2 [--cols=4] [--w=480] --out=out/check/a.jpg      contact sheet of chosen times
//     node render.mjs --strip=2.0:2.5 [--cols=6] [--w=320] --out=out/check/strip.jpg      EVERY frame of a stretch (motion, transitions)
//     node render.mjs --sheet=2.1 --crop=760,300,400,400 --w=600 --out=out/check/d.jpg     full-res crop (details, small text)
//     node render.mjs --stills=1.2,3.4 --out=out/stills                                  full-res PNGs
//     node render.mjs --audit [--audit=3,4] [--points=.2,.5,.85] --out=out/audit          FULL-RES review stills of every shot (or the listed
//                                                                                          shot indexes) — the mandatory quality gate (references/review.md)
//   MAKE:
//     node render.mjs --frames [--range=0:8] [--workers=4]                               JPEG frames → out/frames (parallel, resumable)
//     node render.mjs --encode [--audio=assets/score.m4a] --out=out/video.mp4            out/frames → MP4 (audio defaults to PROJECT.audio)
//     node render.mjs --gif [--gif-w=720] [--gif-fps=15] --out=out/video.gif             out/frames → GIF (palette-optimised)
//     node render.mjs --clip [--range=0:4] --out=out/clip.mp4                            straight to MP4, one worker (quick previews)
//   Flags: --chrome=<path>  --soft-gl (no GPU: software WebGL)  --frames-dir=out/frames
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';

const require = createRequire(import.meta.url);
const P = require('./src/config.js');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const i = a.indexOf('='), k = a.replace(/^--/, '').slice(0, i < 0 ? undefined : i - 2); return [k, i < 0 ? true : a.slice(i + 1)]; }));
const fps = P.fps || 30, FRAMES = args['frames-dir'] || 'out/frames';
const run = (cmd, a) => new Promise((ok, bad) => { const p = spawn(cmd, a, { stdio: 'inherit' }); p.on('close', c => c ? bad(new Error(`${cmd} exited ${c}`)) : ok()); });
const nums = s => String(s).split(',').map(Number), span = s => String(s).split(':').map(Number);
const audioPath = () => { const a = args.audio === undefined ? P.audio : args.audio; return a && a !== true && existsSync(a) ? a : ''; };

if (args.encode) {
  const out = args.out || 'out/video.mp4', a = audioPath(), n = readdirSync(FRAMES).filter(f => f.endsWith('.jpg')).length;
  mkdirSync(dirname(out), { recursive: true });
  console.log(`encoding ${n} frames @ ${fps} fps → ${out}${a ? ' + ' + a : ' (no audio)'}`);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-stats', '-framerate', String(fps), '-i', `${FRAMES}/f%05d.jpg`,
    ...(a ? ['-i', a, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  console.log('wrote ' + out); process.exit(0);
}
if (args.gif) {
  const out = args.out || 'out/video.gif', w = +(args['gif-w'] || 720), gf = +(args['gif-fps'] || 15);
  mkdirSync(dirname(out), { recursive: true });
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', `${FRAMES}/f%05d.jpg`, '-vf',
    `fps=${gf},scale=${w}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a`, out]);
  console.log('wrote ' + out); process.exit(0);
}

const CHROMES = [args.chrome, process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ...(existsSync(`${homedir()}/.cache/ms-playwright`) ? readdirSync(`${homedir()}/.cache/ms-playwright`).filter(n => /^chromium-\d+$/.test(n)).map(n => `${homedir()}/.cache/ms-playwright/${n}/chrome-linux64/chrome`) : [])];
const CHROME = CHROMES.find(p => p && p !== true && existsSync(p));
if (!CHROME) { console.error('Chrome not found: pass --chrome=<path> or set CHROME_PATH'); process.exit(1); }
const gpu = args['soft-gl'] ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : process.platform === 'darwin' ? ['--use-angle=metal'] : process.platform === 'win32' ? ['--use-angle=d3d11'] : ['--use-gl=angle'];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 0,
  args: [...(process.platform === 'linux' ? ['--no-sandbox'] : []), '--allow-file-access-from-files', '--ignore-gpu-blocklist', ...gpu,
    '--enable-gpu-rasterization', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--font-render-hinting=none'] });

async function openPage(tag = '') {
  const page = await browser.newPage();
  page.on('console', m => { if (['error', 'warn'].includes(m.type())) console.log(`[page${tag}] ${m.text()}`); });
  let early = null; page.on('pageerror', e => { console.log(`[page error${tag}] ${e.message}`); if (!early) early = e.message; });
  await page.goto(pathToFileURL(resolve('index.html')).href + '?render', { waitUntil: 'load' });
  // fail fast: a syntax/import error means start() never runs, so don't wait for the 3-minute timeout
  for (let waited = 0; ; waited += 200) { const st = await page.evaluate(() => window.ready === true ? 'ready' : window.failed ? 'failed' : 'wait');
    if (st !== 'wait') break; if (early && waited > 1500) { console.error(`\npage failed to load: ${early}\n(check the scene files for syntax / import errors)`); await browser.close(); process.exit(1); }
    if (waited > 180000) { console.error('page never became ready (180 s)'); await browser.close(); process.exit(1); } await new Promise(r => setTimeout(r, 200)); }
  const failed = await page.evaluate(() => window.failed);
  if (failed) { console.error(`\npage failed to start:\n${failed}`); await browser.close(); process.exit(1); }
  return page;
}
const grab = async (page, t, type, q) => { const u = await page.evaluate((t, type, q) => window.renderAt(t, type, q), t, type, q); return Buffer.from(u.slice(u.indexOf(',') + 1), 'base64'); };
const dur = P.duration;

try {
  if (args.sheet || args.strip || args.overview) {
    const page = await openPage(), out = args.out || 'out/check/sheet.jpg'; mkdirSync(dirname(out), { recursive: true });
    let ts;
    if (args.strip) { const [a, b] = span(args.strip); ts = []; for (let i = Math.round(a * fps); i <= Math.round(b * fps); i++) ts.push(i / fps); }
    else if (args.overview) { const n = +args.overview || 12; ts = Array.from({ length: n }, (_, i) => +(dur * (i + .5) / n).toFixed(2)); }
    else ts = nums(args.sheet);
    const vertical = P.height > P.width, cols = +(args.cols || (args.strip ? 6 : vertical ? 6 : 4)), w = +(args.w || (args.strip ? 320 : vertical ? 300 : 480));
    const { url, ms } = await page.evaluate((ts, c, w, crop) => window.renderSheet(ts, c, w, crop), ts, cols, w, args.crop ? nums(args.crop) : null);
    writeFileSync(out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    console.log(`${out}  (${ts.length} frames)  ms/frame: ${ms.join(' ')}`);
  } else if (args.audit) {
    const page = await openPage(), out = args.out || 'out/audit'; mkdirSync(out, { recursive: true });
    const list = await page.evaluate(() => window.SHOT_LIST || []), only = args.audit === true ? null : nums(args.audit), pts = args.points ? nums(args.points) : [.2, .5, .85];
    for (const [i, sh] of list.entries()) { if (only && !only.includes(i)) continue;
      for (const p of pts) { const t = +(sh.at + (sh.end - sh.at) * p).toFixed(3), f = `${out}/shot${String(i).padStart(2, '0')}-${String(Math.round(p * 100)).padStart(2, '0')}.png`;
        writeFileSync(f, await grab(page, t, 'image/png')); console.log(`${f}  t=${t}s  (${sh.name})`); } }
  } else if (args.stills) {
    const page = await openPage(), out = args.out || 'out/stills'; mkdirSync(out, { recursive: true });
    console.log('GPU:', await page.evaluate(() => window.gpuInfo()));
    for (const s of nums(args.stills)) { const t0 = Date.now(), f = `${out}/t${s.toFixed(2).replace('.', '_')}.png`; writeFileSync(f, await grab(page, s, 'image/png')); console.log(`${f}  ${Date.now() - t0} ms`); }
  } else if (args.frames) {
    const [a, b] = args.range ? span(args.range) : [0, dur], workers = +(args.workers || 4);
    if (args.fresh) rmSync(FRAMES, { recursive: true, force: true });
    mkdirSync(FRAMES, { recursive: true });
    const first = Math.round(a * fps), last = Math.min(Math.ceil(dur * fps) - 1, Math.round(b * fps) - 1), todo = [];
    for (let i = first; i <= last; i++) { const f = `${FRAMES}/f${String(i).padStart(5, '0')}.jpg`; if (!existsSync(f) || statSync(f).size < 1000) todo.push(i); }
    console.log(`${todo.length} frames to render (${last - first + 1 - todo.length} already done), ${workers} workers`);
    let next = 0, done = 0; const t0 = Date.now();
    await Promise.all(Array.from({ length: Math.min(workers, todo.length) }, async (_, w) => {
      const page = await openPage('#' + w);
      while (next < todo.length) {
        const i = todo[next++], f = `${FRAMES}/f${String(i).padStart(5, '0')}.jpg`;
        writeFileSync(f + '.tmp', await grab(page, i / fps, 'image/jpeg', .94)); renameSync(f + '.tmp', f);
        if (++done % 30 === 0 || done === todo.length) { const el = (Date.now() - t0) / 1000; console.log(`frame ${done}/${todo.length}  ${(el / done * 1000).toFixed(0)} ms/frame  eta ${((todo.length - done) * el / done).toFixed(0)} s`); }
      }
    }));
    const extra = readdirSync(FRAMES).filter(f => /^f\d{5}\.jpg$/.test(f) && +f.slice(1, 6) >= Math.ceil(dur * fps)).length;
    if (extra) console.log(`warning: ${extra} stale frames beyond the current length are in ${FRAMES}; rerun with --fresh`);
  } else if (args.clip) {
    const page = await openPage(), [a, b] = args.range ? span(args.range) : [0, dur], au = audioPath(), out = args.out || 'out/clip.mp4';
    mkdirSync(dirname(out), { recursive: true });
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      ...(au ? ['-ss', String(a), '-t', String(b - a), '-i', au, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.round((b - a) * fps), t0 = Date.now();
    for (let i = 0; i < n; i++) { const buf = await grab(page, a + i / fps, 'image/jpeg', .93); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 30 === 0 || i === n - 1) console.log(`frame ${i + 1}/${n}  ${((Date.now() - t0) / (i + 1)).toFixed(0)} ms/frame`); }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log('wrote ' + out);
  } else console.log('nothing to do: see the usage notes at the top of render.mjs');
} finally { await browser.close(); }
