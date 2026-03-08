# 會眾傳道區域管理系統

會眾傳道區域管理系統 - 用於追蹤和管理傳道區域、排班和統計。

## 功能

- 📊 區域 Dashboard - 總覽所有區域狀態
- 🗺️ 區域管理 - CRUD 操作
- 📅 排班系統 - 時段和組別管理
- 📈 統計報表 - 傳道頻率和閒置警告
- 🔔 提醒通知 - 閒置區域自動提醒

## 技術棧

- **框架**: Next.js 15 (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **數據庫**: SQLite (本地) / Vercel Postgres (生產)
- **部署**: Vercel

## 開始

```bash
npm install
npm run dev
```

## 環境變量

```env
DATABASE_PATH=/app/.data/congregation.db
GOOGLE_SHEETS_ID=1Dt4YvBIhk5u70NzVVA36ya5C8Rpu3SctqQmwu3i4HGU
```

## License

MIT
