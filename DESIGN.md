# Design

Extend the existing light dashboard: white surfaces on slate-50, slate text, teal primary controls, quiet borders, 12px card corners, Thai display/body typography, and tabular numbers. This is an operational reporting app; hierarchy and clear state feedback take priority over decorative effects.

Preserve the current hospital identity and Thai reporting copy. New login, invitation, and Settings surfaces use the same typography, colors, buttons, and form treatment. Do not replace the visual identity or invent hospital claims. Forms need persistent labels, accessible validation, visible keyboard focus, and touch-friendly controls; compact desktop tables can scroll horizontally on mobile.

## Form Controls and Navigation

Use native select elements for dropdowns to retain platform keyboard and mobile behavior. Style the closed control consistently with text inputs, including a clear disclosure indicator, visible focus, disabled state, and at least 44px control height. The expanded option menu follows the operating system. Do not add a custom dropdown dependency for this refinement.

Keep primary, secondary, and destructive actions visually distinct. Mobile navigation must expose the same permitted destinations as desktop without squeezing the hospital identity, links, and account actions into one row. Preserve the existing reporting, draft recovery, import, and access-management workflows.

## Deployment

Production uses a restricted Argo CD AppProject and an immutable application source SHA. CI publishes multi-architecture app and migration images only after verification succeeds on `main`; GitOps supplies their image digests. Infisical is the only source of runtime and migration credentials. A staged sync creates secrets before the PreSync migration and first-Admin bootstrap job. See [the production release runbook](deploy/README.md).

## Terms

- **Runtime role**: restricted PostgreSQL login used by the running web app; it has table DML rights but no schema ownership.
- **Migration role**: privileged PostgreSQL login used only by the Argo CD PreSync job to apply Prisma migrations and bootstrap the first Admin.
- **Source revision**: immutable Git commit SHA selected by the GitOps Application for a production release.
- **Image digest**: immutable OCI content identifier reported by the successful CI publish job and applied through Argo CD Kustomize image overrides.
