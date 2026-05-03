# 部署準備清單

這份文件整理傳道區域管理系統部署到 Vercel 前需要準備的內容。

## 目前 repo 狀態

- GitHub remote: `https://github.com/magicfon/congregation-management-system.git`
- 目前分支: `main`
- 已完成但尚未 push 的安全修正 commit:
  - `cb466d3 fix: enforce session authorization on management APIs`
  - `fbf8c0c fix: remove committed secrets and enforce env config`
  - `6ffa4d4 fix: harden member API and restore build`
- 合併 patch 備份: `/home/chinl-ubuntu/.openclaw/workspace/artifacts/congregation-management-system-security-fixes-v2.patch`

## 必要部署平台

- GitHub: 儲存程式碼與觸發 Vercel deploy
- Vercel: Next.js hosting
- Supabase: production database / API
- LINE Login: optional，只有要啟用 LINE OAuth 登入才需要

## GitHub push 前置準備

目前本機還沒有可用的 GitHub push auth：

- `gh auth status`: not authenticated
- global `user.name`: unset
- global `user.email`: unset
- global credential helper: unset

建議選一種方式：

### 方式 A：GitHub PAT / HTTPS

1. 到 GitHub 建 Personal Access Token：
   - https://github.com/settings/tokens
2. 建議 scopes:
   - `repo`
   - `workflow`
3. 在本機設定：

```bash
git config --global user.name "<你的 GitHub 顯示名稱>"
git config --global user.email "<你的 GitHub email>"
git config --global credential.helper store
```

4. 第一次 push 時：
   - Username: GitHub username
   - Password: Personal Access Token，不是 GitHub 密碼

```bash
git push origin main
```

### 方式 B：SSH key

```bash
ssh-keygen -t ed25519 -C "<你的 GitHub email>" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

把 public key 加到：

- https://github.com/settings/keys

再設定 remote：

```bash
git remote set-url origin git@github.com:magicfon/congregation-management-system.git
ssh -T git@github.com
git push origin main
```

## Vercel Environment Variables

在 Vercel 專案設定：

- Project Settings → Environment Variables
- 建議 Production / Preview / Development 都先設定，或至少 Production 設定完整

必要：

- `NEXT_PUBLIC_SITE_URL`
  - Production 範例：`https://congregation-management-system.vercel.app`
  - 若有自訂網域，填自訂網域
  - 不要尾端 `/`

- `NEXT_PUBLIC_SUPABASE_URL`
  - Supabase Project Settings → API → Project URL

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Supabase Project Settings → API → anon public key
  - 目前 legacy/client helper 會用到

- `SUPABASE_SERVICE_KEY`
  - Supabase Project Settings → API → service_role key
  - 只可放 server env，不可公開、不可靠近 `NEXT_PUBLIC_`
  - 因之前曾 committed secrets，建議部署前 rotation

- `NEXTAUTH_URL`
  - Production public URL
  - 必須和實際登入網域一致
  - 範例：`https://congregation-management-system.vercel.app`

- `NEXTAUTH_SECRET`
  - 用下面指令產生：

```bash
openssl rand -base64 32
```

可選：

- `LINE_CLIENT_ID`
- `LINE_CLIENT_SECRET`
  - 只有啟用 LINE OAuth 時需要
  - LINE Developers Console callback URL 要包含：
    - `https://<your-domain>/api/auth/callback/line`

- `GOOGLE_SPREADSHEET_ID`
- `GOOGLE_SHEETS_CREDENTIALS`
  - 只有 `scripts/daily-sync.ts` 同步 Google Sheets 時需要
  - 一般 Vercel app runtime 不一定需要

## Supabase 準備

1. 確認 production Supabase project 已存在。
2. 確認資料表至少包含 app 使用中的 tables：
   - `members`
   - `areas`
   - `schedules`
   - `reports`
   - 以及 virtual boundary 相關表，依目前 migrations/sql
3. 套用 SQL / migrations：
   - `supabase/create_virtual_boundaries.sql`
   - `supabase/virtual_boundaries.sql`
   - `supabase/migrations/20260322_virtual_boundary_unique.sql`
4. Rotation：
   - 因舊版曾將 Supabase key commit 到 repo，建議到 Supabase 後台 rotate keys。
   - rotation 後同步更新 Vercel env。
5. 確認至少有一個 admin member。
6. 確認 `members.password` 已是 bcrypt hash，不是明文。

## Vercel 專案設定

目前 `vercel.json`：

```json
{
  "framework": "nextjs",
  "regions": ["hnd1"]
}
```

建議保留：

- Framework Preset: Next.js
- Region: Tokyo / `hnd1`
- Build Command: 預設 `next build` 或 `npm run build`
- Install Command: 預設 `npm install`

## 部署前本機驗證

已跑過並通過：

```bash
npm run check:regression
npm run lint
npm run build
```

若 deployment 前有新改動，再跑一次。

## 建議部署順序

1. 設定 GitHub auth。
2. Push local commits 到 `main` 或新分支開 PR。
3. 在 Vercel import / reconnect GitHub repo。
4. 設定 Vercel env vars。
5. 在 Supabase rotate service role / anon key，並更新 Vercel env。
6. Trigger Vercel deployment。
7. 測試：
   - 未登入訪問 `/dashboard` 會導向 `/login`
   - `/api/test-supabase` 回 404
   - `/api/simple-login` 回 410
   - 未登入不能寫入 members/areas/schedules/reports
   - admin 可登入並操作 members
   - elder 可操作 areas/schedules/reports 審核
   - publisher 只能做允許的回報/讀取操作

## 部署後待辦

- 修 dashboard server-side stats 取法，讓 `/api/statistics` 也能鎖 session。
- UI 依角色隱藏不該顯示的新增/刪除/審核按鈕。
- 清理或重設舊明文密碼資料。
- 補 production smoke test script。
