# 會眾管理系統 (Congregation Management System)

一個基於 Web 的會眾管理系統，用於管理區域、排班、回報和統計數據。

## 📋 專案需求

### 核心功能模組

#### 1. 區域管理（Area Management）
- **新增區域** - 創建新的服務區域
- **查看區域** - 列出所有區域及其詳細信息
- **編輯區域** - 更新區域資料
- **刪除區域** - 移除不再使用的區域
- **區域分配** - 將區域分配給成員

#### 2. 排班系統（Scheduling System）
- 建立排班表
- 分配服務人員到時段
- 查看週期性排班
- 排班衝突檢測
- 自動排班建議

#### 3. 回報系統（Reporting System）
- 服務回報提交
- 回報審核流程
- 歷史回報查詢
- 回報統計分析

#### 4. 統計報表（Statistics & Reports）
- 服務時數統計
- 區域活動報告
- 成員參與度分析
- 自定義報表生成
- 數據視覺化圖表

#### 5. 閒置區域警告（Idle Area Warnings）
- 自動檢測閒置區域
- 可配置的閒置時間閾值
- 通知提醒系統
- 警告儀表板

#### 6. Mission Control 深色主題 UI
- 現代化深色主題設計
- 響應式佈局
- 儀表板總覽
- 直觀的導航系統

## 🛠️ 技術棧

### 前端
- **Next.js 14+** - React 框架
- **React 18+** - UI 組件庫
- **TypeScript** - 類型安全
- **Tailwind CSS** - 樣式框架
- **shadcn/ui** - UI 組件庫（可選）

### 後端
- **Next.js API Routes** - 後端 API
- **Prisma** - ORM
- **SQLite** - 本地數據庫

### 開發工具
- **ESLint** - 代碼檢查
- **Prettier** - 代碼格式化
- **Jest** - 單元測試

## 📁 專案結構

```
congregation-management-system/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (dashboard)/        # 儀表板頁面
│   │   ├── api/                # API 路由
│   │   ├── areas/              # 區域管理頁面
│   │   ├── schedules/          # 排班頁面
│   │   ├── reports/            # 回報頁面
│   │   └── statistics/         # 統計頁面
│   ├── components/             # React 組件
│   │   ├── ui/                 # 基礎 UI 組件
│   │   ├── layout/             # 佈局組件
│   │   └── features/           # 功能組件
│   ├── lib/                    # 工具函數
│   │   ├── db.ts              # 數據庫連接
│   │   └── utils.ts           # 通用工具
│   └── types/                  # TypeScript 類型定義
├── prisma/
│   ├── schema.prisma          # 數據庫模型
│   └── seed.ts                # 種子數據
├── public/                     # 靜態資源
├── tests/                      # 測試文件
└── docs/                       # 文檔
```

## 🚀 快速開始

### 安裝依賴
```bash
npm install
```

### 設置數據庫
```bash
npx prisma generate
npx prisma db push
```

### 運行開發服務器
```bash
npm run dev
```

### 訪問應用
打開瀏覽器訪問 [http://localhost:3000](http://localhost:3000)

## 📊 數據模型

### Area（區域）
- id: string
- name: string
- description: string
- assignedTo: string (成員 ID)
- createdAt: datetime
- updatedAt: datetime
- lastActivityAt: datetime

### Member（成員）
- id: string
- name: string
- email: string
- role: string
- createdAt: datetime

### Schedule（排班）
- id: string
- areaId: string
- memberId: string
- date: datetime
- timeSlot: string
- status: string

### Report（回報）
- id: string
- areaId: string
- memberId: string
- content: string
- submittedAt: datetime
- status: string

## 🎨 UI 設計規範

### 顏色主題（Mission Control Dark）
- 背景：#0F0F23
- 卡片：#1A1A2E
- 強調：#16213E
- 高亮：#0F3460
- 文字：#E8E8E8
- 成功：#4ADE80
- 警告：#FBBF24
- 錯誤：#F87171

### 設計原則
- 簡潔直觀的界面
- 一致的視覺語言
- 流暢的用戶體驗
- 無障礙設計

## 📝 開發路線圖

### Phase 1: 基礎架構
- [x] 專案初始化
- [ ] 數據庫模型設計
- [ ] 基礎 UI 組件
- [ ] 認證系統

### Phase 2: 核心功能
- [ ] 區域管理 CRUD
- [ ] 排班系統
- [ ] 回報系統

### Phase 3: 高級功能
- [ ] 統計報表
- [ ] 閒置警告
- [ ] 數據視覺化

### Phase 4: 優化
- [ ] 性能優化
- [ ] 測試覆蓋
- [ ] 文檔完善

## 📄 授權

MIT License

## 👥 貢獻者

歡迎提交 Issue 和 Pull Request！

---

**注意：** 這是一個內部管理系統，用於協助會眾服務的組織和協調工作。
