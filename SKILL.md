---
name: rusty-lake-film
description: 用程式做 Rusty Lake（Roots／Paradise／Hotel 後期作品）風格的短片、樣板圖、動態插畫：粗黑描邊＋平塗＋硬邊色塊陰影的蒼白呆滯人物、動物頭人身與面具人、手繪寫實的壁紙與油畫背景、老照片暗角與圓角黑框、紙偶式的少量詭異動作（眨眼、眼睛轉向你、慢慢歪頭、跳動的心臟、擺動的吊燈與鐘擺）。Canvas 2D 逐幀渲染、無頭 Chrome 截圖、ffmpeg 合成，含對拍配樂。只要使用者提到 Rusty Lake、Cube Escape、鏽湖、Vanderboom、動物頭人身的詭異插畫、超現實解謎遊戲畫風、維多利亞老照片恐怖感，或想要「這種風格」的短片、片頭、GIF、海報、分鏡圖，即使沒提 skill 也要使用。
---

# Rusty Lake 風格短片（rusty-lake-film）

把一個想法做成 Rusty Lake 後期作品畫風的短片或靜態圖。每一幀是時間 `t` 的純函數：`src/scenes/*.js` 用 Canvas 2D 繪製，`src/scenes/kit.js` 提供這個畫風專用的繪圖工具（描邊、硬邊陰影、臉、頭髮、手、壁紙、牆面投影、圓角黑框），`render.mjs` 用無頭 Chrome 逐幀截圖，ffmpeg 編碼，`music/score.mjs` 依設定合成配樂。

這個 skill 是從實作中迭代出來的：前兩版「看起來有點像」，真正到位是在對照遊戲原尺寸截圖、把描邊加粗、把排線換成硬邊色塊、把頭放大、把背景換成寫實手繪之後。**規則裡的每一條都是踩過的坑**，不要跳過。

## 文件結構

| 檔案 | 內容 | 何時讀 |
|---|---|---|
| [references/style.md](references/style.md) | 畫風規則：線、陰影、色彩、背景、構圖、動作、鏡頭、轉場、聲音、三種時期的配方 | 每次都讀 |
| [references/characters.md](references/characters.md) | 人物骨架：比例、臉部座標系、頭髮、帽子、身體、手、動物頭、面具；如何設計新角色 | 每次有人物都讀 |
| [references/kit-api.md](references/kit-api.md) | `kit.js` 每個函數的參數與座標約定 | 寫程式前讀 |
| [references/checklist.md](references/checklist.md) | 原尺寸審查清單＋已知錯誤圖鑑 | 每次渲染後對照 |
| [references/engine.md](references/engine.md) | 引擎 API（時間軸、轉場、緩動、layer、cache、fx、文字、three.js） | 需要時查 |
| `examples/s01-family.js` | 家族合照：4 個人物、玫瑰壁紙、牆面投影、閃光燈轉場 | 新人物的基準 |
| `examples/s02-hall.js` | 綠色走廊：立面室內、吊燈、女僕抬眼、交疊雙手、蠟燭逐一熄滅 | 室內場景的基準 |
| `examples/s03-paradise.js` | 灰色房間：只留紅色、鹿頭人、跳動滴血的心臟、落鐘、打字字幕 | 動物頭與 Paradise 配方的基準 |

範例是**最低標準**：新作品至少要和它們一樣精緻，然後依題材重新設計。

## 工作流程

### 0. 對齊參數（未確認前不寫場景程式）

給使用者一張參數卡，每項附推薦值和一句理由，等他回「按推薦」或修改。使用者已說「直接做」時，列出參數卡後直接開工。

| 項目 | 預設推薦 |
|---|---|
| 時期配方 | Roots（暖褐老照片＋碎花壁紙）／Hotel（綠色調室內）／Paradise（灰階＋唯一紅色）；見 style.md 第 9 節 |
| 比例 | 16:9 1920×1080（遊戲本身是橫向舞台構圖） |
| 時長 | 樣片 12–20 秒；每個鏡頭 ≥ 4 秒（這個畫風靠「停滯中的一個小異動」，太短做不出） |
| 幀率 | 24 fps；動態模糊 samples 1（紙偶動作慢） |
| 節奏 | 60–72 bpm，鐘擺、心跳、眨眼落在拍點 |
| 配樂 | `ambient`；同步音效：快門、鐘的 tick、低沉 boom 當心跳、chime 收尾 |
| 字幕 | 需要時用頂部黑條＋舊式襯線字（IM Fell English），逐字打出 |
| 人物 | 列出每個角色：身分、服裝、髮色、表情、這一鏡唯一的動作 |
| 結尾卡 | Claude Code 結尾卡預設開啟；樣片／測試可關 |
| 子資料夾 | 片名英文 slug，成片在 `<slug>/out/<slug>.mp4` |

### 1. 讀文件、寫分鏡

完整讀 style.md、characters.md、checklist.md，並打開最接近的 example。寫 `STORYBOARD.md`：一句話概念、時期配方、色板、每個鏡頭的「畫面／觀眾要讀懂的一件事／構圖／鏡頭運動／唯一的詭異動作／轉場進入／聲音」。（範本：`examples/STORYBOARD-sample.md`）

