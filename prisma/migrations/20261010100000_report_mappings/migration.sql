CREATE TYPE "MappingKind" AS ENUM ('disease', 'procedure');

CREATE TABLE "ReportMapping" (
  "id" TEXT NOT NULL,
  "kind" "MappingKind" NOT NULL,
  "rawName" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "groupName" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ReportMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportMapping_kind_rawName_key" ON "ReportMapping"("kind", "rawName");
CREATE INDEX "ReportMapping_kind_idx" ON "ReportMapping"("kind");
CREATE INDEX "ReportMapping_deletedAt_idx" ON "ReportMapping"("deletedAt");

-- This table is server-only. Supabase's Data API roles must never read it.
REVOKE ALL ON TABLE "ReportMapping" FROM PUBLIC;
DO $$
DECLARE role_name TEXT;
BEGIN
  FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
    EXECUTE format('REVOKE ALL ON TABLE "ReportMapping" FROM %I', role_name);
  END LOOP;
END $$;
