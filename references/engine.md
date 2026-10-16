# 引擎 API（src/engine.js）

## 目錄
1. 專案結構與一個鏡頭長什麼樣
2. 時間軸與轉場
3. 數學、緩動、隨機、噪聲
4. 畫布工具：layer、cache、cam、像素
5. 幾何
6. 手繪媒材：pencil、ink、watercolor、paper、hatch、halftone
7. 文字：text、typeset、measure
8. three.js
9. 後期 fx 與 bloom
10. 素材與預載
11. 常用模式（模擬、遮罩、景深、橫竪版）
12. 效能

---

## 1. 專案結構與一個鏡頭長什麼樣

```
index.html          importmap（three）＋ #out 畫布 ＋ 預覽列
src/config.js       參數卡（瀏覽器讀 window.PROJECT，Node 讀 module.exports）
src/engine.js       引擎（不用改）
src/main.js         把各場景的 SHOTS 串成時間軸
src/scenes/*.js     你的鏡頭
music/score.mjs     配樂合成
render.mjs          渲染、檢查、編碼
serve.mjs           瀏覽器即時預覽：node serve.mjs → http://localhost:5179/?t=3.2
```

```js
// src/scenes/s01.js
import { W, H, TAU, seg, ease, backOut, text, fx } from '../engine.js';
const U = Math.min(W, H) / 1080;

function hello(c, t, s) {                 // c = 2D context；t = 全片時間；s = {lt 本鏡時間, dur, p 0→1 進度, i}
  c.fillStyle = '#f6f1e7'; c.fillRect(0, 0, W, H);
  const k = backOut(seg(s.lt, .2, .8));
  c.save(); c.translate(W / 2, H / 2); c.scale(k, k);
  text(c, '你好', 0, 0, { size: 180 * U, weight: 900, col: '#1f1d1a' });
  c.restore();
  if (s.lt < .1) fx({ flash: .3 });
}
export const SHOTS = [{ at: 0, draw: hello }];
```

鏡頭函數每幀被呼叫一次，必須**畫滿整個畫面**（引擎先幫你塗上 `bg`），而且只能依賴 `t`。

## 2. 時間軸與轉場

```js
shots([
  { at: 0,   draw: a },
  { at: 3.2, draw: b, tr: { type: 'iris', len: .6, x: 960, y: 540, ring: '#ef5a3c' } },
  { at: 7.0, draw: c, tr: { type: 'mask', len: .8, mask: (c, k) => { /* 建立路徑，k 0→1 */ } }, bg: '#000' },
]);
```

- 鏡頭持續到下一個鏡頭的 `at`。`tr` 屬於**進入的鏡頭**，從它的 `at` 開始，長度 `len` 秒；這段時間裡舊鏡頭會繼續畫（`s.lt > s.dur`）。
- 內建轉場：`cut`、`fade`、`dip`（`color`）、`blur`（`amount`）、`luma`（噪聲有機溶解：`seed` `scale` `soft` `dir` `bias` `edge`）、`pixelate`（`size`）、`wipe`（`dir`）、`iris`（`x`,`y`,`ring`）、`slide`（`dir`、`blur`，帶方向動態模糊）、`zoom`（`x`,`y`,`amount`）、`whip`（`dir`，帶動態模糊）、`mask`（自訂路徑）。怎麼選、怎麼接得絲滑，見 [transitions.md](transitions.md)。
- 每個鏡頭可以覆蓋動態模糊：`mb: false`（像素、故障、逐格風格；子幀會混出調色盤外的顏色或抹掉故障幀），或 `mb: { samples, shutter }`（鏡頭快速掃過細字／細線時用 10–16 個子幀，否則模糊會變成一串重影）。
- 自己加轉場：`TRANSITIONS.myType = (c, A, B, k, o) => {...}`，A、B 是新舊鏡頭的畫布。
- **最好的轉場常常在鏡頭內部完成**（一鏡到底推進、形變、相機穿過物件），不需要 `tr`。

## 3. 數學、緩動、隨機、噪聲

