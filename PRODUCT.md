# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Invited staff record aggregate daily activity for the temporary service unit at Ongkharak Hospital. Admin manages access; Member creates, edits, views, and exports reports.

## Product Purpose

Provide one shared daily service report per calendar date, a historical record, and understandable statistics without individual patient records.

## Operating Context

The interface is Thai. Reporting dates follow Asia/Bangkok. Existing reports live in individual browsers and require an explicit migration. Both desktop and mobile reporting must remain usable.

## Capabilities and Constraints

Next.js, Prisma, Supabase PostgreSQL, Better Auth, Email + password and Google login, Resend, and invitation-only access are confirmed. Invitation acceptance grants immediate login without another verification email. Admin has full application access; the last active Admin is protected. Drafts remain separate until explicit Save. Total service counts are entered independently of overlapping service categories. Deployment target is homelab k3s at okr-unit.pskwr.com.

## Evidence on Hand

Existing components, Thai copy, service categories, disease/procedure presets, dashboard, table, and print styling are the incumbent product content. No patient records are part of this product.

## Product Principles

- Published reports change only after a successful explicit Save.
- A permission check belongs on every protected server operation.
- Failed operations preserve the editor's draft.
- Imports expose validation and duplicate decisions before writing data.
- Retain the established site's visual identity.
- Dashboard disease and procedure statistics use approved standardized names and groups while preserving unclassified entries.
- Admin reviews suggested name mappings before approval. Historical reports preserve raw names; exports include raw and derived values separately.
