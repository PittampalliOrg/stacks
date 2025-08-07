# Kargo Gitea Integration - Implementation Summary

## Overview
Successfully configured Kargo pipelines to track and promote Backstage images from the local Gitea registry instead of GitHub Container Registry (GHCR) for the development environment.

## Changes Made

### 1. **Updated Kargo Backstage Pipeline Chart** (`cdk8s/charts/kargo-backstage-pipeline-chart.ts`)
- Changed warehouse subscription from `ghcr.io/pittampalliorg/backstage-cnoe` to `gitea.cnoe.localtest.me:8443/giteaadmin/backstage-cnoe`
- Updated all image references in promotion steps to use Gitea registry URL
- Modified commit messages to reflect Gitea registry source

### 2. **Created Gitea Registry Credentials Chart** (`cdk8s/charts/kargo-gitea-credentials-chart.ts`)
- New chart for managing Gitea registry authentication
- Uses External Secrets to fetch Gitea admin password from Azure Key Vault
- Includes fallback instructions for manual secret creation
- Properly labeled with `kargo.akuity.io/cred-type: image` for Kargo recognition

### 3. **Enhanced Project Chart with Webhook Support** (`cdk8s/charts/kargo-pipelines-project-chart.ts`)
- Added webhook secret configuration for Gitea integration
- Included detailed setup instructions within the secret
- Prepared for webhook-based freight refresh instead of polling

### 4. **Updated Images Configuration** (`.env-files/images.json`)
- Changed `dev.backstage` to reference Gitea registry: `gitea.cnoe.localtest.me:8443/giteaadmin/backstage-cnoe:v10`
- Maintained production configuration to continue using GHCR

### 5. **Comprehensive Documentation** (`docs/kargo-gitea-webhook-setup.md`)
- Complete setup guide for webhook configuration
- Step-by-step instructions for credentials, webhooks, and verification
- Troubleshooting section for common issues
- Security considerations and best practices

### 6. **Updated Main Entry Points** (`cdk8s/main.ts` and `cdk8s/main-v2.ts`)
- Registered the new `KargoGiteaCredentialsChart` with the chart factory
- Ensured proper import and initialization

## Key Benefits

1. **Local Development**: Enables fully local development workflow with images stored in Gitea
2. **Webhook Integration**: Supports real-time freight detection via webhooks instead of polling
3. **Security**: Proper credential management through External Secrets and Azure Key Vault
4. **Flexibility**: Maintains existing GHCR integration for production while using Gitea for dev

## Next Steps

To deploy these changes:

```bash
# 1. Generate the Kubernetes manifests
cd cdk8s
npm run synth

# 2. Apply the configurations
kubectl apply -f dist/kargo-pipelines-project-chart.yaml
kubectl apply -f dist/kargo-gitea-credentials-chart.yaml
kubectl apply -f dist/kargo-backstage-pipeline-chart.yaml

# 3. Follow the webhook setup guide
# See: docs/kargo-gitea-webhook-setup.md
```

## Testing

After deployment:
1. Push a new Backstage image to Gitea registry with appropriate version tag (e.g., v11)
2. Verify Kargo detects the new freight via webhook
3. Confirm automatic promotion to dev stage
4. Check that images.json is updated with the new image reference

## Important Notes

- Webhook secret must be properly configured for security
- Gitea admin credentials need to be available (via IDPBuilder or Azure Key Vault)
- TLS certificates should be properly configured for production use
- The Gitea registry URL uses port 8443 for HTTPS access