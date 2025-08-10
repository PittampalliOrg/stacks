# VCluster Connection Guide

## Overview
This guide explains how to connect to vclusters in our multi-environment setup, designed to work with Docker Desktop and WSL2 networking constraints.

## Architecture
- **Dev Environment**: Uses devcontainer images with `sleep infinity` for development
- **Staging Environment**: Uses built application images from CI/CD
- **Ingress Class Syncing**: VClusters use the host cluster's nginx ingress controller

## Connection Method

### 1. Merge Kubeconfigs
Run the merge script to create localhost-based kubeconfig entries:
```bash
./scripts/merge-vcluster-kubeconfigs.sh
```

This script:
- Extracts vcluster credentials from secrets
- Creates kubeconfig contexts with localhost endpoints
- Uses dedicated ports (8443 for dev, 8444 for staging)
- Configures insecure-skip-tls-verify for localhost connections

### 2. Connect to VCluster
Use the vcluster CLI to establish a connection:

**For Dev Environment:**
```bash
vcluster connect dev-vcluster-helm --namespace dev-vcluster --server https://localhost:8443
```

**For Staging Environment:**
```bash
vcluster connect staging-vcluster-helm --namespace staging-vcluster --server https://localhost:8444
```

### 3. Switch Context
After connection is established, switch to the vcluster context:
```bash
kubectl config use-context dev-vcluster
# OR
kubectl config use-context staging-vcluster
```

## Troubleshooting

### Certificate Errors
If you encounter certificate validation errors:
1. Ensure the merge script has been run recently
2. The script automatically sets `insecure-skip-tls-verify` for localhost connections

### Port Already in Use
If port 8443 or 8444 is already in use:
1. Kill any existing vcluster connect processes
2. Check for other services using these ports
3. Consider using alternative ports in the script

### Connection Refused
If connection is refused:
1. Ensure the vcluster is running: `kubectl get pods -n dev-vcluster`
2. Check the vcluster service is accessible: `kubectl get svc -n dev-vcluster`
3. Verify the port-forward is active (vcluster connect handles this automatically)

## Docker Desktop/WSL2 Considerations
The localhost approach bypasses common networking issues with Docker Desktop's WSL2 integration:
- Avoids DNS resolution problems with `.localtest.me` domains
- Works around certificate validation for custom domains
- Provides stable connection through Docker Desktop restarts

## Ingress Class Syncing
The vclusters are configured to sync the nginx ingress class from the host cluster:
- No separate ingress controller needed in vclusters
- Applications can create Ingress resources normally
- Host cluster's nginx handles all routing

## Environment-Specific Images
The multi-environment setup uses parameterized images from `/home/vpittamp/stacks/.env-files/images.json`:
- **Dev**: Uses devcontainer images (e.g., `ghcr.io/vpittamp/devspace-containers/typescript:20`)
- **Staging**: Uses built application images from CI/CD

## Quick Reference

### Connect to Dev VCluster
```bash
# Merge kubeconfigs (if not done recently)
./scripts/merge-vcluster-kubeconfigs.sh

# Connect
vcluster connect dev-vcluster-helm --namespace dev-vcluster --server https://localhost:8443

# Use context
kubectl config use-context dev-vcluster
```

### Connect to Staging VCluster
```bash
# Merge kubeconfigs (if not done recently)
./scripts/merge-vcluster-kubeconfigs.sh

# Connect
vcluster connect staging-vcluster-helm --namespace staging-vcluster --server https://localhost:8444

# Use context
kubectl config use-context staging-vcluster
```

### List All VCluster Contexts
```bash
kubectl config get-contexts | grep vcluster
```