ALTER TABLE "areas" ADD COLUMN IF NOT EXISTS "returnUndo" JSONB;
CREATE TABLE IF NOT EXISTS "report_alerts" (
  "id" TEXT PRIMARY KEY,
  "areaId" TEXT NOT NULL REFERENCES "areas"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('not_holder', 'not_holder_returned', 'held_after_report', 'return_basis_removed', 'sheet_holder_mismatch')),
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'resolved')),
  "cycleKey" TEXT NOT NULL,
  "reportId" TEXT,
  "details" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolution" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "report_alerts_areaId_kind_cycleKey_key" ON "report_alerts" ("areaId", "kind", "cycleKey");
CREATE INDEX IF NOT EXISTS "report_alerts_status_createdAt_idx" ON "report_alerts" ("status", "createdAt");
