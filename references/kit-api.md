# kit.js API

`src/scenes/kit.js` 是這個畫風的繪圖工具庫。所有座標都是畫布座標（或當下的變換座標），點陣列是 `[[x, y], ...]`。

## 常數

| 名稱 | 值 | 用途 |
|---|---|---|
| `INK` | `#151210` | 唯一的描邊色 |
| `LW` | `5.6` | 主輪廓線寬（1080p） |

## 描邊與形狀

| 函數 | 說明 |
|---|---|
| `shape(c, pts \| Path2D, fill, { lw, ink, wob, seed, close, stroke })` | 填色＋描邊，回傳 Path2D（拿來給 `tone()` 當剪裁）。`wob` 手抖量（0 = 精準）。`fill` 可為 null（只描邊）、顏色或 pattern。`lw: 0` 只填色 |
| `toPath(pts, { wob, seed, close })` | 點陣列 → Path2D |
| `smooth(pts, n, closed)` | Catmull-Rom 平滑，`n` 每段細分數；開放曲線傳 `closed=false` |
| `brush(c, pts, w, { col, taper, n })` | 收尖筆觸（眉、鼻、褶線、髮絲、袖縫）。`taper` 1 = 兩端尖、0 = 等寬 |
| `line(c, pts, { lw, ink, alpha })`、`curve(c, x0, y0, cx, cy, x1, y1, o)` | 等寬線（少用；大多數線用 `brush`） |

## 陰影與質感

| 函數 | 說明 |
|---|---|
| `tone(c, clip, pts \| Path2D, col, a)` | **硬邊陰影色塊**，剪裁在 `clip` 內，不描邊。這個畫風的主要陰影手段 |
| `wallShadow(c, layerCanvas, { dx, dy, blur, a })` | 把整層人物變黑、模糊、偏移畫到背景上（牆面投影）。每幀只呼叫一次 |
| `paintOver(x, { alpha, seed, scale, streak })` | 在快取的背景上疊 overlay 斑駁筆觸，讓平塗牆面像油畫。只在 `cache()` 裡用 |
| `paperTooth(c, a, seed)` | 全畫面紙紋（overlay），a .22–.3 |
| `hatch(c, path, {...})`、`marks(...)` | 排線（**陰影不要用**；只在極少數紋理用） |

## 圖案與背景

| 函數 | 說明 |
|---|---|
| `houndstooth(a, b, s)` | 千鳥格 tile（`c.createPattern(..., 'repeat')`） |
| `tweed(a, s)` | 粗花呢格 tile |
| `floral({ paper, flower, fdark, flight, leafC, leafD, seed, stain })` | 寫實褪色玫瑰壁紙（1920×1080，快取）。換色可做藍灰、粉、綠版本 |
| `photoVignette(c, a)` | 老照片焦黃暗角（Roots 配方） |
| `viewport(c, { r, pad, soft })` | 圓角黑框，每個畫面最後畫（字幕條之前） |

## 人物

| 函數 | 說明 |
|---|---|
| `face(c, o)` | 整顆頭＋脖子＋耳。參數與座標見 characters.md 第 2 節 |
| `hairCap(c, fw, fh, col, dark, { part, line, side, low, strands, seed })` | 蓋住頭頂的頭髮，畫在 `face()` 之後 |
| `hand(c, x, y, s, a, skin, { curl, spread, shade, flip })` | 一隻手（掌＋四指＋拇指），`(x,y)` 是手腕，手指朝 +y（再用 `a` 旋轉） |
| `foldedHands(c, x, y, { s, skin, shade, sleeve, sleeveD, cuff, elbowDX, elbowDY })` | 腰前交疊的雙手＋前臂＋袖口；`(x,y)` 是兩手交會點，`elbowDX/DY` 是手肘相對位置 |

## 範例中的區域工具（需要時複製）

| 在哪 | 名稱 | 用途 |
|---|---|---|
| s01 | `btn()` | 鈕扣 |
| s01 | `blinkAt()`、`breathe()` | 眨眼、呼吸 |
| s02 | `chandelier()` | 燭台吊燈、蠟燭熄滅與煙 |
| s02 | `roomPainted()` | 快取的立面室內＋`paintOver` |
| s03 | `heart()` | 解剖形狀的心臟（血管、心房、溝） |
| s03 | `drops()` | 解析式滴血與地上血漬 |
| s03 | `clock()` | 落地鐘、羅馬數字錶盤、對拍的秒針與鐘擺 |
| s03 | `caption()` | 頂部黑條＋逐字打出的襯線字幕 |
