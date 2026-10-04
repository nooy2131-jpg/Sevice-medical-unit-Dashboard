-- Preserve report identities and monotonically increasing versions after Admin deletion.
ALTER TABLE "DailyReport" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "DailyReport_deletedAt_idx" ON "DailyReport"("deletedAt");

-- Draft revision is a private autosave CAS counter. expectedVersion remains the
-- published report version the draft was based on.
ALTER TABLE "Draft" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
