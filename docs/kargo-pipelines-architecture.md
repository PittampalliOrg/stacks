# Kargo Pipelines Architecture and Usage

This document explains how Kargo is installed and configured, how our pipelines are modeled, and how we keep YAML/type-safety guarantees in CDK8s.

## Components

- Installation (Helm via CDK8s): `charts/pipelines/kargo-helm-chart.ts`
  - Installs the Kargo chart (OCI) and configures API/controller/webhooks.
  - Adds a typed `Ingress` for the external webhooks server.
  - Patches webhook configurations (CA bundle) at synthesis time.
- Project and RBAC: `charts/pipelines/kargo-pipelines-project-chart.ts`
  - Defines the Kargo `Project` and `ProjectConfig` CRDs (typed: `imports/kargo.akuity.io`).
  - Manages RBAC: shared roles and cluster bindings for Kargo operations.
- Credentials: `charts/pipelines/kargo-pipelines-credentials-chart.ts`
  - ExternalSecret(s) for Kargo to access Git/registries as needed.
- Pipelines (apps):
  - `charts/pipelines/kargo-nextjs-pipeline-chart.ts`
  - `charts/pipelines/kargo-backstage-pipeline-chart.ts`
  - Each defines a `Warehouse` (image source) and `Stage`s (promotion flows).

## Type-Safe CRDs

We use typed CRDs from `cdk8s/imports/kargo.akuity.io.ts`:
- `Project`, `ProjectConfig`
- `Warehouse` (image subscriptions)
- `Stage` (promotion templates)

This improves safety when evolving pipeline specs and preserves YAML equivalence through synthesis.

## Promotion Patterns

- Warehouses subscribe to container registries (e.g., GHCR or local Gitea), with selection strategies (NEWEST_BUILD, LEXICAL, etc.).
- Stages use promotion templates with steps like:
  - `git-clone` → checkout infra repo
  - `json-update` → bump `.env-files/images.json`
  - `git-commit` / `git-push`
  - Optionally `argocd-update` to force sync after promotion

The exact steps are encoded in the `Stage.spec.promotionTemplate.spec.steps` fields.

## RBAC Helper

`lib/kargo-rbac.ts` exposes `createPipelineGitPromoter(scope, id, { appName })` to create a `ServiceAccount` and `RoleBinding` that bind to the shared `kargo-git-promoter` Role in the `kargo-pipelines` namespace. Pipelines call this helper for consistent, minimal RBAC.

## External Webhooks Ingress

Kargo’s external webhook server is exposed with a typed `KubeIngress`. TLS and annotations are identical to prior YAML:
- Host: `kargo-webhooks.cnoe.localtest.me`
- Annotations: nginx backend protocol, TLS behavior as configured

## Sync Waves and Ordering

- Kargo Helm app is deployed after secrets and core platform pieces (sync-wave in `applications.ts`).
- `kargo-pipelines-project` follows installation to ensure CRDs/controllers are ready.
- Application-specific pipelines deploy after the project and credentials are in place.

## Local Environment Notes

- Helm rendering occurs at synth time; ensure `helm` is available in your environment when running `main-v2.ts` locally.
- For dev clusters, Warehouses can point at the local Gitea registry; set `insecureSkipTlsVerify` when using self-signed certs.

## Where to Look

- Installation specifics: `charts/pipelines/kargo-helm-chart.ts`
- Project setup: `charts/pipelines/kargo-pipelines-project-chart.ts`
- Credentials: `charts/pipelines/kargo-pipelines-credentials-chart.ts`
- Application pipelines: `charts/pipelines/kargo-nextjs-pipeline-chart.ts`, `charts/pipelines/kargo-backstage-pipeline-chart.ts`
- Shared helper: `lib/kargo-rbac.ts`

