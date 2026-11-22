# ADR-0143：LINE 自由文字由 AI 回答

## 狀態
已採用（2026-11-20）

## 背景
使用者要求 LINE 官方帳號加入 LLM 功能，用獨立的知識庫回答會眾系統的功能介紹、操作方式，以及委派安排。原本除了固定指令，其他文字只回一段固定說明。

## 決定
- 模型由使用者指定用智譜 GLM（Z.ai 國際站）（OpenAI 相容 chat completions，預設 `glm-5.3`、`reasoning_effort: low`）。金鑰 `GLM_API_KEY`，可用 `GLM_MODEL` 換模型、`GLM_BASE_URL` 換端點（使用者選國際站，預設 `https://api.z.ai/api/paas/v4`；中國站為 `https://open.bigmodel.cn/api/paas/v4`）。只設在 Vercel Production。
- 固定指令（「我的委派」「我的地圖」「選單」、管理員的「通知單樣式」、加好友事件、通知單「收到」按鈕）照舊，不經過 AI。
- 其他文字，若提問者的 LINE 已連結啟用中的成員，交給 GLM 回答；未連結的 LINE 照舊登記待確認並回固定說明，不呼叫 AI。
- 知識庫獨立放在 `docs/line-agent-knowledge/*.md`，寫給會眾看的使用說明，不含程式細節或金鑰。資料量小（約 1 萬字），整份放在固定的 system 前綴，靠 GLM 的前綴快取省費用，不做向量檢索；超過約 20 萬字再改 pgvector。
- 使用者選擇資料範圍含全會眾已公布資料：上週起 6 週的服務安排與已發布週中節目、目前誰持有哪些地圖（與網站登入成員看得到的內容相同）。另附提問者本人的委派、持有地圖與待審領圖申請。資料都由伺服器先查好放進提問，模型沒有查詢工具；不送聯絡方式、LINE 資料、別人的申請。
- 記住同一人 6 小時內最近 5 問 5 答供追問，存 `line_ai_messages` 表，同時記錄模型與 token 用量。
- 每人每天（台北日）最多 20 題，超過回覆明天再問；固定指令不受限。
- LINE webhook 須 2 秒內回應：先顯示輸入中動畫、立即回 200，AI 在背景（`waitUntil`）完成後用 reply token 回覆，失效時改 push。失敗時回「暫時無法回答」。
- 未設定 `GLM_API_KEY` 時行為與原本相同。

## 影響
- 新功能若改變成員的操作方式，要一起更新 `docs/line-agent-knowledge/`。
- 成員姓名與委派會送到智譜 Z.ai 國際站處理。
- 費用依智譜 API 用量計費，可在 `line_ai_messages` 查 token 數。
