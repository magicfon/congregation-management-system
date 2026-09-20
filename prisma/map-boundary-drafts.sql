CREATE TABLE IF NOT EXISTS "map_boundary_drafts" (
  "mapId" TEXT PRIMARY KEY,
  "document" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedBy" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "map_boundary_drafts_version_positive" CHECK ("version" > 0)
);
