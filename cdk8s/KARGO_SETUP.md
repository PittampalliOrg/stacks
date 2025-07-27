# Kargo Setup Guide

## Overview

Kargo is a next-generation continuous delivery and application lifecycle orchestration platform that integrates seamlessly with ArgoCD. This guide explains how Kargo has been integrated into the idpbuilder CDK8S stack.

## Architecture

Kargo is deployed as:
1. **Kargo Secrets** - External Secrets for admin credentials
2. **Kargo Application** - Main Kargo deployment via ArgoCD

## Prerequisites

1. External Secrets Operator configured with Azure Key Vault
2. ArgoCD installed and running
3. NGINX Ingress Controller

## Setup Instructions

### 1. Generate Admin Credentials

First, generate secure credentials for the Kargo admin account:

```bash
# Generate a secure password
pass=$(openssl rand -base64 48 | tr -d "=+/" | head -c 32)
echo "Password: $pass"

# Generate the bcrypt password hash
echo "Password Hash: $(htpasswd -bnBC 10 "" $pass | tr -d ':\n')"

# Generate a token signing key
echo "Signing Key: $(openssl rand -base64 48 | tr -d "=+/" | head -c 32)"
```

### 2. Add Secrets to Azure Key Vault

Add the following secrets to your Azure Key Vault:

- `KARGO-ADMIN-PASSWORD-HASH`: The bcrypt password hash from step 1
- `KARGO-ADMIN-TOKEN-SIGNING-KEY`: The signing key from step 1

**Important**: Keep the plain password from step 1 secure - you'll need it to log into Kargo.

### 3. Deploy Kargo

The Kargo deployment is handled automatically by the CDK8S synthesis process:

```bash
# Synthesize the CDK8S charts
cd /home/vscode/workspace/stacks/cdk8s
npm run synth

# The following will be generated:
# - dist/kargo-secrets/manifests/install.yaml
# - dist/kargo/manifests/install.yaml
# - dist/kargo-secrets.yaml (ArgoCD Application)
# - dist/kargo.yaml (ArgoCD Application)
```

### 4. Access Kargo UI

Once deployed, Kargo will be accessible at:
- **HTTP**: http://kargo.cnoe.localtest.me
- **HTTPS**: https://kargo.cnoe.localtest.me:8443 (if TLS is enabled)

Login credentials:
- **Username**: admin
- **Password**: The plain password you generated in step 1

## Integration with ArgoCD

Kargo is deployed as an ArgoCD Application with the following configuration:
- **Namespace**: kargo
- **Sync Wave**: 70 (after core platform services)
- **Chart Version**: 1.6.1
- **Automated Sync**: Enabled with prune and self-heal

## Configuration

The Kargo deployment includes:
- Admin account with secure credentials from External Secrets
- gRPC web support for the UI
- Logging level set to INFO
- RBAC with cluster roles and bindings
- Integration with existing ArgoCD instance

## Creating Kargo Resources

With the imported Kargo CRDs, you can now create type-safe Kargo resources:

```typescript
import { Project, Stage, Warehouse, PromotionTask } from '../imports/kargo.akuity.io';

// Create a Kargo Project
new Project(this, 'my-project', {
  metadata: {
    name: 'my-app',
  },
});

// Create a Warehouse
new Warehouse(this, 'my-warehouse', {
  metadata: {
    name: 'my-app-images',
    namespace: 'my-app',
  },
  spec: {
    subscriptions: [
      {
        image: {
          repoURL: 'ghcr.io/myorg/myapp',
          semverConstraint: '^1.0.0',
        },
      },
    ],
  },
});

// Create Stages
new Stage(this, 'dev-stage', {
  metadata: {
    name: 'dev',
    namespace: 'my-app',
  },
  spec: {
    requestedFreight: [
      {
        origin: {
          kind: 'Warehouse',
          name: 'my-app-images',
        },
        sources: {
          direct: true,
        },
      },
    ],
  },
});
```

## Troubleshooting

### Cannot access Kargo UI
1. Check if the pod is running: `kubectl get pods -n kargo`
2. Check ingress: `kubectl get ingress -n kargo`
3. Verify the service: `kubectl get svc -n kargo`

### Authentication Issues
1. Verify the External Secret synced: `kubectl get externalsecret -n kargo`
2. Check the secret exists: `kubectl get secret kargo-admin-credentials -n kargo`
3. Ensure you're using the correct password (not the hash)

### ArgoCD Sync Issues
1. Check ArgoCD Application status
2. Verify External Secrets are synced in both `kargo` and `argocd` namespaces
3. Check ArgoCD logs for any parameter substitution errors

## Next Steps

1. Create your first Kargo Project
2. Set up Warehouses for your container images
3. Define Stages for your deployment pipeline
4. Configure Promotions to automate rollouts

For more information, see the [official Kargo documentation](https://docs.kargo.io/).