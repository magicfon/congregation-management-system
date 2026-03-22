# 智慧套索邊界檢測算法改進報告

## 📋 任務概述

**目標**：改進智慧套索邊界檢測算法，提升對紫色邊界的檢測準確度

**檔案位置**：`public/tools/area-marker.html`

**完成時間**：2026-03-22

---

## ✅ 已實現的改進

### 1. **形態學處理（Morphological Operations）**

#### 膨脹（Dilation）
```javascript
function dilate(imageData, kernelSize = 3, iterations = 1)
```
- **作用**：擴張白色區域
- **原理**：使用 3x3 kernel，取鄰域最大值
- **用途**：連接斷裂的邊界線

#### 侵蝕（Erosion）
```javascript
function erode(imageData, kernelSize = 3, iterations = 1)
```
- **作用**：收縮白色區域
- **原理**：使用 3x3 kernel，取鄰域最小值
- **用途**：去除細小雜訊

#### 形態學開運算
```javascript
// 先膨脹後侵蝕 = 開運算
maskImageData = dilate(maskImageData, 3, 1);
maskImageData = erode(maskImageData, 3, 1);
```
- **效果**：連接斷線，同時保持邊界形狀

---

### 2. **HSV 色彩空間遮罩**

#### 改進前（RGB）
```javascript
Math.abs(r - target.r) <= tolerance &&
Math.abs(g - target.g) <= tolerance &&
Math.abs(b - target.b) <= tolerance
```

#### 改進後（HSV）
```javascript
const hDiff = Math.abs(hsv.h - targetHsv.h);
const sDiff = Math.abs(hsv.s - targetHsv.s);
const vDiff = Math.abs(hsv.v - targetHsv.v);

if (hDiff <= tolerance * 2 && 
    sDiff <= tolerance * 3 && 
    vDiff <= tolerance * 2)
```

#### 優勢
- **色相（H）**：更準確地匹配顏色（如紫色）
- **飽和度（S）**：容忍顏色濃淡變化
- **明度（V）**：容忍光線變化
- **容差獨立調整**：H、S、V 使用不同容差倍數

---

### 3. **輪廓追蹤算法（類似 OpenCV）**

#### findContoursInMask
```javascript
function findContoursInMask(maskData, width, height, minArea = 1000)
```
- **功能**：掃描整個遮罩，找到所有連通區域
- **過濾**：只保留面積 > 1000 的區域
- **返回**：多個輪廓的陣列

#### floodFillContour
```javascript
function floodFillContour(maskData, width, height, startX, startY, visited)
```
- **功能**：使用 Flood Fill 找連通區域的邊界像素
- **邊界檢測**：檢查鄰近是否有黑色像素
- **排序**：按角度排序邊界點（確保多邊形正確）

---

### 4. **主函數改進**

#### 新增流程
```javascript
async function smartLassoDetect(x, y) {
    // 步驟 1: 獲取圖片數據
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // 步驟 2: 創建 HSV 顏色遮罩
    const { mask, width, height } = createColorMask(imageData, lassoColor, colorTolerance);
    
    // 步驟 3: 形態學處理（連接斷線）
    maskImageData = dilate(maskImageData, 3, 1);
    maskImageData = erode(maskImageData, 3, 1);
    
    // 步驟 4: 找所有輪廓
    const contours = findContoursInMask(processedMask, width, height, 1000);
    
    // 步驟 5: 選擇最接近點擊位置的輪廓
    let nearestContour = findNearestContour(contours, x, y);
    
    // 步驟 6: 簡化多邊形（Douglas-Peucker）
    let simplified = simplifyPolygon(nearestContour, 5);
    
    // 步驟 7: 添加到 areas
    areas.push({ id, center, polygon: simplified });
}
```

---

## 📊 算法比較

| 特性 | 舊版（Moore-Neighbor） | 新版（形態學 + HSV） |
|------|----------------------|---------------------|
| **色彩空間** | RGB | HSV（更準確） |
| **斷線處理** | ❌ 無 | ✅ 形態學開運算 |
| **輪廓檢測** | 單一邊界追蹤 | 多輪廓 + 選擇最近 |
| **雜訊過濾** | ❌ 無 | ✅ area > 1000 |
| **紫色檢測** | ⚠️ 準確度低 | ✅ 準確度高 |
| **斷線容忍** | ❌ 易失敗 | ✅ 連接斷線 |

