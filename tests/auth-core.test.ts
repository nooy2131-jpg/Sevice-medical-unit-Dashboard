import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Role } from '@/src/generated/prisma/client';
import { prisma } from '@/src/lib/db';
import { acceptInvitation, createInvitation, findUsableInvitationByToken, InvitationError, revokeInvitation } from '@/src/lib/invitations';
import { updateUserMembership } from '@/src/lib/authorization';

const canUseDatabase = Boolean(process.env.DATABASE_URL);

if (!canUseDatabase) {
  test.skip('auth integration tests require DATABASE_URL', () => undefined);
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

    test('refuses disabling the only active admin', async () => {
      const existingAdmins = await prisma.user.count({ where: { role: Role.admin, active: true } });
      if (existingAdmins > 0) {
        console.log('skipping isolated last-admin test because the database already has an active Admin');
        return;
      }
      const first = await prisma.user.create({ data: { email: `auth-test-last-${crypto.randomUUID()}@example.com`, name: 'Last Admin', role: Role.admin, active: true, emailVerified: true } });
      const second = await prisma.user.create({ data: { email: `auth-test-second-${crypto.randomUUID()}@example.com`, name: 'Second Admin', role: Role.admin, active: true, emailVerified: true } });
      adminId = first.id;
      secondAdminId = second.id;
      const actor = { id: first.id, email: first.email, name: first.name, role: 'admin' as const };
      await updateUserMembership(actor, second.id, { active: false });
      await expect(updateUserMembership(actor, first.id, { active: false })).rejects.toMatchObject({ code: 'last_admin', status: 409 });
    });
  });
}

afterAll(async () => {
  await prisma.$disconnect();
});
