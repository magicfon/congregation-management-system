ALTER TABLE "areas" ADD COLUMN IF NOT EXISTS "doNotVisit" TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS "do_not_visit_reports" (
  "id" TEXT PRIMARY KEY,
  "areaId" TEXT NOT NULL REFERENCES "areas"("id") ON DELETE CASCADE,
  "address" TEXT NOT NULL,
  "reporterName" TEXT NOT NULL,
  "memberId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'approved', 'rejected')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT
);
CREATE INDEX IF NOT EXISTS "do_not_visit_reports_status_createdAt_idx" ON "do_not_visit_reports" ("status", "createdAt");
