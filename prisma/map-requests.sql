CREATE TABLE IF NOT EXISTS "map_requests" (
  "id" TEXT PRIMARY KEY,
  "batchId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL REFERENCES "members"("id") ON DELETE CASCADE,
  "areaId" TEXT NOT NULL REFERENCES "areas"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'approved', 'rejected', 'cancelled')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT
);
CREATE INDEX IF NOT EXISTS "map_requests_memberId_status_idx" ON "map_requests" ("memberId", "status");
CREATE INDEX IF NOT EXISTS "map_requests_status_createdAt_idx" ON "map_requests" ("status", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "map_requests_member_area_pending" ON "map_requests" ("memberId", "areaId") WHERE "status" = 'pending';
