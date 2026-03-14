# 會眾管理系統 - 功能規格

## 1. 區域管理（Area Management）

### 1.1 功能需求
- **新增區域**：創建新的服務區域
- **查看區域**：列表和詳情頁面
- **編輯區域**：更新區域資料
- **刪除區域**：移除區域（軟刪除）
- **區域分配**：將區域分配給成員

### 1.2 數據模型
```typescript
Area {
  id: string
  name: string
  description: string?
  assignedTo: string?  // Member ID
  lastActivityAt: DateTime
  createdAt: DateTime
  updatedAt: DateTime
}
```

### 1.3 API 端點
- `GET /api/areas` - 獲取區域列表
- `POST /api/areas` - 創建區域
- `GET /api/areas/[id]` - 獲取單個區域
- `PUT /api/areas/[id]` - 更新區域
- `DELETE /api/areas/[id]` - 刪除區域

---

## 2. 排班系統（Scheduling System）

### 2.1 功能需求
- 建立排班表
- 分配服務人員到時段
- 查看週期性排班
- 排班衝突檢測
- 排班狀態管理

### 2.2 數據模型
```typescript
Schedule {
  id: string
  areaId: string
  memberId: string
  date: DateTime
  timeSlot: string  // morning, afternoon, evening
  status: string    // scheduled, completed, cancelled
  notes: string?
  createdAt: DateTime
  updatedAt: DateTime
}
```

### 2.3 API 端點
- `GET /api/schedules` - 獲取排班列表
- `POST /api/schedules` - 創建排班
- `GET /api/schedules/[id]` - 獲取單個排班
- `PUT /api/schedules/[id]` - 更新排班
- `DELETE /api/schedules/[id]` - 刪除排班

---

## 3. 回報系統（Reporting System）

### 3.1 功能需求
- 服務回報提交
- 回報審核流程
- 歷史回報查詢
- 回報統計分析

### 3.2 數據模型
```typescript
Report {
  id: string
  areaId: string
  memberId: string
  content: string
  status: string      // pending, reviewed, approved
  reviewedBy: string?
  reviewedAt: DateTime?
  submittedAt: DateTime
  createdAt: DateTime
  updatedAt: DateTime
}
```

### 3.3 API 端點
- `GET /api/reports` - 獲取回報列表
- `POST /api/reports` - 創建回報
- `GET /api/reports/[id]` - 獲取單個回報
- `PUT /api/reports/[id]` - 更新回報
- `DELETE /api/reports/[id]` - 刪除回報

---

## 4. 統計報表（Statistics & Reports）

### 4.1 功能需求
- 服務時數統計
- 區域活動報告
- 成員參與度分析
- 數據視覺化圖表

### 4.2 API 端點
- `GET /api/statistics` - 獲取統計數據

---

## 5. 閒置區域警告（Idle Area Warnings）

### 5.1 功能需求
- 自動檢測閒置區域（超過30天無活動）
- 通知提醒系統
- 警告儀表板

### 5.2 計算邏輯
```typescript
// 如果 lastActivityAt > 30 天前，標記為閒置
const idleThreshold = 30 * 24 * 60 * 60 * 1000
const isIdle = (Date.now() - lastActivityAt) > idleThreshold
```

---

## 6. UI/UX 設計規範

### 6.1 Mission Control 深色主題
```css
--mc-bg: #0F0F23
--mc-card: #1A1A2E
--mc-accent: #16213E
--mc-highlight: #0F3460
--mc-text: #E8E8E8
--mc-success: #4ADE80
--mc-warning: #FBBF24
--mc-error: #F87171
```

### 6.2 設計原則
- 簡潔直觀的界面
- 一致的視覺語言
- 響應式佈局
- 無障礙設計

---

## 7. 成員管理（Members）

### 7.1 數據模型
```typescript
Member {
  id: string
  name: string
  email: string
  password: string
  phone: string?
  role: string  // admin, publisher, elder
  active: boolean
  createdAt: DateTime
  updatedAt: DateTime
}
```

### 7.2 API 端點
- `GET /api/members` - 獲取成員列表
- `POST /api/members` - 創建成員
- `GET /api/members/[id]` - 獲取單個成員
- `PUT /api/members/[id]` - 更新成員
- `DELETE /api/members/[id]` - 刪除成員

---

## 8. 認證系統（Authentication）

### 8.1 功能需求
- NextAuth.js 集成
- 電子郵件/密碼登錄
- 會話管理
- 角色權限控制

### 8.2 安全措施
- bcrypt 密碼加密
- JWT 會話
- CSRF 保護