| 函數 | 用途 |
|---|---|
| `clamp(x,a,b)` `lerp(a,b,k)` `seg(t,a,b)` `remap(x,a,b,c,d)` | `seg` 是最常用的：t 在 [a,b] 間的 0→1 進度 |
| `ease` `easeIn` `easeOut` `easeInOut` `expoOut` `expoInOut` | 緩動 |
| `backOut(x, s)` `elasticOut(x)` `spring(sec, freq, damp)` | 彈跳；`spring` 的參數是「釋放後經過的秒數」，會超調 |
| `pingpong(x)` | 0→1→0 往返 |
| `hash(i, j)` `hash2(i,j)` | 穩定的偽隨機 0..1；`j` 是可選的第二種子，`hash(i, 1)` 與 `hash(i, 2)` 互相獨立（拿 x、y 時一定要給不同的 j，否則點會排成一條斜線） |
| `rng(seed)` | 回傳產生器 `r()`；同一 seed 序列相同 |
| `gauss(r)` | 常態分佈 |
| `noise3(x,y,z)` `noise2(x,y)` `fbm(x,y,z,oct)` | simplex 噪聲，約 −1..1 |
| `stepTime(t, fps)` | 階梯化時間（手繪、定格感）；也可在 config 設 `drawFps` 全片套用 |
| `beatPulse(t, k)` `beatOf(t)` `BEAT` `BPM` | 對拍 |
| `hex2rgb` `rgba(hex,a)` `mix(a,b,k)` `ramp([...], k)` | 顏色 |

## 4. 畫布工具

- `layer(name, w, h)`：一張可重複使用的暫存畫布（每次呼叫都會清空），回傳 context。用來做遮罩、分層合成、局部模糊。`layer('x').canvas` 是畫布本身。
- `cache(key, w, h, draw)`：靜態內容只畫一次（水彩背景、紙紋、複雜插畫）。key 要包含所有會改變外觀的參數。
- `cam(c, {x, y, z, rot, cx, cy})`：2D 相機，看向世界座標 (x,y)，縮放 z。放在 `c.save()`／`c.restore()` 之間。
- `withLayer(c, name, draw, {blur, alpha, blend})`：在暫存層畫好再合成，可加景深模糊、透明度、混合模式（前景失焦物件、柔光、陰影層）。
- `mk(w,h)`：建立新畫布（只在模組頂層用，不要每幀建立）。
- 像素風：`const px = pixelLayer('px', 304, 171)` 在低解析度畫，然後 `blitPixels(c, px)` 最近鄰放大；`dither(v, x, y)` 是 4×4 Bayer 抖動判斷。

## 5. 幾何

- `poly(c, pts, close)`：用點陣列建立路徑（之後 `c.fill()`／`c.stroke()`）。
- `resample(pts, step, closed)`：等距重新取樣。
- `spline(pts, n, closed)`：Catmull-Rom 平滑曲線。
- `blob(cx, cy, r, {n, amp, freq, seed, t})`：有機的團塊輪廓；`t` 讓它蠕動。
- `wobble(pts, amp, {seed, freq, t, step, closed})`：手繪抖動。

路徑「畫出來」的效果：`ink(..., {reveal: k})`、`pencil(..., {reveal: k})`，或用 `c.setLineDash([L, L]); c.lineDashOffset = L * (1 - k)`（L ≥ 路徑長度）。

## 6. 手繪媒材

| 函數 | 效果 | 主要參數 |
|---|---|---|
| `pencil(c, pts, o)` | 鉛筆：多遍抖動、斷續 | `col` `w` `passes` `jitter` `alpha` `seed` `closed` `reveal` |
| `ink(c, pts, o)` | 墨線、筆刷：粗細變化、兩端收尖 | `col` `w` `taper` `wob` `seed` `closed` `reveal` |
| `watercolor(c, pts, o)` | 水彩：多層變形半透明、邊緣積色、顏料沉澱、水漬回流 | `col` `col2`（第二色，層間混色） `alpha` `layers` `spread` `seed` `base` `detail` `rim` `granulation`（0–1 顆粒沉澱） `backruns`（0–1 花邊水漬）；長邊會自動重新取樣，大形狀不會出碎片 |
| `paper(c, o)` | 紙紋（自動快取） | `tone` `grain` `fibres` `seed` `blend` |
| `hatch(c, pts, o)` | 排線陰影 | `angle` `gap` `col` `w` `jitter` |
| `halftone(c, x, y, w, h, o)` | 網點 | `size` `angle` `col` `fn(u,v)→濃度` |

水彩很耗時（每塊約 5–20 ms）：靜態的放進 `cache()`；動態的（正在「鋪色」的那一塊）用 `layers` 12–16。
「boil」（手繪線條每幀微微抖動）：把 `seed` 設成 `Math.floor(t * 12)` 之類的值。靜止物件要固定 seed，不然整個畫面會一直抖。

## 6½. 物理與工藝助手（[craft.md](craft.md)）

