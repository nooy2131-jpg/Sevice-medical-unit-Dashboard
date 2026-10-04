import { createHash, randomBytes } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { Role, Prisma } from '@/src/generated/prisma/client';
import { prisma } from './db';

const INVITATION_HOURS = Number(process.env.INVITATION_EXPIRES_HOURS ?? '72');
const APP_URL = (process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:40000').replace(/\/$/, '');

export type InvitationRole = 'admin' | 'member';

export class InvitationError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'InvitationError';
    this.code = code;
    this.status = status;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function expiryDate(): Date {
  const hours = Number.isFinite(INVITATION_HOURS) && INVITATION_HOURS > 0 ? INVITATION_HOURS : 72;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export function serializeInvitation(invitation: {
  id: string;
  email: string;
  role: Role;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt.toISOString(),
    consumedAt: invitation.consumedAt?.toISOString() ?? null,
    revokedAt: invitation.revokedAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString(),
  };
}

async function sendMail(to: string, subject: string, html: string): Promise<'sent' | 'skipped'> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    if (process.env.NODE_ENV === 'production') {
      throw new InvitationError('email_not_configured', 'Invitation email is not configured.', 503);
    }
    return 'skipped';
  }
  const { Resend } = await import('resend');
  const result = await new Resend(apiKey).emails.send({ from, to, subject, html });
  if (result.error) {
    throw new InvitationError('email_failed', 'Could not deliver the email.', 502);
  }
  return 'sent';
}

export async function sendInvitationEmail(email: string, token: string, role: Role): Promise<'sent' | 'skipped'> {
  const url = `${APP_URL}/invite?token=${encodeURIComponent(token)}`;
  return sendMail(
    email,
    'คำเชิญเข้าใช้งานระบบรายงานหน่วยบริการ',
    `<p>คุณได้รับคำเชิญให้เข้าใช้งานระบบรายงานหน่วยบริการ (สิทธิ์ ${role === Role.admin ? 'Admin' : 'Member'})</p><p><a href="${url}">ตั้งค่าบัญชีและเข้าร่วมระบบ</a></p><p>ลิงก์นี้ใช้ได้ครั้งเดียวและหมดอายุใน ${INVITATION_HOURS} ชั่วโมง</p>`,
  );
}

export async function sendPasswordResetEmail(email: string, url: string): Promise<'sent' | 'skipped'> {
  return sendMail(
    email,
    'รีเซ็ตรหัสผ่านระบบรายงานหน่วยบริการ',
    `<p>มีการขอรีเซ็ตรหัสผ่านสำหรับบัญชีนี้</p><p><a href="${url}">ตั้งรหัสผ่านใหม่</a></p><p>หากคุณไม่ได้เป็นผู้ร้องขอ ให้ละเว้นอีเมลนี้</p>`,
  );
}

export async function createInvitation(input: { email: string; role: InvitationRole; createdById: string }) {
  const email = normalizeEmail(input.email);
  const role = input.role === 'admin' ? Role.admin : Role.member;
  const token = createInvitationToken();
  const invitation = await prisma.$transaction(async (tx) => {
    await tx.invitation.updateMany({
      where: { email, consumedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return tx.invitation.create({
      data: {
        email,
        role,
        tokenHash: hashInvitationToken(token),
        expiresAt: expiryDate(),
        createdById: input.createdById,
      },
    });
  });
  const delivery = await sendInvitationEmail(email, token, role);
  return { invitation, token, delivery };
}

export async function findUsableInvitationByToken(token: string) {
  if (!token || token.length < 32) return null;
  const invitation = await prisma.invitation.findUnique({ where: { tokenHash: hashInvitationToken(token) } });
  if (!invitation || invitation.consumedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) return null;
  return invitation;
}

export async function revokeInvitation(id: string): Promise<void> {
  await prisma.invitation.updateMany({
    where: { id, consumedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function acceptInvitation(input: { token: string; password: string; name: string }) {
  const tokenHash = hashInvitationToken(input.token);
  const passwordHash = await hashPassword(input.password);
  const result = await prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({ where: { tokenHash } });
    if (!invitation || invitation.consumedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) {
      throw new InvitationError('invalid_invitation', 'This invitation is invalid or expired.', 410);
    }
    const claimed = await tx.invitation.updateMany({
      where: { id: invitation.id, consumedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new InvitationError('invitation_used', 'This invitation has already been used.', 409);
    }
    const existing = await tx.user.findUnique({ where: { email: invitation.email } });
    if (existing?.active) {
      throw new InvitationError('account_exists', 'An active account already exists for this email.', 409);
    }
    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: { name: input.name.trim(), role: invitation.role, active: true, emailVerified: true },
        })
      : await tx.user.create({
          data: {
            name: input.name.trim(),
            email: invitation.email,
            emailVerified: true,
            active: true,
            role: invitation.role,
          },
        });
    await tx.account.upsert({
      where: { providerId_accountId: { providerId: 'credential', accountId: user.id } },
      create: { accountId: user.id, providerId: 'credential', userId: user.id, password: passwordHash },
      update: { password: passwordHash },
    });
    await tx.auditLog.create({
      data: { actorId: user.id, action: 'invitation.accepted', entityId: invitation.id, data: { role: invitation.role } },
    });
    return user;
  });
  return result;
}

export async function consumeInvitationForOAuth(email: string, userId: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  await prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.findFirst({
      where: { email: normalizedEmail, consumedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'asc' },
    });
    if (!invitation) {
      await tx.user.update({ where: { id: userId }, data: { active: false } });
      return;
    }
    const claimed = await tx.invitation.updateMany({
      where: { id: invitation.id, consumedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== 1) {
      await tx.user.update({ where: { id: userId }, data: { active: false } });
      return;
    }
    await tx.user.update({ where: { id: userId }, data: { role: invitation.role, active: true, emailVerified: true } });
    await tx.auditLog.create({
      data: { actorId: userId, action: 'invitation.accepted.google', entityId: invitation.id, data: { role: invitation.role } },
    });
  });
}

export function isPrismaUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
