CREATE TABLE IF NOT EXISTS "bulletin_announcements" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  "size" INTEGER NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "bulletin_announcements_removedAt_createdAt_idx" ON "bulletin_announcements"("removedAt", "createdAt");
