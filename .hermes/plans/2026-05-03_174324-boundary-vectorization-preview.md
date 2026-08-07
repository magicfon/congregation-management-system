# 大疆界圖邊界向量化預覽計畫

## Goal

先做一版新的「大疆界圖 → 邊界線抽取 → 向量/預覽輸出」流程，讓 cHinL 可以先看抓出來的邊界長什麼樣子，再決定要不要進一步產生可編輯的區域 polygon JSON。

本輪目標不是直接取代既有 `*-areas.json`，而是產出可檢查的 debug/preview artifacts。

## Current context

目前 repo：

- `/home/chinl-ubuntu/.openclaw/workspace/congregation-management-system`

主要大圖：

- `public/maps/nanzih-1-89.png`，7884x5512，約 19.96 MB
- `public/maps/chiaotou-90-148.png`，4827x4534，約 6.33 MB
- `public/maps/tzuguan-149-213.png`，4828x4038，約 4.53 MB

舊流程相關檔案：

- `scripts/extract-boundaries.js`
  - 從大圖抽藍紫/紫色邊界，輸出 `*-boundaries.png`
- `scripts/detect-areas-optimized.js`
  - 從 `*-boundaries.png` flood fill 黑色區域，輸出 `*-areas-detected.json`
- `public/tools/area-marker.html`
  - 用來載入地圖與 JSON 做人工編修

舊流程問題：

- 邊界線斷裂會造成 flood fill 外洩。
- 抗鋸齒、文字、路名、地圖底圖線條會干擾。
- 直接從黑色連通區域猜 polygon，拓撲不穩。
- 結果不準，後續人工修正成本高。

## Scope for first version

先只針對一張圖做試驗：

- 優先：`public/maps/nanzih-1-89.png`

原因：

- 楠梓是最大張、最難處理。
- 若楠梓可接受，橋頭/梓官通常較容易套用。
- 但楠梓 20MB、7884x5512，處理時間與記憶體需求較高，所以先用 debug 輸出控制風險。

## Proposed approach

改成「邊界線為主」的 pipeline：

1. 從原圖抽出淺藍紫/紫色邊界 mask。
2. 清掉小雜訊。
3. 修補短距離斷線。
4. skeletonize 成 1px 中心線。
5. 輸出 debug preview 圖，讓人看線抓得準不準。
6. 初步輸出向量線資料，不急著直接產正式 area polygon。

第一版重點是「看得見、可比較、可調參」，而不是一次做到完全自動化。

## Planned files to add/change

### Add

- `scripts/vectorize-boundaries.py`
  - 新的 Python 邊界抽取/預覽腳本。
  - 支援 CLI 參數：input image、output prefix、可調 HSV/Lab threshold。

### Output artifacts, not necessarily committed

建議輸出到：

- `public/maps/generated/`

第一版可能產生：

- `public/maps/generated/nanzih-boundary-mask-v2.png`
  - 原圖抽出的二值 mask。

- `public/maps/generated/nanzih-boundary-clean-v2.png`
  - 去雜訊、補線後的 mask。

- `public/maps/generated/nanzih-boundary-skeleton-v2.png`
  - skeletonized 1px 邊界線。

- `public/maps/generated/nanzih-boundary-overlay-v2.png`
  - 把抓到的邊界線疊回原始大圖，方便肉眼檢查。

- `public/maps/generated/nanzih-boundary-lines-v2.geojson`
  - 初步向量線資料。

- `public/maps/generated/nanzih-boundary-preview-v2.html`
  - 可在瀏覽器開啟的預覽頁，顯示大圖 + 邊界 overlay。

可選輸出：

- `public/maps/generated/nanzih-areas-polygonize-preview-v2.json`
  - 若 polygonize 初步效果可看，才輸出。
  - 不作為正式 `nanzih-areas.json`。

## Implementation tasks

### Task 1 — dependency check

確認目前環境是否有以下 Python 套件：

- `cv2` / `opencv-python`
- `numpy`
- `skimage` / `scikit-image`
- `shapely`
- `scipy`

若缺少，先不要直接大量安裝，回報缺哪些；確認後再裝。

### Task 2 — create boundary extraction script

新增 `scripts/vectorize-boundaries.py`。

CLI 初版設計：

