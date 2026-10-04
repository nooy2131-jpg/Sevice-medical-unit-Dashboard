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

Build and push immutable app and migration image digests (`docker build --target runner ...` and `docker build --target migrate ...`). Replace `REPLACE_WITH_DIGEST` and `REPLACE_WITH_MIGRATION_DIGEST` in the `@sha256:` image references only through the GitOps review process. Inject runtime variables through the cluster's Infisical-managed `okr-unit-runtime` Secret and use a separate least-privilege migration credential in `okr-unit-migration`.

Run the migration Job deliberately after replacing the image digest and reviewing database compatibility. Select the intended cluster and namespace explicitly:

```sh
KUBECONFIG="$HOME/.kube/hp01.yaml" kubectl -n okr-unit apply -f deploy/base/migration-job.yaml
```

The normal app container does not run migrations or bootstrap an Admin. Configure the Cloudflare tunnel to route `okr-unit.pskwr.com` to the Service and register the Google callback `https://okr-unit.pskwr.com/api/auth/callback/google`. An ArgoCD application registration belongs in the GitOps repository; this repository only supplies the base and production overlay.

Use the Supabase session pooler if the cluster has no IPv6 route to the direct database endpoint. Configure verified PostgreSQL TLS and a trusted CA where required. Provision a restricted runtime database role separately from the migration role; grant runtime access only to application tables. The migrations revoke Supabase anonymous/authenticated Data API access to these server-only tables.

Before promotion, confirm the image architecture matches the selected node or publish a multi-architecture image, configure registry access and Infisical project paths, verify sender-domain ownership in Resend, and establish a database backup/restore procedure. Keep the previous app digest and assess schema compatibility before rollback; an image rollback does not undo migrations.
