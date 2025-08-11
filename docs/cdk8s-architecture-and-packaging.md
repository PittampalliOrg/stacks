# CDK8s Architecture, Code Organization, and IdpBuilder Packaging

## Overview

This document explains how our CDK8s TypeScript charts are organized after the refactor, how we model ArgoCD Applications, and exactly how we synthesize IdpBuilder-compatible custom packages (including the cnoe:// integration with Gitea).

## Code Organization

- `cdk8s/main-v2.ts`: Single entrypoint that
  - loads `config/applications.ts`,
  - uses `IdpBuilderChartFactory` to create charts,
  - synthesizes per-app packages to `cdk8s/dist/<app>/manifests`,
  - writes a kustomization.yaml per package,
  - and emits a top-level `cdk8s/dist/<app>.yaml` ArgoCD Application manifest.
- `cdk8s/config/applications.ts`: Declarative ApplicationConfig list that drives everything (chart type, destination namespace, sync wave, labels/annotations, and dependencies).
- Charts (`cdk8s/charts`) by domain:
  - `apps/`: App workloads (e.g., Next.js, Postgres, Redis).
  - `platform/`: Platform apps (ArgoCD Application builders, Headlamp, Namespaces).
  - `pipelines/`: Kargo pipeline resources (Projects, Warehouses, Stages, RBAC).
  - `secrets/`: External Secrets definitions and WI patches.
  - `infra/`: Infrastructure charts (e.g., Dagger, Vault under `infra/vault/*`).
- Shared libraries (`cdk8s/lib`):
  - `idpbuilder-chart-factory.ts`: Registers/creates chart instances by name from `applications.ts`.
  - `argocd-helpers.ts`: Sync-wave, hook, and Argo-specific annotations helpers.
  - `eso-helpers.ts`: Reusable builders for common ExternalSecret patterns (env secrets, dockerconfigjson, TLS).
  - `kargo-rbac.ts`: Helper to create shared pipeline ServiceAccount + RoleBinding.
- Typed imports (`cdk8s/imports`):
  - `k8s.ts`: Kubernetes core types (KubeDeployment, KubeService, KubeIngress, etc.).
  - `argoproj.io.ts`: Argo resources (Application, WorkflowTemplate, etc.).
  - `external-secrets.io.ts`: External Secrets CRDs.
  - `kargo.akuity.io.ts`: Kargo CRDs (Project, Warehouse, Stage, etc.).
- cdk8s-plus-32 usage:
  - Used selectively when it improves ergonomics without altering YAML semantics (e.g., ConfigMap, HPA). For exact YAML control of core resources, we prefer `imports/k8s`.

## ArgoCD Applications Architecture

- Typed Application builder: We use typed resources from `imports/argoproj.io` and a helper chart (`ArgoApplicationsChartV2`) to generate correct, consistent Applications.
- Single source vs multi-source:
  - Single-source: one `source` pointing to `cnoe://<package>/manifests` during local dev.
  - Multi-source: `sources[]` when pulling from both Helm and local files (e.g., Vault values + chart).
- Destinations:
  - Dev/Staging Apps target named vclusters (e.g., `dev-vcluster`, `staging-vcluster`).
  - Others target in-cluster `https://kubernetes.default.svc`.
- Sync waves/annotations:
  - We consistently apply `argocd.argoproj.io/sync-wave` to control ordering (e.g., namespaces < secrets < apps).
  - Some apps include Kargo annotations (e.g., `kargo.akuity.io/authorized-stage`).
- Hook usage:
  - Where needed, Argo hooks are added via helpers in `lib/argocd-helpers.ts`.

## Generating IdpBuilder Custom Packages (cdk8s → dist)

Synthesis produces IdpBuilder-ready packages:

- `cdk8s/dist/<app>/manifests/`: all resource YAMLs (FILE_PER_RESOURCE mode) + `kustomization.yaml`.
- `cdk8s/dist/<app>.yaml`: typed ArgoCD Application that references `cnoe://<app>/manifests` for local dev.

Example output layout:
```
dist/
├── my-app.yaml                 # ArgoCD Application manifest
└── my-app/
    └── manifests/
        ├── Namespace.my-app.k8s.yaml
        ├── Deployment.my-app.k8s.yaml
        ├── Service.my-app.k8s.yaml
        └── kustomization.yaml
```

### Using cnoe:// with IdpBuilder

We use `repoURL: cnoe://<package>/manifests` in Application source for local development. IdpBuilder understands this and performs:
- Creates a local Gitea repository for `<package>-manifests`.
- Pushes the contents of `manifests/` into that repo.
- Rewrites the Application’s `repoURL` to the Gitea repository URL.
- Triggers ArgoCD to sync from Gitea.

This preserves a GitOps flow while letting you iterate quickly from local files.

### Deploying Custom Packages

- Deploy all synthesized packages:
```
idpbuilder create --package cdk8s/dist/
```
- Deploy specific package(s):
```
idpbuilder create --package cdk8s/dist/my-app
idpbuilder create --package cdk8s/dist/redis
```

### Gitea Integration Notes

IdpBuilder creates an internal Gitea and a token (stored in a Kubernetes secret) to automate Git interactions.

Get the token:
```
# print all gitea secrets
idpbuilder get secrets -p gitea

# token only (json output + jq)
idpbuilder get secrets -p gitea -o json | jq -r '.[0].data.token'
```

Use this token to script org/user creation or API calls (see IdpBuilder docs for examples).

## Refactor Highlights and Rationale

- Typed resources over raw ApiObject:
  - Argo Workflows (`WorkflowTemplate`), core K8s resources (`KubeIngress`, etc.), External Secrets WI `ServiceAccount` are all typed for stronger guarantees.
- Duplication removal via helpers:
  - `eso-helpers.ts` standardizes env/dockerconfigjson/TLS ExternalSecrets (labels/annotations preserved with `JsonPatch.add`).
  - `kargo-rbac.ts` provides a single source of truth for Kargo pipeline SA/RoleBinding.
- Domain-oriented structure:
  - Charts live under `apps/`, `platform/`, `pipelines/`, `secrets/`, `infra/` subfolders.
  - Vault consolidated under `infra/vault/*` with a small composite chart.
- YAML equivalence preserved:
  - Resource names, labels, annotations (including sync waves) are unchanged, ensuring ArgoCD/idpbuilder behavior is identical.

## Performance Tips

- `SYNTH_CONCURRENCY`: control synthesis parallelism (default 4 in `main-v2.ts`).
- TypeScript compiler:
  - `skipLibCheck: true` (recommended) and `incremental` enabled.
  - Disable `inlineSourceMap` for faster local builds if desired.
- Use `npm run synth:fast` for iterative development.

## Helm and CRD Notes

- Some charts (e.g., Kargo) are installed with Helm via CDK8s. Ensure the `helm` binary is available when synthesizing outside of sandboxed environments.
- CRDs are vendored under `cdk8s/imports/*` and updated via `npm run import` as needed.

## Quick Start

```bash
# Install deps
cd cdk8s && npm install

# Synthesize IdpBuilder packages
npx ts-node main-v2.ts

# Deploy with IdpBuilder
idpbuilder create --package ./dist/
```

## Related Docs
- [GitOps Architecture Overview](./gitops-architecture-overview.md)
- [Development Workflow](./development-workflow.md)
- [Secrets Management](./secrets-management.md)
- [VCluster Architecture](./vcluster-architecture.md)

