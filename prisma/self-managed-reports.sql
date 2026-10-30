-- 自主管理地圖（ADR-0101）：欄位第一次建立時預設開給曾湖，之後由成員頁調整
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'selfManagedReports') THEN
    ALTER TABLE "members" ADD COLUMN "selfManagedReports" BOOLEAN NOT NULL DEFAULT false;
    UPDATE "members" SET "selfManagedReports" = true WHERE "name" = '曾湖' AND "deletedAt" IS NULL;
  END IF;
END $$;
