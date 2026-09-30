ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "lineNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS "line_notifications" (
 "id" TEXT PRIMARY KEY, "memberId" TEXT NOT NULL, "lineUid" TEXT NOT NULL,
 "text" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending', "attempts" INTEGER NOT NULL DEFAULT 0,
 "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL,
 "lastError" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "acceptedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "line_notifications_status_nextAttemptAt_idx" ON "line_notifications"("status", "nextAttemptAt");
