# Production release through restricted GitOps

## Decision

Production runs on the existing k3s cluster through the homelab GitOps repository. The application repository builds multi-architecture app and migration images only after CI passes on `main`. The GitOps Application reads the application manifests at a reviewed immutable source commit SHA, belongs to a dedicated AppProject restricted to this repository and the `okr-unit` namespace, and receives image digests through its Kustomize overrides.

Infisical is the only source of runtime and migration credentials. Stage 1 creates the namespace and InfisicalSecret resources only. Stage 2 is enabled after both generated Secrets are ready; its PreSync job applies migrations and idempotently bootstraps the first Admin before application resources sync. Runtime and migration database roles remain separate.

## Rationale

The GitOps repository controls what can deploy to the cluster, while pinning an application SHA prevents later source changes from silently changing production. Restricting the AppProject narrows the impact of mistakes in application manifests. Waiting for CI before publishing prevents unverified code from becoming a production image. Staged secret synchronization keeps migrations from running before required credentials exist. Digest overrides make the deployed image content explicit and reviewable.

## Consequences

A release requires a reviewed application commit, passing CI, image digests from the publish job, the Infisical project slug and access policy, and two GitOps changes: first register the restricted stage-1 Application, then switch to the production overlay after secret readiness. DNS and external OAuth/email settings must be configured separately. Database migrations are forward-only; rollback means pinning an earlier compatible app digest, not reversing schema changes.
