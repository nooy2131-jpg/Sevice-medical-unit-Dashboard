import { Role } from '../src/generated/prisma/client';
import { disconnectDb, prisma } from '../src/lib/db';

const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();

if (!email || !name) {
  throw new Error('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_NAME must be non-empty.');
}

const user = await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('medical-unit-active-admins'))`;
  const existing = await tx.user.findUnique({ where: { email } });
  if (existing?.role === Role.admin && existing.active && existing.emailVerified) return existing;
  const activeAdmin = await tx.user.findFirst({ where: { role: Role.admin, active: true } });
  if (activeAdmin) throw new Error('An active Admin already exists; refusing to create or change the bootstrap account.');
  const result = existing
    ? await tx.user.update({ where: { id: existing.id }, data: { role: Role.admin, active: true, emailVerified: true, name } })
    : await tx.user.create({ data: { email, name, role: Role.admin, active: true, emailVerified: true } });
  await tx.auditLog.create({ data: { actorId: result.id, action: 'admin.bootstrap', entityId: result.id, data: { email } } });
  return result;
});

console.log(`Bootstrap Admin ready: ${user.email} (${user.id})`);
await disconnectDb();
