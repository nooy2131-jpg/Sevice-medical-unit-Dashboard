import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { Pool } from 'pg';

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@example.test';
const memberEmail = process.env.E2E_MEMBER_EMAIL ?? 'e2e-member@example.test';
const password = process.env.E2E_PASSWORD ?? 'correct-horse-battery-staple';

export default async function globalSetup(): Promise<void> {
  if (process.env.OKR_E2E !== '1') {
    throw new Error('Playwright requires OKR_E2E=1 against an isolated local database.');
  }
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!/(?:localhost|127\.0\.0\.1)/.test(databaseUrl)) {
    throw new Error('Playwright database must be local.');
  }
  const pool = new Pool({ connectionString: databaseUrl });
  const adminId = randomUUID();
  const memberId = randomUUID();
  const passwordHash = await hashPassword(password);
  try {
    await pool.query('BEGIN');
    const users = await pool.query<{ id: string }>(
      'SELECT "id" FROM "User" WHERE "email" = ANY($1::text[])',
      [[adminEmail, memberEmail]],
    );
    const ids = users.rows.map((row) => row.id);
    if (ids.length > 0) {
      await pool.query('DELETE FROM "AuditLog" WHERE "actorId" = ANY($1::text[])', [ids]);
      await pool.query('DELETE FROM "Invitation" WHERE "createdById" = ANY($1::text[])', [ids]);
      await pool.query('DELETE FROM "DailyReport" WHERE "createdById" = ANY($1::text[]) OR "updatedById" = ANY($1::text[])', [ids]);
      await pool.query('DELETE FROM "User" WHERE "id" = ANY($1::text[])', [ids]);
    }
    await pool.query(
      'INSERT INTO "User" ("id", "name", "email", "emailVerified", "role", "active") VALUES ($1, $2, $3, true, \'admin\', true), ($4, $5, $6, true, \'member\', true)',
      [adminId, 'E2E Admin', adminEmail, memberId, 'E2E Member', memberEmail],
    );
    await pool.query(
      'INSERT INTO "Account" ("id", "accountId", "providerId", "userId", "password") VALUES ($1, $2, \'credential\', $2, $4), ($3, $5, \'credential\', $5, $4)',
      [randomUUID(), adminId, randomUUID(), passwordHash, memberId],
    );
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  } finally {
    await pool.end();
  }
}

export { adminEmail, memberEmail, password };
