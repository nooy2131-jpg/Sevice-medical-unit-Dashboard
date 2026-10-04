import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Role } from '@/src/generated/prisma/client';
import { prisma } from '@/src/lib/db';
import { acceptInvitation, createInvitation, findUsableInvitationByToken, InvitationError, revokeInvitation } from '@/src/lib/invitations';
import { updateUserMembership } from '@/src/lib/authorization';
import { auth } from '@/src/lib/auth';

const canUseDatabase = Boolean(process.env.DATABASE_URL) && process.env.OKR_AUTH_TESTS === '1' && /(?:localhost|127\.0\.0\.1)/.test(process.env.DATABASE_URL ?? '');

if (!canUseDatabase) {
  test.skip('auth integration tests require an isolated local database and OKR_AUTH_TESTS=1', () => undefined);
} else {
  describe('invitation admission', () => {
    let adminId = '';
    const createdEmails: string[] = [];

    beforeAll(async () => {
      const admin = await prisma.user.create({
        data: { email: `auth-test-admin-${crypto.randomUUID()}@example.com`, name: 'Auth Test Admin', role: Role.admin, active: true, emailVerified: true },
      });
      adminId = admin.id;
      createdEmails.push(admin.email);
    });

    afterAll(async () => {
      const users = await prisma.user.findMany({ where: { email: { in: createdEmails } }, select: { id: true } });
      const ids = users.map((user) => user.id);
      await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
      await prisma.invitation.deleteMany({ where: { createdById: { in: ids } } });
      await prisma.account.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    });

    test('claims an invitation once and creates a credential account', async () => {
      const email = `auth-test-member-${crypto.randomUUID()}@example.com`;
      createdEmails.push(email);
      const invitation = await createInvitation({ email, role: 'member', createdById: adminId });
      const user = await acceptInvitation({ token: invitation.token, password: 'correct-horse-battery-staple', name: 'Auth Test Member' });
      expect(user.email).toBe(email);
      expect(user.active).toBe(true);
      expect(await prisma.account.findUnique({ where: { providerId_accountId: { providerId: 'credential', accountId: user.id } } })).not.toBeNull();

      const loginResponse = await auth.handler(new Request('http://localhost:40000/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:40000' },
        body: JSON.stringify({ email, password: 'correct-horse-battery-staple', callbackURL: '/' }),
      }));
      expect(loginResponse.status).toBe(200);
      const loginPayload = await loginResponse.json() as { user?: { email?: string } };
      expect(loginPayload.user?.email).toBe(email);

      await expect(acceptInvitation({ token: invitation.token, password: 'correct-horse-battery-staple', name: 'Replay' })).rejects.toBeInstanceOf(InvitationError);
    });

    test('revoked invitations cannot be inspected or accepted', async () => {
      const email = `auth-test-revoked-${crypto.randomUUID()}@example.com`;
      createdEmails.push(email);
      const invitation = await createInvitation({ email, role: 'member', createdById: adminId });
      await revokeInvitation(invitation.invitation.id);
      expect(await findUsableInvitationByToken(invitation.token)).toBeNull();
    });
  });

  describe('last-admin invariant', () => {
    let adminId = '';
    let secondAdminId = '';
    afterAll(async () => {
      await prisma.auditLog.deleteMany({ where: { actorId: { in: [adminId, secondAdminId] } } });
      await prisma.user.deleteMany({ where: { id: { in: [adminId, secondAdminId] } } });
    });

    test('preserves one active admin under concurrent disable attempts', async () => {
      const existingAdmins = await prisma.user.count({ where: { role: Role.admin, active: true } });
      if (existingAdmins > 0) {
        throw new Error(`last-admin test requires an isolated database; found ${existingAdmins} active Admin account(s)`);
      }
      const first = await prisma.user.create({ data: { email: `auth-test-last-${crypto.randomUUID()}@example.com`, name: 'Last Admin', role: Role.admin, active: true, emailVerified: true } });
      const second = await prisma.user.create({ data: { email: `auth-test-second-${crypto.randomUUID()}@example.com`, name: 'Second Admin', role: Role.admin, active: true, emailVerified: true } });
      adminId = first.id;
      secondAdminId = second.id;
      const firstActor = { id: first.id, email: first.email, name: first.name, role: 'admin' as const };
      const secondActor = { id: second.id, email: second.email, name: second.name, role: 'admin' as const };
      const results = await Promise.allSettled([
        updateUserMembership(firstActor, second.id, { active: false }),
        updateUserMembership(secondActor, first.id, { active: false }),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      expect(await prisma.user.count({ where: { role: Role.admin, active: true } })).toBe(1);
    });
  });
}

afterAll(async () => {
  await prisma.$disconnect();
});
