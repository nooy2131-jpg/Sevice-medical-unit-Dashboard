import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { prisma } from './db';
import { consumeInvitationForOAuth, normalizeEmail, sendPasswordResetEmail } from './invitations';

const appUrl = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:40000';
const configuredSecret = process.env.BETTER_AUTH_SECRET;
if (process.env.NODE_ENV === 'production' && (!configuredSecret || configuredSecret.length < 32)) {
  throw new Error('BETTER_AUTH_SECRET must be configured with at least 32 characters in production.');
}
const betterAuthSecret = configuredSecret ?? 'local-development-secret-change-before-production';
const trustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? appUrl)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const auth = betterAuth({
  appName: 'Ongkharak Medical Unit Dashboard',
  baseURL: appUrl,
  basePath: '/api/auth',
  secret: betterAuthSecret,
  trustedOrigins,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      const member = await prisma.user.findUnique({ where: { id: user.id }, select: { active: true } });
      if (!member?.active) return;
      await sendPasswordResetEmail(user.email, url);
    },
    revokeSessionsOnPasswordReset: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      accessType: 'offline',
      prompt: 'select_account',
    },
  },
  user: {
    additionalFields: {
      role: { type: 'string', required: false, defaultValue: 'member', input: false },
      active: { type: 'boolean', required: false, defaultValue: false, input: false },
    },
    validateUserInfo: async ({ user, source }) => {
      const email = typeof user.email === 'string' ? normalizeEmail(user.email) : '';
      if (!email) return { error: 'email_required', errorDescription: 'A verified email address is required.' };
      const isGoogle = source.method === 'oauth' && source.oauth?.providerId === 'google';
      if (isGoogle && source.oauth?.profile?.email_verified !== true) {
        return { error: 'email_not_verified', errorDescription: 'Google must verify this email address.' };
      }
      const existing = await prisma.user.findUnique({ where: { email }, select: { active: true } });
      if (existing?.active) return;
      if (!isGoogle) {
        return { error: 'invitation_required', errorDescription: 'An invitation is required.' };
      }
      const invitation = await findUsableInvitationForEmail(email);
      if (!invitation) return { error: 'invitation_required', errorDescription: 'An invitation is required.' };
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await consumeInvitationForOAuth(user.email, user.id);
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { active: true } });
          return user?.active === true;
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },
  advanced: {
    useSecureCookies: appUrl.startsWith('https://'),
    disableCSRFCheck: false,
  },
  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: 30,
    customRules: {
      '/sign-in/email': { window: 60, max: 10 },
      '/request-password-reset': { window: 60, max: 5 },
    },
  },
  plugins: [nextCookies()],
});

async function findUsableInvitationForEmail(email: string) {
  return prisma.invitation.findFirst({
    where: { email, consumedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
}
