# OKR Unit Dashboard

The application is a Next.js standalone server. Reports are private to authenticated users; Members can view, create, edit, and export reports. Admins can import and delete reports. Drafts are private per user and date, and explicit Save uses an atomic version check.

Reporting dates are calendar dates (`YYYY-MM-DD`) interpreted in `Asia/Bangkok`. Timestamps are UTC. Total male and female counts remain independent from category counts.

## Local development

Use the repository's Bun scripts after configuring the local database and Better Auth variables from `.env.example`:

```sh
bun install --frozen-lockfile
bun run db:generate
bun run db:migrate
bun run dev
```

The intended local callback origin is `http://localhost:40000`.

Register Google redirect URIs `http://localhost:40000/api/auth/callback/google` and `https://okr-unit.pskwr.com/api/auth/callback/google`. Configure the corresponding `BETTER_AUTH_URL` in each environment. Store database, Better Auth, Google, and Resend secrets server-side; do not use credentials that have been exposed in chat.

Run `bun run bootstrap-admin` once after migrations to initialize the configured Admin. The operation does not create a password. The bootstrap Admin can sign in with Google or use the password-reset flow with Resend configured to set a password.

## Verification

Run `bun run lint`, `bun run typecheck`, `bun run test`, and `bun run build` after generating Prisma Client. Database integration tests require an isolated local PostgreSQL database, `OKR_AUTH_TESTS=1`, and `OKR_RUN_DB_TESTS=1`. Never point test fixtures at production. CI provisions its own PostgreSQL service and runs migrations before testing.

Browser workflows are defined in `e2e/` and run separately with `bun run test:e2e`. They were not executed during this implementation because browser access was denied. Google OAuth and Resend delivery also need validation with configured test credentials before production promotion.

## Deployment

Follow [the production release runbook](deploy/README.md). Argo CD in the homelab GitOps repository owns cluster state; do not apply deployment manifests directly with `kubectl`.
