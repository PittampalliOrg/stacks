# Stacks - CDK8s GitOps Platform

## Overview
This codebase implements a GitOps-based Kubernetes platform using CDK8s (TypeScript), ArgoCD, and IdpBuilder. It provides multi-environment deployment capabilities through VClusters with comprehensive secret management via External Secrets Operator (ESO) and Azure Key Vault.

## Core Architecture

### Technology Stack
- **Infrastructure as Code**: CDK8s with TypeScript (type-safe Kubernetes manifests)
- **GitOps**: ArgoCD for continuous deployment
- **Package Management**: IdpBuilder for local development with Gitea integration
- **Multi-Environment**: VClusters for isolated dev/staging environments
- **Secrets**: External Secrets Operator with Azure Key Vault
- **CI/CD Pipelines**: Kargo for image promotion workflows
- **Container Registry**: GHCR (GitHub Container Registry) and local Gitea registry

### Key Design Decisions
1. **Individual ArgoCD Applications** (not ApplicationSets) for explicit control and debugging
2. **TypeScript over YAML templating** for compile-time validation and IDE support
3. **VClusters** for environment isolation with shared host infrastructure
4. **cnoe:// protocol** for local development with automatic Gitea repository creation

## Project Structure

```
stacks/
├── cdk8s/                      # CDK8s TypeScript code
│   ├── main-v2.ts             # Main entry point for synthesis
│   ├── config/
│   │   └── applications.ts    # Application configurations (single source of truth)
│   ├── charts/                # Chart definitions by domain
│   │   ├── apps/             # Application workloads (Next.js, Postgres, Redis)
│   │   ├── platform/         # Platform components (ArgoCD, Headlamp, Namespaces)
│   │   ├── pipelines/        # Kargo pipeline resources
│   │   ├── secrets/          # External Secrets definitions
│   │   └── infra/            # Infrastructure (Dagger, Vault)
│   ├── lib/                   # Shared libraries
│   │   ├── idpbuilder-chart-factory.ts  # Chart factory pattern
│   │   ├── argocd-helpers.ts           # Sync waves and annotations
│   │   ├── eso-helpers.ts              # External Secrets builders
│   │   └── kargo-rbac.ts               # Pipeline RBAC helpers
│   ├── imports/               # Generated Kubernetes types
│   └── dist/                  # Synthesized manifests (gitignored)
├── docs/                      # Comprehensive documentation
├── scripts/                   # Utility scripts
└── .env-files/               # Environment configurations
    └── images.json           # Container image references
```

## Development Workflow

### Quick Start
```bash
# Install dependencies
cd cdk8s && npm install

# Synthesize all packages (generates dist/)
npx ts-node main-v2.ts
# OR
npm run synth

# Deploy with IdpBuilder
idpbuilder create --package dist/

# Deploy specific package
idpbuilder create --package dist/backstage-dev
```

### Key Commands
```bash
# Type checking
npm run type-check

# Fast synthesis (uses esbuild)
npm run synth:fast

# Import/update CRD types
npm run import

# Get Gitea token
idpbuilder get secrets -p gitea -o json | jq -r '.[0].data.token'

# Connect to vcluster
vcluster connect vcluster-dev-helm -n dev-vcluster --server=https://dev-vcluster.cnoe.localtest.me:8443
```

## Critical Concepts

### 1. IdpBuilder Package Structure
Each synthesized package follows this structure:
```
dist/
├── <app-name>.yaml           # ArgoCD Application manifest
└── <app-name>/
    └── manifests/
        ├── *.yaml            # Kubernetes resources
        └── kustomization.yaml # Resource ordering
```

### 2. cnoe:// Protocol
- Used in ArgoCD Application sources: `cnoe://backstage-dev/manifests`
- IdpBuilder automatically:
  - Creates Gitea repository
  - Pushes manifests
  - Rewrites URL to Gitea URL
  - Triggers ArgoCD sync

