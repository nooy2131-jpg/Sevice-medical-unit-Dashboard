import { Role } from '../src/generated/prisma/client';
import { prisma } from '../src/lib/db';

const email = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'pongsakorn.wera@gmail.com').trim().toLowerCase();
const name = (process.env.BOOTSTRAP_ADMIN_NAME ?? 'Pongsakorn Wera').trim();

if (!email || !name) {
  throw new Error('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_NAME must be non-empty.');
}

const user = await prisma.$transaction(async (tx) => {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('medical-unit-active-admins'))`;
  const existing = await tx.user.findUnique({ where: { email } });
  if (existing?.role === Role.admin && existing.active && existing.emailVerified && existing.name === name) return existing;
  if (existing) {
    const otherAdmin = await tx.user.count({ where: { role: Role.admin, active: true, id: { not: existing.id } } });
    if (otherAdmin > 0) throw new Error('Another active Admin exists; refusing to change the bootstrap account.');
  }
  const result = existing
    ? await tx.user.update({ where: { id: existing.id }, data: { role: Role.admin, active: true, emailVerified: true, name } })
    : await tx.user.create({ data: { email, name, role: Role.admin, active: true, emailVerified: true } });
  await tx.auditLog.create({ data: { actorId: result.id, action: 'admin.bootstrap', entityId: result.id, data: { email } } });
  return result;
});

console.log(`Bootstrap Admin ready: ${user.email} (${user.id})`);
await prisma.$disconnect();
