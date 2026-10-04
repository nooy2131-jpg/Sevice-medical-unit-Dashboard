# Medical Unit Dashboard Rebuild and Deployment Plan

## Confirmed scope

Rebuild the existing temporary-service-unit reporting application with Next.js App Router, React, strict TypeScript, Tailwind, and bun. Use Prisma with Supabase PostgreSQL, Better Auth for sessions and basic RBAC, and Resend for invitations and password reset. Host on homelab k3s at `https://okr-unit.pskwr.com` through the existing GitOps deployment platform.

This project is development collaboration with Ping. It does not require live collaborative editing or an organization-management system. It does require safe shared persistence across signed-in users.

Keep one aggregate report per date for the unit, the existing service fields, top diseases/procedures, Thai interface, historical records, exports, and printing. Do not introduce patient records. Total male and female service counts are independently entered; overlapping categories do not determine totals. Preserve the existing visual identity while improving usability.

## Architecture

The Next.js application serves the UI and same-origin server endpoints. Better Auth owns authentication. A shared server authorization layer checks the current active account and its current role before each protected operation. Prisma accesses PostgreSQL only on the server. The browser has no database password, Resend key, or Supabase privileged key. Supabase Auth and browser-direct Supabase Data API access are not part of this design.

Use a Next.js standalone container with runtime configuration and Infisical Operator-managed secrets. Confirm cluster connectivity and the Supabase session pooler endpoint before deployment; do not assume the supplied direct database host is reachable from an IPv4-only cluster. Configure verified database TLS and separate migration credentials from the restricted runtime database role. Deny anonymous Supabase API access to application tables.

## Permissions

| Capability | Member | Admin |
| --- | --- | --- |
| View reports and dashboard | Yes | Yes |
| Create and edit reports | Yes | Yes |
| Export and print | Yes | Yes |
| Import reports | No | Yes |
| Delete reports | No | Yes |
| Invite or disable accounts | No | Yes |
| Change account roles | No | Yes |

Settings provides a user list, invitations, role changes, and account disabling for Admin. Basic RBAC has two fixed roles; Settings assigns roles rather than defining arbitrary permissions. Serialize operations that reduce the active Admin set with a database lock or serializable isolation and bounded retries; a transaction alone does not prevent concurrent requests from removing the last Admin. Role changes and disabling take effect on subsequent protected requests, even when an existing session is still valid. Ensure Better Auth's own administrative endpoints cannot bypass these restrictions; omit unused administrative capabilities such as impersonation.

## Authentication and invitations

1. Bootstrap `pongsakorn.wera@gmail.com` as the first Admin with a controlled, idempotent setup operation. Do not grant Admin to the first public registrant or generate a shared/default password.
2. Admin invites an exact email address with an assigned role. Invitations use expiring, single-use random tokens stored as hashes. Admin can resend or revoke invitations.
3. The recipient opens the invite, chooses a password, and can immediately sign in. Possession of the invitation token establishes mailbox access; there is no second verification email.
4. Google login requires a trusted, verified Google email matching an active invitation or existing active account. Consume the invitation on successful acceptance and keep account linking consistent with the established email identity.
5. Reject uninvited account creation for both authentication methods, including direct requests to auth endpoints. Do not issue usable access before invitation acceptance succeeds.
6. Resend delivers invitations and password-reset links from a verified sender domain. Configure expiry, resend limits, login/reset rate limits, and trusted origins. Never email passwords.

Invitation acceptance must atomically claim the token and keep application membership inactive until account creation/linking and acceptance complete. Define idempotent retries and recovery for interrupted acceptance; token consumption or a partially created Better Auth account must never grant access alone. Test concurrent acceptance and failures at each boundary.

## Data model and reporting behavior

Use Better Auth's Prisma-backed user, account, session, and verification models, plus invitations, daily reports, report items, per-user drafts, and audit entries. Daily reports have a unique reporting date, server timestamps, creator/editor attribution, and an incrementing version. Top items retain their category, name, count, and optional male/female breakdown.

Store recoverable drafts per account and reporting date. Draft autosave does not publish reports or change dashboard statistics. Explicit Save validates data and updates the report atomically with its audit entry. Keep the draft if saving fails. Use an atomic compare-and-set against the expected report version, not a separate read-then-write check. When no row matches, ask the editor to review the current report before overwriting; never silently retry a stale update. Unique date constraints also protect concurrent first creation.

Validate dates, finite non-negative integer counts, input lengths, and top-item shapes on the server and in database constraints where appropriate. Do not enforce equality between total service counts and category sums. Keep reporting dates as calendar dates interpreted in Asia/Bangkok; timestamps remain UTC and display in local time.

Keep durable audit records for report mutations, invitations, role changes, and account disabling without logging credentials or tokens. A dedicated audit-history UI is outside the initial scope. Drafts stay outside exports and imports. Soft-delete with Admin restore is a proposed safeguard, not a confirmed launch requirement.

## Delivery sequence

### 1. Foundation and database