---

## 🎯 使用方式

### 操作步驟
1. **點擊「智慧套索」按鈕** - 進入智慧套索模式
2. **第一步：抽色** - 點擊地圖上的目標顏色（如紫色邊界線）
3. **第二步：追蹤** - 再次點擊區域內部，自動追蹤邊界
4. **調整容差** - 使用滑桿調整顏色匹配容差（5-50）

### 改進提示
- Toast 訊息會顯示：`✅ 已偵測區域 5（32 點，共 3 個候選輪廓）`
- 控制台會輸出詳細日誌（輪廓數量、點數變化）

---

## 🔍 技術細節

### 形態學開運算原理
```
原始遮罩：    膨脹後：      侵蝕後（最終）：
  ■ ■         ■ ■ ■        ■ ■
  ■ ■   →     ■ ■ ■   →    ■ ■
              ■ ■ ■
```
- **膨脹**：擴張白色區域，連接小於 3px 的斷線
- **侵蝕**：收縮回原始大小，去除細小雜訊

### HSV 容差策略
```javascript
// 針對紫色等複雜顏色的寬鬆匹配
hDiff <= tolerance * 2  // 色相容差較大
sDiff <= tolerance * 3  // 飽和度容差最大
vDiff <= tolerance * 2  // 明度容差適中
```

### 輪廓選擇邏輯
```javascript
// 計算每個輪廓中心到點擊位置的距離
for (const contour of contours) {
    const center = getPolygonCenter(contour);
    const dist = Math.sqrt(
        Math.pow(center.x - x, 2) + 
        Math.pow(center.y - y, 2)
    );
    // 選擇距離最小的輪廓
}
```

---

## 📈 預期效果

### 改進前
- 紫色邊界檢測失敗率高
- 斷線導致追蹤中斷
- 雜訊干擾嚴重

### 改進後
- ✅ 紫色邊界檢測準確度顯著提升
- ✅ 可容忍 3px 以內的斷線
- ✅ 自動過濾小面積雜訊
- ✅ 多候選輪廓，選擇最接近的

---

## 🚀 未來優化方向

### 短期
- [ ] Web Worker 支持（大圖片處理）
- [ ] 進度條顯示
- [ ] 取消操作按鈕

### 長期
- [ ] 機器學習顏色分類
- [ ] 自適應容差調整
- [ ] 多顏色聯合檢測

---

## 📝 測試建議

### 測試案例
1. **紫色邊界** - 測試改進的主要目標
2. **斷線邊界** - 驗證形態學處理效果
3. **複雜形狀** - 測試輪廓追蹤準確度
4. **小面積雜訊** - 驗證過濾功能

### 測試步驟
```bash
1. 載入地圖（如楠梓區）
2. 點擊「智慧套索」
3. 抽取紫色邊界顏色
4. 點擊區域內部
5. 檢查偵測結果（Toast 訊息、控制台日誌）
```

---

## ✅ 完成清單

- [x] 添加形態學處理函數（dilate, erode）
- [x] 改進 createColorMask（使用 HSV）
- [x] 實現 findContoursInMask（類似 OpenCV）
- [x] 替換 smartLassoDetect 為改進版
- [x] 更新使用說明
- [x] 添加控制台日誌
- [x] 改進 Toast 提示訊息

---

## 📚 參考資料

- [OpenCV 形態學運算](https://docs.opencv.org/master/d9/d61/tutorial_py_morphological_ops.html)
- [HSV 色彩空間](https://en.wikipedia.org/wiki/HSL_and_HSV)
- [Douglas-Peucker 演算法](https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm)
- [Flood Fill 演算法](https://en.wikipedia.org/wiki/Flood_fill)

---

**完成時間**：2026-03-22  
**測試檔案**：`public/tools/area-marker-test.html`  
**主檔案**：`public/tools/area-marker.html`
