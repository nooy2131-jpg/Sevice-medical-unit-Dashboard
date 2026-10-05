import { headers } from 'next/headers';
import { Role } from '@/src/generated/prisma/client';
import { auth } from './auth';
import { prisma } from './db';

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
};

export class AuthError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
  }
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new AuthError('unauthenticated', 'Authentication is required.', 401);
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.active) {
    throw new AuthError('inactive_account', 'This account is inactive.', 403);
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role === Role.admin ? 'admin' : 'member',
  };
}

export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await requireUser();
  if (user.role !== 'admin') {
    throw new AuthError('forbidden', 'Admin access is required.', 403);
  }
  return user;
}

export type MembershipPatch = { role?: 'admin' | 'member'; active?: boolean };

export async function updateUserMembership(actor: AuthenticatedUser, userId: string, patch: MembershipPatch) {
  if (actor.role !== 'admin') throw new AuthError('forbidden', 'Admin access is required.', 403);
  if (!patch.role && patch.active === undefined) {
    throw new AuthError('invalid_patch', 'A role or active status is required.', 400);
  }
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('medical-unit-active-admins'))`;
    const currentActor = await tx.user.findUnique({ where: { id: actor.id }, select: { role: true, active: true } });
    if (!currentActor || !currentActor.active || currentActor.role !== Role.admin) {
      throw new AuthError('forbidden', 'Admin access is required.', 403);
    }
    const target = await tx.user.findUnique({ where: { id: userId } });
    if (!target) throw new AuthError('not_found', 'User not found.', 404);
    const nextRole = patch.role ? (patch.role === 'admin' ? Role.admin : Role.member) : target.role;
    const nextActive = patch.active === undefined ? target.active : patch.active;
    if (target.role === Role.admin && target.active && (nextRole !== Role.admin || !nextActive)) {
      const activeAdminCount = await tx.user.count({ where: { role: Role.admin, active: true } });
      if (activeAdminCount <= 1) {
        throw new AuthError('last_admin', 'The last active Admin cannot be disabled or demoted.', 409);
      }
    }
    const user = await tx.user.update({
      where: { id: userId },
      data: { role: nextRole, active: nextActive },
    });
    if (!nextActive) {
      await tx.invitation.updateMany({
        where: { email: target.email, consumedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'user.membership.updated',
        entityId: user.id,
        data: { role: nextRole, active: nextActive },
      },
    });
    return user;
  });
}
