# Claude 專案入口

此專案共用的協作規則以 [AGENTS.md](AGENTS.md) 為準，開始工作前完整閱讀並遵守；接著依該檔順序讀取領域詞彙與架構決策。

首次接手或更換工作環境時，閱讀 [Claude Desktop 交接](docs/claude-desktop-handoff.md)，完成其中的環境確認後回報結果。

新增功能前，依 `.agents/skills/grill-with-docs/SKILL.md` 與使用者確認操作流程，更新 CONTEXT.md 並記錄 ADR 後實作。若該流程引用的技能在目前環境不可用，先讀取專案內可用指引，列明缺少的技能；仍須完成需求問答與決策記錄。

README.md 含早期規劃與過時的 SQLite／初始化說明；現況請依 AGENTS.md、CONTEXT.md、相關最新 ADR、package.json 及 prisma/schema.prisma 確認。