| 函數 | 用途 |
|---|---|
| `bounce(t, {h, g, e, squash, stretch, dur, n, axes})` | 真實重力的落下彈跳：回傳 `{y, sy, sx, contact, impacts}`；落地壓扁、下落拉伸、彈性係數衰減。`t` = 放開後的秒數；`axes: 3` 用於 3D（體積守恆） |
| `squashClearance(width, squash, axes)` | 物件壓扁時會變寬多少：並排物件的中心距離至少 `寬 + 這個值`，才不會穿模 |
| `shake(t, {amp, freq, seed, rot})` | 手持相機：有機漂移＋微抖，回傳 `[dx, dy, rot]` |
| `litFill(c, x0, y0, x1, y1, col, {light, dark})` | 單側受光的線性漸層（讓扁平形狀有體積） |
| `ballFill(c, cx, cy, r, col, {lx, ly, light, dark})` | 球體感的放射漸層：偏心高光＋暗部明暗交界 |
| `atmos(col, depth, fog)` | 大氣透視：越遠越接近霧色、對比越低 |

堆疊物件要跟著下方物件「實際的（含壓扁）」頂面走；滾動角度 = 位移 / 半徑；每個接觸點都要有陰影。範例：`examples/05-3d-render.js`、`examples/11-bauhaus.js`。

## 7. 文字

```js
text(c, '標題', x, y, {
  size: 120, family: 'Noto Sans TC', weight: 900, italic: false,
  col: '#111',                       // null = 不填色（只描邊）
  align: 'center', baseline: 'middle', track: 4,   // 字距（px）
  strokes: [{ w: 28, col: '#1f1d1a' }, { w: 14, col: '#fff' }],   // 多層描邊，由粗到細自動排序
  shadow: { x: 0, y: 8, blur: 0, col: 'rgba(0,0,0,.25)' },
  alpha: 1,
});
typeset(c, '一個字一個字', x, y, opts, (i, n, ch) => ({ dx, dy, s, rot, a, col }));   // 逐字動畫
measure(c, str, opts);   // 寬度
```

- `family` 預設是 `PROJECT.fonts[0]`。所有字型都要列在 `config.fonts`，引擎會只載入用到的字形。
- 多行文字：自己按寬度斷行（中文可以逐字斷，標點不要放行首）。
- `fillStyle` 可以是漸層：`col: (() => { const g = c.createLinearGradient(0, y - 60, 0, y + 60); g.addColorStop(0, '#fff6a0'); g.addColorStop(1, '#ffb300'); return g; })()`。

## 8. three.js

```js
import { THREE, W, H, draw3D, loadEnv, envMap, preload } from '../engine.js';
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, W / H, .1, 100);
preload(loadEnv().then(env => { scene.environment = env; }));   // 需要反射、玻璃、金屬時
const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.MeshPhysicalMaterial({ color: '#f4b6c2', roughness: .3 }));
scene.add(mesh);

function shot(c, t, s) {
  cam.position.set(Math.sin(t * .3) * 6, 2, Math.cos(t * .3) * 6); cam.lookAt(0, 0, 0);
  mesh.position.y = 1 + Math.abs(Math.sin(t * 3));
  draw3D(c, scene, cam, { exposure: 1.1 });     // 合成到 2D 畫面（之後還可以在上面畫字）
}
```

- 場景、幾何、材質在**模組頂層**建立一次；鏡頭函數裡只改位置、旋轉、uniform。
- 可用的附加模組透過 `import('three/addons/...')`（例如 `RoomEnvironment`、`RoundedBoxGeometry`、`mergeVertices`、`SimplexNoise`）。用頂層 `await import(...)` 或 `preload()` 確保載入完成。
- 布光：`lightRig(scene, { preset: 'studio' | 'soft' | 'golden' | 'night' | 'dramatic', size, target })` 一次建好主光、補光、輪廓光、天光、環境反射和柔和陰影；`contactShadow({ size, opacity })` 做接觸陰影（每幀 `sh.follow(obj, groundY)`）。光影類風格的完整做法見 [lighting.md](lighting.md)。
- 陰影（手動）：`gl().shadowMap.enabled = true`（第一次渲染前設），光源 `castShadow`，地面 `receiveShadow`。
- 玻璃：`MeshPhysicalMaterial({ transmission: 1, thickness: 1.2, roughness: .05, ior: 1.5, dispersion: 5 })`，需要 `scene.environment`。
- 自訂著色器：`ShaderMaterial` 或全螢幕四邊形（液態金屬、彌散漸變、噪聲場）。
- **色彩空間**：three.js 會把 `new THREE.Color('#ff2bd6')` 轉成線性空間。自訂 `ShaderMaterial` 的片段著色器最後要加一行 `#include <colorspace_fragment>`，顏色才會和設計稿一致（否則偏暗、偏飽和）。例外：直接取樣 2D 畫面當貼圖（`CanvasTexture` 設 `colorSpace = THREE.NoColorSpace`）再原樣輸出時，不要加。

