ALTER TABLE "areas" ADD COLUMN IF NOT EXISTS "ministryRevision" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS "ministry_visits" (
 "id" TEXT PRIMARY KEY, "areaId" TEXT NOT NULL REFERENCES "areas"("id") ON DELETE CASCADE,
 "cycleKey" TEXT NOT NULL, "managerId" TEXT NOT NULL, "publisherId" TEXT NOT NULL REFERENCES "members"("id") ON DELETE RESTRICT,
 "publisherName" TEXT NOT NULL, "scheduledDate" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'planned',
 "strokes" JSONB NOT NULL DEFAULT '[]', "note" TEXT NOT NULL DEFAULT '',
 "startedAt" TIMESTAMP(3), "submittedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ministry_visit_status" CHECK ("status" IN ('planned','active','submitted','cancelled'))
);
CREATE INDEX IF NOT EXISTS "ministry_visits_area_cycle_date" ON "ministry_visits"("areaId","cycleKey","scheduledDate");
CREATE INDEX IF NOT EXISTS "ministry_visits_publisher_status" ON "ministry_visits"("publisherId","status");
CREATE UNIQUE INDEX IF NOT EXISTS "ministry_one_active" ON "ministry_visits"("areaId","cycleKey") WHERE "status" = 'active';
