# 會眾管理系統 - 技術實施計劃

## 技術棧

### 前端
- **框架**: Next.js 14 (App Router)
- **語言**: TypeScript
- **樣式**: Tailwind CSS
- **UI 組件**: 自定義 Mission Control 組件

### 後端
- **運行時**: Node.js
- **API**: Next.js API Routes
- **ORM**: Prisma
- **數據庫**: SQLite

### 認證
- **框架**: NextAuth.js
- **加密**: bcryptjs

---

## 架構設計

### 目錄結構
```
congregation-management-system/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # 認證相關頁面
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/       # 儀表板頁面
│   │   │   ├── dashboard/
│   │   │   ├── areas/
│   │   │   ├── schedules/
│   │   │   ├── reports/
│   │   │   ├── statistics/
│   │   │   └── members/
│   │   └── api/               # API 路由
│   │       ├── auth/[...nextauth]/
│   │       ├── areas/
│   │       ├── schedules/
│   │       ├── reports/
│   │       ├── statistics/
│   │       └── members/
│   ├── components/            # React 組件
│   │   ├── ui/               # 基礎 UI 組件
│   │   ├── layout/           # 佈局組件
│   │   └── features/         # 功能組件
│   ├── lib/                  # 工具函數
│   │   ├── db.ts            # Prisma 客戶端
│   │   ├── auth.ts          # 認證配置
│   │   └── utils.ts         # 通用工具
│   └── types/                # TypeScript 類型定義
├── prisma/
│   ├── schema.prisma        # 數據庫模型
│   └── seed.ts              # 種子數據
└── public/                   # 靜態資源
```

---

## 實施步驟

### Phase 1: 基礎設施（已完成）
- ✅ Next.js 14 項目初始化
- ✅ TypeScript 配置
- ✅ Tailwind CSS 配置
- ✅ Prisma + SQLite 設置
- ✅ 基礎 UI 組件
- ✅ 認證系統

### Phase 2: 核心功能 API（優先級：高）
**並行執行**:
1. **Members API** 
   - GET, POST, PUT, DELETE
   - bcrypt 密碼加密
   
2. **Schedules API**
   - CRUD 操作
   - 排班衝突檢測邏輯
   
3. **Reports API**
   - CRUD 操作
   - 審核流程邏輯
   
4. **Statistics API**
   - 服務時數統計
   - 閒置區域檢測

### Phase 3: UI 頁面（優先級：高）
**並行執行**:
1. **Members 頁面**
   - 成員列表
   - 新增/編輯表單
   
2. **Schedules 頁面**
   - 排班日曆視圖
   - 新增/編輯表單
   
3. **Reports 頁面**
   - 回報列表
   - 提交/審核表單
   
4. **Statistics 頁面**
   - 統計圖表
   - 閒置區域警告

### Phase 4: 優化與測試（優先級：中）
- 性能優化
- 錯誤處理
- 測試覆蓋

---

## 數據庫設計

### Prisma Schema
```prisma
model Area {
  id            String   @id @default(cuid())
  name          String
  description   String?
  assignedTo    String?
  lastActivityAt DateTime @default(now())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  schedules     Schedule[]
  reports       Report[]
}

model Member {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  password  String
  phone     String?
  role      String
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  schedules Schedule[]
  reports   Report[]
}

model Schedule {
  id        String   @id @default(cuid())
  areaId    String
  memberId  String
  date      DateTime
  timeSlot  String
  status    String   @default("scheduled")
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  area      Area     @relation(fields: [areaId], references: [id], onDelete: Cascade)
  member    Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
}

model Report {
  id          String   @id @default(cuid())
  areaId      String
  memberId    String
  content     String
  status      String   @default("pending")
  reviewedBy  String?
  reviewedAt  DateTime?
  submittedAt DateTime @default(now())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  area        Area     @relation(fields: [areaId], references: [id], onDelete: Cascade)
  member      Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
}
```

---

## UI 組件設計

### Mission Control 主題配置
```typescript
// tailwind.config.js
theme: {
  extend: {
    colors: {
      'mc-bg': '#0F0F23',
      'mc-card': '#1A1A2E',
      'mc-accent': '#16213E',
      'mc-highlight': '#0F3460',
      'mc-text': '#E8E8E8',
      'mc-success': '#4ADE80',
      'mc-warning': '#FBBF24',
      'mc-error': '#F87171',
    }
  }
}
```

### 核心組件
1. **DashboardLayout** - 主佈局
2. **Sidebar** - 側邊欄導航
3. **DataTable** - 數據表格
4. **Form** - 表單組件
5. **Card** - 卡片組件

---

## 開發工具配置

### TypeScript 嚴格模式
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### ESLint + Prettier
- 統一代碼風格
- TypeScript 規則
- React Hooks 規則

---

## 測試策略

### 單元測試
- Jest + React Testing Library
- API 路由測試
- 組件測試

### E2E 測試
- Playwright
- 關鍵用戶流程

---

## 部署計劃

### 本地開發
```bash
npm run dev
```

### 生產部署
- Vercel 部署
- 環境變量配置
- 數據庫遷移

---

## 里程碑

**Week 1**: 基礎設施 + 核心功能 API
**Week 2**: UI 頁面 + 整合測試
**Week 3**: 優化 + 部署
