# OKR Unit Dashboard

The application is a Next.js standalone server. Reports are private to authenticated users; Members can view, create, edit, and export reports. Admins can import and delete reports. Drafts are private per user and date, and explicit Save uses an atomic version check.

Reporting dates are calendar dates (`YYYY-MM-DD`) interpreted in `Asia/Bangkok`. Timestamps are UTC. Total male and female counts remain independent from category counts.

## Local development

Use the repository's Bun scripts after configuring the local database and Better Auth variables from `.env.example`:

```sh
bun install --frozen-lockfile
bun run prisma generate
bun run prisma migrate dev
bun run dev
```

The intended local callback origin is `http://localhost:40000`.

## Deployment

Build and push immutable app and migration image digests (`docker build --target runner ...` and `docker build --target migrate ...`). Replace `REPLACE_WITH_DIGEST` and `REPLACE_WITH_MIGRATION_DIGEST` only through the GitOps review process. Inject runtime variables through the cluster's Infisical-managed `okr-unit-runtime` Secret and use a separate least-privilege migration credential in `okr-unit-migration`.

Run the migration Job deliberately after reviewing the migration and image:

```sh
kubectl apply -f deploy/base/migration-job.yaml
```

The normal app container does not run migrations or bootstrap an Admin. Configure the Cloudflare tunnel to route `okr-unit.pskwr.com` to the Service and register the Google callback `https://okr-unit.pskwr.com/api/auth/callback/google`. An ArgoCD application registration belongs in the GitOps repository; this repository only supplies the base and production overlay.
