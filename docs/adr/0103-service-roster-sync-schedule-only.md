# ADR-0103: 服務安排只同步 Schedule

日期：2026-10-31
狀態：已接受

使用者認為服務安排同步看 Schedule 就好。History 改為 Sheet 上的存檔，同步不再讀取也不再寫入；取代 ADR-0045 中 Schedule 與 History 都同步、兩者同週分歧要管理員選擇的規定。

同步比對的週次只有 Schedule 現有的週，加上本站本週起尚未結束的週（本站新增的未來週照舊補進 Schedule）。已移出 Schedule 的過去週視為存檔，不列「Google 週次已移除」衝突，本站資料照舊保留。仍在 Schedule 範圍內、被人從 Sheet 刪掉的週照舊列衝突。

起因是 History 有同一週兩列，讓整個同步檢查停下；History 由人工整理，格式與重複不再影響同步。History 之後不會自動更新。首次匯入（ADR-0039）不受影響。
