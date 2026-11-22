CREATE TABLE IF NOT EXISTS "line_ai_messages" (
  "id" TEXT PRIMARY KEY,
  "uid" TEXT NOT NULL,
  "memberId" TEXT,
  "role" TEXT NOT NULL CHECK ("role" IN ('user', 'assistant')),
  "model" TEXT,
  "content" TEXT NOT NULL,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "cacheReadTokens" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "line_ai_messages_uid_createdAt_idx" ON "line_ai_messages" ("uid", "createdAt");
