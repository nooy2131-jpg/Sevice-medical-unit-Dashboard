-- These tables are server-only. Supabase's Data API roles must never read them.
REVOKE ALL ON TABLE "User", "Session", "Account", "Verification", "Invitation", "DailyReport", "Draft", "AuditLog" FROM PUBLIC;
DO $$
DECLARE role_name TEXT;
BEGIN
  FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
    EXECUTE format('REVOKE ALL ON TABLE "User", "Session", "Account", "Verification", "Invitation", "DailyReport", "Draft", "AuditLog" FROM %I', role_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', role_name);
  END LOOP;
END $$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
