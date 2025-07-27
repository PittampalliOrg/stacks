# Keycloak Headlamp Client Secret Setup

## Overview
The Keycloak client secret for Headlamp is now managed through External Secrets Operator (ESO) and Azure Key Vault. This removes the hardcoded secret from the codebase and provides secure secret management.

## Azure Key Vault Setup

### 1. Add Secret to Azure Key Vault
Add a secret named `KEYCLOAK-HEADLAMP-CLIENT-SECRET` to your Azure Key Vault with the actual client secret value.

```bash
# Example using Azure CLI
az keyvault secret set \
  --vault-name <your-keyvault-name> \
  --name "KEYCLOAK-HEADLAMP-CLIENT-SECRET" \
  --value "<your-client-secret>"
```

### 2. How It Works
1. The External Secret in the `keycloak` namespace references the Azure Key Vault secret
2. ESO fetches the secret from Azure Key Vault every hour (configurable)
3. ESO creates/updates the `headlamp-client-credentials` Kubernetes secret
4. The existing `headlamp-keycloak-secrets-chart` references this secret

### 3. Verify the Setup
```bash
# Check if the ExternalSecret is created
kubectl get externalsecret -n keycloak headlamp-client-external-secret

# Check if the secret is synchronized
kubectl get secret -n keycloak headlamp-client-credentials

# Verify the secret contains the correct data
kubectl get secret -n keycloak headlamp-client-credentials -o jsonpath='{.data.client-id}' | base64 -d
kubectl get secret -n keycloak headlamp-client-credentials -o jsonpath='{.data.client-secret}' | base64 -d
```

## File Changes
- Modified: `/home/vscode/workspace/stacks/cdk8s/charts/keycloak-headlamp-client-chart.ts`
  - Replaced hardcoded secret with ExternalSecret resource
  - Secret now fetched from Azure Key Vault via key `KEYCLOAK-HEADLAMP-CLIENT-SECRET`

## Benefits
- No sensitive data in source code
- Centralized secret management
- Automatic secret rotation capability
- Audit trail in Azure Key Vault
- Follows existing pattern used for other secrets in the stack