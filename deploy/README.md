# Production release

Production runs from the GitHub `main` branch through Argo CD on the home k3s
cluster. The application source repository is public. The CI workflow's
publish job builds separate multi-architecture application and migration images
in GHCR, and the GitOps repository pins both images by digest.

## Before stage 1

Create a production environment in Infisical with these paths:

`/okr-unit/runtime`:

- `DATABASE_URL`: Supabase session-pooler URL for a restricted runtime role;
  require TLS.
- `BETTER_AUTH_SECRET`: random secret of at least 32 characters.
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`: sender on a verified Resend domain.

`/okr-unit/migration`:

- `DATABASE_URL`: separate migration connection with schema privileges.
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_NAME`

Create a dedicated login role for the application in Supabase's SQL Editor. Use
a generated password and store it only in Infisical; the runtime role must not
own tables or have schema-changing privileges:

```sql
CREATE ROLE okr_runtime LOGIN PASSWORD '<generated-password>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
GRANT CONNECT ON DATABASE postgres TO okr_runtime;
GRANT USAGE ON SCHEMA public TO okr_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO okr_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO okr_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE <migration_owner> IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO okr_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE <migration_owner> IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO okr_runtime;
```

Run the `ALTER DEFAULT PRIVILEGES` statements as the same database role used by
`/okr-unit/migration`. Use the runtime role in the `DATABASE_URL` stored at
`/okr-unit/runtime`; keep migration credentials separate. Give the shared
Infisical Universal Auth identity read access only to this project's `prod`
environment and the two required paths. Never paste credentials into chat or
Git.

The bootstrap values should identify the first Admin specified in
`docs/PLAN.md`. The bootstrap job is idempotent and runs after schema migration.
`NEXT_PUBLIC_APP_URL` is a build argument set to
`https://okr-unit.pskwr.com`; it is public and is inlined into the client bundle.
`BETTER_AUTH_URL` and `BETTER_AUTH_TRUSTED_ORIGINS` are set by the production
Kubernetes overlay.

Replace `REPLACE_WITH_INFISICAL_PROJECT_SLUG` in the application source in both
`base/infisical-secret.yaml` and `overlays/prod-secrets/infisical-secret.yaml`
with the project's slug. Keep both copies aligned: the stage-1 Kustomize overlay
must not load resources outside its directory. The Infisical operator requires
the scope under `authentication.universalAuth.secretsScope`. Commit this
non-secret slug before selecting the immutable source SHA for stage 1.

Add `https://okr-unit.pskwr.com/api/auth/callback/google` to the Google OAuth
client's authorized redirect URIs. Ensure the sender is verified in Resend.

## Staged sync

1. Merge the application changes to `main`. Confirm the `verify` CI job passes.
   The Vercel checks are outside this k3s release path.
2. The CI workflow's `publish` job builds the application and migration images
   for `linux/amd64` and `linux/arm64`, and reports their immutable digests.
   GHCR packages are private by default; set both packages
   (`okr-unit` and `okr-unit-migrate`) to Public before rollout. The source is
   already public, and this avoids maintaining a separate cluster pull secret.
3. In the GitOps repository, set the reviewed application source commit SHA in
   the `okr-unit` Application, retain `path: deploy/overlays/prod-secrets`, and
   commit that change. Argo CD uses the restricted `okr-unit` AppProject and
   creates only the namespace and two `InfisicalSecret` resources; the source
   revision must be an immutable SHA, never `main`.
4. Wait until both Infisical resources report ready and both generated
   Kubernetes Secrets exist. Inspect only resource status and Secret metadata;
   never print secret data.
5. In the GitOps repository, set the Application's Kustomize `images` overrides
   to both digests reported by the successful CI publish job, then change its
   source path to `deploy/overlays/prod`. Keep the application source SHA pinned.
   Use values in this form:

   ```yaml
   kustomize:
     images:
       - ghcr.io/nooy2131-jpg/okr-unit=ghcr.io/nooy2131-jpg/okr-unit@sha256:<app-digest>
       - ghcr.io/nooy2131-jpg/okr-unit-migrate=ghcr.io/nooy2131-jpg/okr-unit-migrate@sha256:<migration-digest>
   ```

   The PreSync Job generates Prisma Client, applies migrations, and bootstraps
   the first Admin before the Deployment and Ingress are synchronized.
6. Create a proxied Cloudflare CNAME for `okr-unit.pskwr.com` to the existing
   tunnel target `54d832a8-9f22-4b64-92f8-3312e19e7e6a.cfargotunnel.com`. The
   GitOps tunnel config routes that host to Traefik. Wait for the
   `letsencrypt-prod` certificate and the application readiness probe.
7. Smoke-test HTTPS, Google login, password-reset email, Admin Settings, report
   save, history, CSV export, and import before staff use the site.

The production database is expected to be empty for the initial sync. Confirm
that before the first migration. Later rollbacks must pin the previous app
digest in GitOps; reverting an image does not reverse database migrations.

## Useful read-only checks

```sh
KUBECONFIG=~/.kube/hp01.yaml kubectl get applications -n argocd okr-unit
KUBECONFIG=~/.kube/hp01.yaml kubectl get infisicalsecret -n okr-unit
KUBECONFIG=~/.kube/hp01.yaml kubectl get secrets -n okr-unit
KUBECONFIG=~/.kube/hp01.yaml kubectl get pods,ingress -n okr-unit
```