Replace Vite entry points with Next.js App Router and real routes for dashboard, report editing, history, login, invitation acceptance, and Settings. Preserve the existing Thai content and reporting fields. Add strict TypeScript, Zod validation, Prisma schema/migrations, and a committed bun lockfile. Remove unused template dependencies and inaccurate Gemini/Google Apps Script metadata.

Deliverable: a reproducible build with an isolated development database and the migrated report model.

### 2. Authentication and RBAC

Implement Better Auth, Email + password, Google OAuth, Resend, invitations, Admin bootstrap, and the authorization layer. Add Settings for invitations, roles, and account status. Build explicit authentication failure and expired-invitation states.

Deliverable: invited accounts can sign in; Member cannot invoke Admin operations through either application or auth APIs.

### 3. Reports and migration

Move reading and writing from localStorage to server persistence. Add private drafts, explicit Save, conflict detection, audit entries, and independent totals. Preserve dashboard, table, print, and export functionality.

Export existing browser data before changing persistence. The old data exists per browser and origin, so deploying to the new hostname cannot automatically discover it. Provide an Admin import preview that validates rows, identifies duplicate dates, and requires an explicit choice before overwriting. Use a real CSV parser and verify round-trip support for quoted JSON, commas, multiline notes, and Thai text. Import valid rows and audit the result transactionally according to the selected duplicate policy; never silently truncate data.

Deliverable: current reports can be migrated without silent data loss, and editing a draft leaves the published report intact.

### 4. Usability improvements

Prioritize these existing defects and workflow improvements:

- Correct Bangkok date navigation and the initial reporting date.
- Make the seven-day filter use seven calendar days; show missing-report dates explicitly.
- Show saved, unsaved, saving, and failed states accurately.
- Keep drafts after network errors and show stale-edit recovery.
- Make Reset and Cancel operate on drafts rather than silently clearing saved reports.
- Improve mobile report entry, persistent field labels, keyboard access, and modal focus behavior.
- Display last editor and update time; clarify the dashboard's reporting period and recorded-day averages.

Deliverable: desktop and mobile reporting workflows are understandable and usable without replacing the site's established identity.

### 5. Verification

Run type checks, lint, production build, targeted integration tests, and Playwright workflows. Test invitation replay/expiry/revocation, uninvited Email and Google access, account linking, reset flows, Member denial for every Admin operation, immediate role revocation, bootstrap idempotency, and concurrent last-Admin changes.

Test draft recovery, duplicate report dates, stale saves, independent totals, database validation, CSV round trips, import rollback, soft-delete/restore if adopted, and Bangkok date boundaries. Check mobile entry, keyboard navigation, printing, and that production assets contain no secrets. Verify the application's database tables cannot be read through anonymous Supabase API access.

Use separate writer and reviewer models per Ping's instructions: gpt-5.6-luna implements at high reasoning effort; gpt-5.6-sol reviews. Divide implementation into independent owned areas and isolated worktrees when parallelizing. The primary agent inspects the resulting changes and validation before any release.

### 6. Deployment

Inspect current homelab routes, architecture, image access, and secret conventions. Build a pinned standalone container, with either supported multi-architecture images or an explicit compatible node selector. Prepare namespace, deployment, service, probes, resource limits, InfisicalSecret, ingress/Cloudflare routing, and ArgoCD registration consistent with the existing platform. Desired state belongs in GitOps; avoid ad hoc mutation of managed resources.

Before promoting, configure database connectivity and TLS, Better Auth secret/origin, Google OAuth credentials and callback, Resend sending credentials and verified sender, and controlled first-Admin setup. Apply migrations through a deliberate deployment step and confirm backup/restore access. Do not depend on unspecified Supabase plan backup features.

Smoke-test login, invitations, Settings, report saves, exports, and HTTPS at `okr-unit.pskwr.com`. Prepare rollback to the previous image, and document database compatibility separately; an image rollback does not undo migrations. Commit/push only when Ping asks. This planning request does not authorize immediate implementation or remote deployment.

## Launch inputs

- Rotated database credentials and the project's actual session pooler connection details, stored in secrets management.
- Google OAuth client configuration for the final origin and registered development callback.
- Resend sending key and verified sender identity.
- Infisical project/path and the registry/GitOps release configuration.
- Exported reports from each browser containing data that must be retained.

## Google OAuth URLs

Use local development port `40000` (checked free during planning; check again before starting a server). Register both environments on the Google Web application OAuth client.

| Environment | Authorized JavaScript origin | Authorized redirect URI | BETTER_AUTH_URL |
| --- | --- | --- | --- |
| Local | `http://localhost:40000` | `http://localhost:40000/api/auth/callback/google` | `http://localhost:40000` |
| Production | `https://okr-unit.pskwr.com` | `https://okr-unit.pskwr.com/api/auth/callback/google` | `https://okr-unit.pskwr.com` |

These callback paths assume Better Auth's default `/api/auth` base path. Keep client secrets in server-side secrets management and rotate credentials exposed in chat before use.

## References

- [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying)
- [Better Auth Admin plugin](https://better-auth.com/docs/plugins/admin)
- [Better Auth Email and Password](https://better-auth.com/docs/authentication/email-password)
- [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Prisma production migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)
- [Resend domain setup](https://resend.com/docs/dashboard/domains/introduction)
