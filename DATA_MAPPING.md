# 數據映射文檔 (Data Mapping)

## 📊 數據來源

**Google Sheet**: [會眾管理系統原始資料](https://docs.google.com/spreadsheets/d/1Dt4YvBIhk5u70NzVVA36ya5C8Rpu3SctqQmwu3i4HGU/edit?usp=drivesdk)

**分析日期**: 2026-03-16

---

## 📋 數據結構

### 工作表 1：傳道記錄

**總記錄數**: 553 筆

**欄位定義**:

| Google Sheet 欄位 | 資料類型 | Supabase 映射 | 說明 |
|------------------|---------|--------------|------|
| 時間戳記 | DateTime | `reports.createdat` | 記錄建立時間 |
| 傳道員姓名 | String | `members.name` | 傳道員姓名 |
| 傳道時段 | String | `schedules.timeslot` | 服務時段 |
| 區域號碼 | String | `areas.id` | 區域編號 |
| 開始日期 | Date | `schedules.startdate` | 服務開始日期 |
| 結束日期 | Date | `schedules.enddate` | 服務結束日期 |
| 備註 | String | `schedules.notes` | 備註說明 |

---

## 👥 傳道員統計

**總人數**: 32 人

**活躍傳道員** (前 10 名):

| 姓名 | 記錄數 | 百分比 |
|------|--------|--------|
| 曾湖 | 150 | 27.1% |
| 永久誠將 | 83 | 15.0% |
| 王韋翔 | 62 | 11.2% |
| 黃修睦 | 42 | 7.6% |
| 連建賜 | 35 | 6.3% |
| 宮西真悟 | 31 | 5.6% |
| 吳冠憬 | 24 | 4.3% |
| 陳清吉 | 22 | 4.0% |
| 陳冠志 | 14 | 2.5% |
| 張庭瑜 | 12 | 2.2% |

---

## 🗺️ 區域統計

**總數量**: 206 個區域

**最活躍區域** (前 10):

| 區域編號 | 使用次數 |
|---------|---------|
| 207 | 6 次 |
| 95 | 6 次 |
| 202 | 5 次 |
| 203 | 5 次 |
| 200 | 5 次 |
| 201 | 5 次 |
| 116 | 5 次 |
| 117 | 5 次 |
| 88 | 4 次 |
| 7 | 4 次 |

---

## ⏰ 時段分析

**主要時段** (14 種):

| 時段 | 記錄數 | 百分比 |
|------|--------|--------|
| 星期六早上 | 237 | 42.9% |
| 星期日早上 | 150 | 27.1% |
| 星期三早上 | 78 | 14.1% |
| 星期一早上 | 48 | 8.7% |
| 星期三晚上 | 30 | 5.4% |
| 其他時段 | 10 | 1.8% |

---

## 📅 時間範圍

**開始日期**: 2022-09-10

**結束日期**: 2026-03-14

**總跨度**: 約 3.5 年

---

## 🔄 數據導入策略

### Phase 1: 基礎數據導入

1. **成員數據 (Members)**
   - 從「傳道員姓名」欄位提取
   - 自動生成唯一 ID
   - 設置預設密碼（需要成員自行修改）
   - 角色：預設為 `member`

2. **區域數據 (Areas)**
   - 從「區域號碼」欄位提取
   - 使用區域編號作為 ID
   - 名稱：暫時使用編號
   - 描述：空白（需要手動補充）

3. **排班數據 (Schedules)**
   - 關聯成員和區域
   - 設置開始/結束日期
   - 時段分類標準化

### Phase 2: 數據清理

**需要處理的問題**:

1. **姓名不一致**
   - `永久誠將` vs `永久 誠將` (3 筆)
   - `連悅翔` vs `連悦翔` (7 筆)
   - `劉博` vs `劉 博` (1 筆)
   - `陳清吉` vs `陳清吉.` (1 筆)

2. **時段標準化**
   - 星期三晚上有多種寫法
   - 個人區域、特殊活動需要分類

3. **無效數據**
   - 1 筆記錄姓名為 `-`
   - 需要確認是否保留

### Phase 3: 數據驗證

- [ ] 確認所有成員都已導入
- [ ] 確認所有區域都已創建
- [ ] 確認所有排班記錄都已關聯
- [ ] 檢查日期格式正確性

---

## 📝 數據映射規則

### 成員 (Members)

```typescript
{
  id: `member-${memberName}`,  // 基於姓名生成唯一 ID
  name: memberName,             // 傳道員姓名
  email: `${memberName}@temp.local`, // 臨時 email
  password: bcrypt.hashSync('Temp123456', 10), // 預設密碼
  role: 'member',               // 預設角色
  active: true,                 // 預設啟用
  lineuid: null                 // LINE UID（需要手動綁定）
}
```

### 區域 (Areas)

```typescript
{
  id: areaNumber,               // 區域號碼直接作為 ID
  name: `區域 ${areaNumber}`,    // 暫時使用編號作為名稱
  description: '',              // 空白（需要手動補充）
  assignedto: null,             // 暫時不分配
  lastactivityat: latestDate    // 該區域最後活動日期
}
```

### 排班 (Schedules)

```typescript
{
  id: `schedule-${timestamp}`,  // 基於時間戳生成唯一 ID
  areaid: areaNumber,           // 關聯區域
  memberid: `member-${memberName}`, // 關聯成員
  date: endDate,                // 服務日期
  timeslot: standardizedTimeSlot, // 標準化時段
  status: 'completed',          // 預設為已完成
  notes: note || null           // 備註
}
```

---

## ⚠️ 注意事項

1. **姓名重複**: 需要手動合併相似姓名
2. **區域描述**: 需要手動補充區域詳細信息
3. **密碼安全**: 所有成員需要修改預設密碼
4. **LINE 綁定**: 需要成員登入後自行綁定 LINE UID
5. **時段標準化**: 建議建立統一的時段代碼表

---

## 🚀 導入步驟

### Step 1: 準備數據

```bash
# 下載 CSV
curl -L "https://docs.google.com/spreadsheets/d/1Dt4YvBIhk5u70NzVVA36ya5C8Rpu3SctqQmwu3i4HGU/gviz/tq?tqx=out:csv" -o data.csv
```

### Step 2: 數據清理

- 統一姓名格式
- 標準化時段名稱
- 移除無效記錄

### Step 3: 導入 Supabase

```sql
-- 1. 導入成員
INSERT INTO members (id, name, email, password, role, active)
VALUES ...;

-- 2. 導入區域
INSERT INTO areas (id, name, description, lastactivityat)
VALUES ...;

-- 3. 導入排班
INSERT INTO schedules (id, areaid, memberid, date, timeslot, status, notes)
VALUES ...;
```

### Step 4: 驗證數據

```sql
-- 檢查成員數量
SELECT COUNT(*) FROM members;

-- 檢查區域數量
SELECT COUNT(*) FROM areas;

-- 檢查排班數量
SELECT COUNT(*) FROM schedules;
```

---

## 📊 預期結果

| 項目 | 預期數量 | 備註 |
|------|---------|------|
| 成員 | 32 | 清理重複後可能少於 32 |
| 區域 | 206 | 可能需要合併相似區域 |
| 排班 | 553 | 所有歷史記錄 |

---

**最後更新**: 2026-03-16 04:02 UTC