```bash
python3 scripts/vectorize-boundaries.py \
  --input public/maps/nanzih-1-89.png \
  --map-id nanzih \
  --output-dir public/maps/generated \
  --preview-scale 0.25
```

功能：

- 讀取大圖。
- 轉 HSV 或 Lab。
- 產生多組候選 mask：
  - purple/blue-purple HSV threshold
  - light cyan/pale purple threshold
  - high-saturation violet threshold
- 合併 mask。
- remove small objects。
- morphological close / dilation / erosion 修補斷線。
- skeletonize。
- 輸出 mask/clean/skeleton/overlay debug PNG。

### Task 3 — first visual debug output

先跑楠梓：

```bash
python3 scripts/vectorize-boundaries.py \
  --input public/maps/nanzih-1-89.png \
  --map-id nanzih \
  --output-dir public/maps/generated \
  --preview-scale 0.25
```

產出後檢查：

- mask 是否抓到主要淺藍紫/紫色疆界線。
- 是否抓太多文字、道路、編號。
- skeleton 是否斷太多。
- overlay 是否容易肉眼確認。

### Task 4 — vector line extraction

若 Task 3 的 mask 可接受：

- 從 skeleton pixels 轉成線段或 graph。
- 找 endpoints。
- 針對短距離 endpoint 做候選連接：
  - 預設距離 5～25px。
  - 方向相近才連。
- 輸出 `nanzih-boundary-lines-v2.geojson`。

此步驟先以「可視化線段」為目標，不急著產封閉 polygon。

### Task 5 — optional polygonize preview

若線段品質夠好，再做：

- Shapely `polygonize`。
- 過濾太小碎片。
- 過濾外框/巨大背景區。
- 輸出初步 polygon preview JSON。

但這個是 optional，第一輪若 mask 還需要調參，就先停在 visual preview。

### Task 6 — generate browser preview

建立簡單 HTML preview：

- 顯示原圖低解析縮圖。
- 疊加 mask/skeleton/line overlay。
- 可以切換圖層：
  - 原圖
  - mask
  - clean mask
  - skeleton
  - overlay

預覽路徑可能是：

- `/maps/generated/nanzih-boundary-preview-v2.html`

或直接提供本地檔案位置。

## Validation steps

### Automated checks

- 腳本跑完 exit code = 0。
- 輸出檔案存在。
- 輸出 PNG 尺寸合理。
- GeoJSON 若有產出，格式可被 `json.load()` 讀取。
- 若產 polygon preview，檢查 polygon count、面積分布。

### Visual checks

人工看：

- 邊界主線是否大致完整。
- 是否抓到太多非邊界元素。
- 斷線是否可接受。
- 重要區域交界是否有被抓到。

### Comparison with old outputs

可比較：

- 舊 `public/maps/nanzih-boundaries.png`
- 新 `public/maps/generated/nanzih-boundary-clean-v2.png`
- 新 `public/maps/generated/nanzih-boundary-overlay-v2.png`

## Risks / tradeoffs

- 楠梓原圖很大，處理可能慢；第一版要控制 preview scale 與記憶體。
- 顏色 threshold 可能需要多次調參。
- 若原圖邊界顏色和道路/文字相近，仍會有 false positive。
- 全自動 polygonize 可能仍不完美；但新流程會先把「線抓得怎樣」可視化，避免黑箱產爛 JSON。
- `area-marker.html` 目前仍是 4000+ 行靜態工具，這次不重構它。

## Open questions for cHinL

1. 第一張要先用楠梓嗎？我建議是楠梓，因為最大、最有代表性。
2. 預覽輸出是否可以先放在 `public/maps/generated/`？
3. 第一輪是否只要看 mask/skeleton/overlay，不急著產 polygon JSON？我建議先這樣。
4. 產出的 debug artifacts 要不要 commit？我建議先不 commit，等你確認效果後再決定。

## Proposed execution order after approval

1. 檢查 Python CV dependencies。
2. 若缺套件，回報並等待是否安裝。
3. 新增 `scripts/vectorize-boundaries.py`。
4. 跑楠梓第一版 preview。
5. 產出 3～5 張 debug 圖與 preview HTML。
6. 回報檔案路徑，讓 cHinL 看圖。
7. 根據視覺結果調 threshold / 補線策略。
8. 效果可接受後，再進 polygonize / JSON 產生。
