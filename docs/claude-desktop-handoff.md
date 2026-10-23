# Claude Desktop 交接

交接日期：2026-10-23。使用者選擇在同一台電腦、同一個專案資料夾接手。

## 工作位置

- 本機：`/home/chinl-ubuntu/projects/congregation-management-system`
- GitHub：`https://github.com/magicfon/congregation-management-system`
- 正式站：`https://congregation-management-system.vercel.app`

Claude 工作階段需要有讀寫上述資料夾與執行終端機指令的能力。若目前工作階段只有聊天或附件閱讀能力，請先告知使用者能力缺口，再完成可執行的接入設定。不要要求使用者把 `.env` 貼進聊天。

## 接手順序

1. 閱讀根目錄 CLAUDE.md、AGENTS.md，依其中指引閱讀 CONTEXT.md、ADR-0001～0003；針對後續任務另讀相關最新 ADR。
2. 執行 `git status --short --branch` 與 `git log -5 --oneline`，列明目前分支、未提交修改；依 AGENTS.md 在修改前執行 `git pull --rebase origin main`。若有妨礙同步的本機修改，先釐清歸屬並保留。
3. 確認 Node/npm、依賴是否可用；只檢查必要環境變數是否存在，回報缺少的名稱，不輸出值。本機 `.env` 可能連到正式 Neon，不能視為獨立測試資料庫。
4. 需要本機瀏覽時以 `npm run dev` 啟動，使用可用連接埠。`npm run build` 會跑多項 DB SQL 與服務排班 seed；執行前確認目標資料庫與本次工作是否需要這些寫入。README 的初始化步驟不適合作為現有正式資料庫的操作指引。
5. 依 AGENTS.md 執行 TypeScript 檢查。首次交接回報：分支與提交、未提交項目、檢查結果、缺少的工具或授權，以及使用者下一項工作；不要把歷史規劃中的待辦直接視為目前需求。

## 交接時觀察到的狀態

- 交接文件修改前，`main` 已與 `origin/main` 同步；當時程式最新提交為 `4c36bf7`：LIFF 沿用裝置登入直接進入並移除重複標頭。
- 最近決策為 ADR-0063（LIFF 裝置既有登入）、0062（session 沿用）、0061（全站共用外觀）。新規則須連同較新決策閱讀，不能只依舊版敘述實作。
- 工作目錄已有未追蹤的 `.impeccable/critique/2026-10-21T03-32-56Z__src-app.md`。這是既存本機檔案，交接未將它納入提交；保留並由使用者決定後續用途。
- 本次任務只有建立交接入口，使用者尚未指定 Claude 接手後的新功能或修正。

上述為交接快照，後續以實際 Git 狀態為準。

## 同機環境的界線

本機檔案可以沿用，但 Claude 工作階段能否存取 WSL／Linux 路徑、環境變數與 CLI 登入，仍須實際確認。Vercel／GitHub CLI 授權與 Codex 的工具許可不保證會自動傳給 Claude。

AGENTS.md 記錄的每 15 分鐘同步由主機 crontab 負責。接手時先唯讀確認排程歸屬與是否存在，保留既有排程，避免重複新增。憑證與排程內容可能含秘密，回報僅描述存在與否。

日常開發、提交推送與部署驗證依 AGENTS.md；本次交接本身不需要部署、修改 DB 或觸發 Sheet 同步。