**每個鏡頭只放一個異動**：家族合照裡新娘的眼睛轉向你；走廊裡女僕抬眼；灰房間裡心臟跳動滴血。其餘全部靜止或只有呼吸。這種「靜中一動」就是 Rusty Lake 的恐怖感。

### 2. 搭專案

```bash
bash ~/.claude/skills/rusty-lake-film/scripts/new_film.sh ./<slug>            # 空專案
bash ~/.claude/skills/rusty-lake-film/scripts/new_film.sh ./<slug> --demo     # 附三個範例場景，可直接渲染對照
```

改 `src/config.js`，一個場景一個檔放 `src/scenes/`，在 `src/main.js` 串起來。

### 3. 先英雄幀，後動畫（每個鏡頭）

1. **背景先做並 `cache()`**：手繪感的牆、壁紙、窗外風景（`floral()`、`paintOver()`），靜態的一律快取。
2. **人物靜幀**：照 characters.md 搭骨架 → 臉 → 頭髮／帽子 → 衣服硬邊陰影 → 手。人物畫進 `layer()`，先 `wallShadow()` 再貼人物。
3. `node render.mjs --audit=<n> --points=.3 --out=out/audit`，用 Read 看**原尺寸**，再用 ffmpeg 裁出臉、手、帽子放大看。對照 checklist.md 逐項改到全部通過。
4. 再加動作：呼吸、眨眼、眼神、唯一的異動、鏡頭緩推。
5. `--strip` 檢查每個轉場。

### 4. 渲染與交付

```bash
node music/score.mjs
node render.mjs --frames --workers=4          # 加 --fresh 重新渲染全部
node render.mjs --encode --out=out/<slug>.mp4
ffmpeg -i out/<slug>.mp4 -c:v libx264 -crf 21 -preset slow -pix_fmt yuv420p -c:a copy out/<slug>-small.mp4   # 顆粒讓原檔很大，附一份小檔
node render.mjs --audit --points=.55 --out=out/stills                         # 每個鏡頭一張樣板圖
```

交付時給：MP4 路徑、長度、每鏡一張靜幀、checklist 中仍未達標的項目（誠實寫）、你無法試聽聲音這件事。

## 必守規則

1. **參數先行**，中途改參數先改 `config.js` 和分鏡。
2. **每一幀是 `t` 的純函數**：不用 `Math.random()`（用 `hash()`、`rng(seed)`、`noise3()`），不累積跨幀狀態；滴落、彈跳寫成解析式。
3. **線**：近黑 `#151210`，主輪廓 ≈ 5.6px（1080p），五官和衣褶的主線一樣粗，只有髮絲、指縫用細線。不要細線、不要彩色描邊。
4. **陰影只用硬邊色塊**（`tone()`），不要用排線、不要用柔和漸層代替。柔和的只有一種：人物投在牆上的大片影子（`wallShadow()`）和地上的接觸陰影。
5. **背景是寫實手繪，人物是描邊平塗**：背景不描粗黑邊、要有筆觸質感（`paintOver()`、`floral()`）；人物永遠清晰。這個對比是風格的核心。
6. **頭要夠大**：頭寬 ≈ 肩寬的 40–48%。頭小會變成假人。
7. **一鏡一異動**，其他保持靜止與呼吸；動作像紙偶（部件繞關節轉、慢、偶爾一個突兀的快動作）。
8. **圓角黑框**（`viewport()`）包住每個畫面；Roots 配方再加老照片暗角（`photoVignette()`）。
9. **原創角色**：不要畫 Rusty Lake 的既有角色（Mr. Owl、Mr. Crow 等）或它的 Logo、介面；只借畫風。不要把作品宣稱為官方。
10. **先看再交**：沒用 Read 看過原尺寸（並裁切放大臉和手）的鏡頭不算完成；轉場沒看過 strip 不算完成。
11. **錯位零容忍**：帽子坐在頭上、頭髮蓋住頭頂、手接到手臂、脖子停在領口。這些是最常見、使用者一眼就會看到的錯（checklist.md 第 2 節）。

## 引擎陷阱

- `cache()` 的背景在第一次呼叫時生成（像素迴圈 1–3 秒），之後每幀幾毫秒；不要把會動的東西畫進快取。
- 每幀的 `c.filter = 'blur()'` 很貴：牆面投影每幀只做一次（所有人物先畫進同一個 layer）。
- 轉場期間舊鏡頭會畫到超過它的長度（`s.lt > s.dur`），時間函數要用 `seg()`／`clamp()`。
- 鏡頭平移後畫面邊緣露出黑邊：`cam()` 的視窗不能超出 1920×1080 的世界範圍（平移量 ≤ (z−1)·W/2）。
- 字幕黑條會蓋住畫面頂端：鏡頭推近時，最高的物件（鹿角、高帽）要留在字幕條下方。
- `rm` 清空輸出資料夾可能被權限擋下；`--audit`／`--frames --fresh` 本身就會覆寫，不需要刪。