### 3. Sync Waves
Resources deploy in order using ArgoCD sync-wave annotations:
- `-100`: Namespaces
- `-90`: ServiceAccounts
- `-80`: Secrets
- `-70`: ConfigMaps
- `0`: Deployments
- `10`: Services
- `20`: Ingresses

### 4. VCluster Architecture
- **Host Cluster**: Runs ArgoCD, ESO, Kargo
- **Dev VCluster**: Isolated environment at `dev-vcluster.cnoe.localtest.me`
- **Staging VCluster**: Production-like at `staging-vcluster.cnoe.localtest.me`
- **Secret Syncing**: Host secrets synced to vclusters via mappings

### 5. Secret Management Flow
```
Azure Key Vault → External Secrets Operator → Host Cluster Secrets → VCluster Sync → Application Pods
```

## Common Development Patterns

### Adding a New Application
1. Create chart in `cdk8s/charts/apps/my-app-chart.ts`
2. Register in `cdk8s/main-v2.ts`:
   ```typescript
   IdpBuilderChartFactory.register('MyAppChart', MyAppChart);
   ```
3. Add to `cdk8s/config/applications.ts`:
   ```typescript
   {
     name: 'my-app',
     namespace: 'my-app',
     chart: { type: 'MyAppChart' },
     argocd: { syncWave: '100' }
   }
   ```
4. Synthesize and deploy:
   ```bash
   npm run synth
   idpbuilder create --package dist/my-app
   ```

### Environment-Specific Configuration
```typescript
// Use parameterized charts
const resources = envName === 'production' 
  ? { cpu: '2', memory: '4Gi' }
  : { cpu: '500m', memory: '1Gi' };

// Reference environment images
const imageRef = images[envName as keyof typeof images]?.myApp || 'default:latest';
```

## Troubleshooting Quick Reference

### Issue: ImagePullBackOff
**Solution**: Ensure GHCR credentials exist:
1. Secret must exist in host namespace: `kubectl create namespace backstage`
2. Check External Secret: `kubectl get externalsecret -n backstage ghcr-dockercfg-external`
3. Verify imagePullSecrets in deployment

### Issue: Application "Unknown Healthy"
**Solution**: Use IdpBuilder for cnoe:// URLs:
```bash
idpbuilder create --package dist/<package>  # NOT kubectl apply
```

### Issue: Secrets Not in VCluster
**Solution**: 
1. Create namespace on host
2. Verify sync mapping in vcluster config
3. Restart vcluster: `kubectl delete pod -n dev-vcluster vcluster-dev-helm-0`

### Issue: Health Checks Failing in Dev
**Solution**: Disable health checks for dev containers using `sleep infinity`:
```typescript
const healthProbes = envName !== 'dev' ? { livenessProbe: {...} } : {};
```

## Key Integration Points

### Gitea Integration
- Local Git server for IdpBuilder packages
- Container registry for local images
- Webhook integration with Kargo for automated promotions

### Kargo Pipelines
- Watches container registries for new images
- Promotes images by updating `.env-files/images.json`
- Commits changes back to Git for GitOps sync

### External Secrets Operator
- Syncs from Azure Key Vault
- Uses Workload Identity for authentication
- Creates dockerconfigjson secrets for GHCR access

## Best Practices

1. **Always use TypeScript types** - Never use raw ApiObject
2. **Test locally with type-check** before synthesis
3. **Use sync waves** for deployment ordering
4. **Set resource limits** on all containers
5. **Configure environment-appropriate health checks**
6. **Never commit secrets** - Use External Secrets
7. **Use the chart factory pattern** for consistency
8. **Document manual interventions** in troubleshooting guide

## Environment URLs
- ArgoCD: https://argocd.cnoe.localtest.me:8443
- Gitea: https://gitea.cnoe.localtest.me:8443
- Backstage: https://backstage.cnoe.localtest.me:8443
- Headlamp: https://headlamp.cnoe.localtest.me:8443
- Kargo: https://kargo.cnoe.localtest.me:8443

## Additional Resources
- Detailed docs in `/docs/` folder
- Scripts in `/scripts/` for vcluster connectivity and certificate management
- Configuration in `.env-files/` for environment-specific settings