## 9. 後期 fx 與 bloom

`config.post` 是預設值；鏡頭裡用 `fx({...})` 覆蓋本幀的值。

| 鍵 | 效果 | 常用值 |
|---|---|---|
| `grain` | 顆粒 | .02–.08 |
| `vignette` | 暗角 | .1–.5 |
| `chroma` | RGB 分離 | .2–2 |
| `scan` | 掃描線 | .1–.5 |
| `vhs` | 錄像帶：行抖動、色彩溢出、雜訊 | .3–1 |
| `curve` | CRT 弧面 | .05–.2 |
| `sat` `contrast` `bright` | 飽和、對比、亮度（0 = 不變；正負都可） | −.3–.3 |
| `warm` | 色溫（正暖負冷） | −1–1 |
| `poster` | 色階數（印刷感） | 4–8 |
| `flash` `flashCol` | 閃白／閃色 | 0–1 |
| `bloom` | `{amount, radius, threshold, tint}` 光暈；`tint` 給光暈上色（暖色 halation） | `{amount: .7, radius: 30, threshold: .6, tint: '#ffd8a8'}` |
| `grade` | 調色：`{lift, gain, gamma, shadows, highlights, split}`，`shadows`／`highlights` 是分離色調的顏色，`split` 是強度 | `{shadows: '#1a1430', highlights: '#fff2dc', split: .35}` |
| `letterbox` | 電影黑邊（畫面高度比例） | .06–.12 |
| `lens` | 鏡頭感：輕微桶形＋邊緣色散 | .1–.3 |

## 9½. 動態模糊與審查渲染

- `config.motionBlur = { samples: 5, shutter: .5 }`：每幀平均 `samples` 個子幀，分佈在 `shutter` × 幀間隔內（.5 = 180° 快門）。所有會動的東西都有真實的動態模糊。鏡頭層級用 `mb` 覆蓋（見第 2 節）。
- 開發時可以先關掉（`samples: 1`）加快預覽，最終渲染一定要開。
- `node render.mjs --audit [--audit=3,4] [--points=.2,.5,.85] --out=out/audit`：每個鏡頭在 20%／50%／85% 處各輸出一張全解析度 PNG，供 [review.md](review.md) 的逐項審查。
- 頁面載入時任何錯誤會讓 `render.mjs` 立刻結束（exit 1）並印出錯誤，不會空等。

## 10. 素材與預載

- `asset('assets/photo.jpg')` 在模組頂層呼叫，回傳 `<img>`，保證第一幀之前載入完成。
- `preload(promise)`：任何非同步準備（環境貼圖、JSON、預先計算）。
- SVG 路徑：`new Path2D('M10 10 L...')`，可以直接 `c.fill(path)`。
- 使用者提供的圖片、Logo 放在 `assets/`。

## 11. 常用模式

**落體、碰撞（解析式）**：彈跳 `y = h·|cos(ω·t)|·e^(−kt)`；落地時間可以算出來，就能精準對拍。

**預先模擬**：真的需要物理（多物體堆疊）時，在模組頂層用固定步長算完整條軌跡存進陣列，鏡頭裡用 `traj[Math.floor(lt * 120)]` 取值（必要時插值）。這仍然是 t 的純函數。

**遮罩揭示**：
```js
const m = layer('mask'); m.fillStyle = '#fff'; m.beginPath(); m.arc(x, y, r, 0, TAU); m.fill();
m.globalCompositeOperation = 'source-in'; m.drawImage(someCanvas, 0, 0);
c.drawImage(m.canvas, 0, 0);
```

**景深分層（2.5D）**：每層各自畫在 `layer()` 上，用 `c.filter = 'blur(Npx)'` 模糊後再合成；焦點換層時，模糊半徑做插值。

**橫竪版共用**：所有尺寸乘 `U = Math.min(W, H) / 1080`；`const V = H > W` 判斷竪版，只在構圖分支處使用。

**長片分工**：每個章節一個場景檔，先把整片 overview 跑通，再逐章深化。

## 12. 效能

- 目標每幀 ≤ 300 ms（日誌會顯示）。30 s × 30 fps = 900 幀，300 ms × 900 ÷ 4 個 worker ≈ 70 秒。
- 最常見的瓶頸：每幀重畫水彩、每幀 `ctx.filter = 'blur()'` 大面積模糊、每幀建立漸層和畫布、粒子太多卻用 2D 畫。
- 對策：`cache()`；在小畫布上模糊再放大；粒子 > 3000 就改用 three.js `Points`。
