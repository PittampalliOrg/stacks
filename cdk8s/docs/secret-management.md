# Secret Management Guide

This guide covers secret management strategies for the platform, including both HashiCorp Vault and Azure Key Vault integration.

## Overview

The platform supports two primary secret management approaches:

1. **HashiCorp Vault** (Default) - Local secret storage, ideal for development
2. **Azure Key Vault** - Cloud-based secret storage with persistence across cluster recreations

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│   Azure Key Vault   │     │  HashiCorp Vault    │
│  (Cloud Storage)    │     │  (Local Storage)    │
└──────────┬──────────┘     └──────────┬──────────┘
           │                           │
           │                           │
      ┌────▼───────────────────────────▼────┐
      │     External Secrets Operator        │
      │  (Syncs secrets to Kubernetes)       │
      └────────────────┬─────────────────────┘
                       │
      ┌────────────────▼─────────────────────┐
      │         Kubernetes Secrets           │
      │    (Consumed by applications)        │
      └──────────────────────────────────────┘
```

## Configuration Options

### Option 1: HashiCorp Vault (Default)

This is the default configuration that uses a local Vault instance:

```typescript
// In config/applications.ts
{
  name: 'ai-platform-engineering',
  namespace: 'ai-platform-engineering',
  chart: {
    type: 'AiPlatformEngineeringChart'
  }
}
```

**Pros:**
- Works offline
- Fast secret access
- No cloud dependencies

**Cons:**
- Secrets lost on cluster recreation
- Manual backup required
- No built-in high availability

### Option 2: Azure Key Vault (Recommended for Production)

For persistent secret storage across cluster recreations:

```typescript
// In config/applications.ts
import { aiPlatformAzureConfig } from './ai-platform-azure-config';

// Replace the existing ai-platform-engineering config with:
aiPlatformAzureConfig,
```

**Pros:**
- Secrets persist across cluster recreations
- Enterprise-grade security
- Built-in backup and recovery
- Audit logging
- RBAC support

**Cons:**
- Requires Azure subscription
- Network dependency
- Slightly higher latency

## Setting Up Azure Key Vault Integration

### Prerequisites

1. Azure subscription with Key Vault created
2. Azure Workload Identity configured
3. External Secrets Operator installed

### Step 1: Configure Environment

```bash
# Set Azure Key Vault name
export AZURE_KEYVAULT_NAME="your-keyvault-name"

# Set Azure tenant and client IDs for Workload Identity
export AZURE_TENANT_ID="your-tenant-id"
export AZURE_CLIENT_ID="your-client-id"

# Configure AI Platform to use Azure Key Vault
export AI_PLATFORM_SECRET_STORE="azure-keyvault-store"
```

### Step 2: Create Secrets in Azure Key Vault

You can create secrets manually or use the migration script:

#### Manual Creation

```bash
# Create global secrets
az keyvault secret set \
  --vault-name $AZURE_KEYVAULT_NAME \
  --name "ai-platform-engineering-global" \
  --value '{"LLM_PROVIDER":"openai","OPENAI_API_KEY":"your-key"}'
```

#### Using Migration Script

If you have existing secrets in Vault:

```bash
# Set Vault connection details
export VAULT_ADDR="http://localhost:8200"
export VAULT_TOKEN="your-vault-token"

# Run migration
npm run migrate-secrets-to-azure
```

### Step 3: Update Application Configuration

1. Edit `config/applications.ts`:

```typescript
import { aiPlatformAzureConfig } from './ai-platform-azure-config';

// Find and replace the ai-platform-engineering entry with:
aiPlatformAzureConfig,
```

2. Synthesize and deploy:

```bash
npm run synth
# Deploy through ArgoCD or kubectl
```

## Secret Structure

### AI Platform Engineering Secrets

| Secret Name | Azure Key Vault Name | Description |
|------------|---------------------|-------------|
| Global | `ai-platform-engineering-global` | LLM provider settings |
| ArgoCD | `ai-platform-engineering-argocd` | ArgoCD API credentials |
| GitHub | `ai-platform-engineering-github` | GitHub PAT token |
| Jira | `ai-platform-engineering-jira` | Atlassian API credentials |
| PagerDuty | `ai-platform-engineering-pagerduty` | PagerDuty API key |
| Slack | `ai-platform-engineering-slack` | Slack bot tokens |

### Other Application Secrets

| Application | Secret Store | Notes |
|------------|--------------|-------|
| NextJS | Azure Key Vault | Uses `azure-keyvault-store` |
| Backstage | Azure Key Vault | GitHub App credentials |
| Headlamp | Azure Key Vault | Keycloak client credentials |

## Troubleshooting

### External Secrets Not Syncing

1. Check External Secrets Operator logs:
```bash
kubectl logs -n external-secrets deployment/external-secrets -f
```

2. Verify ExternalSecret status:
```bash
kubectl get externalsecret -n ai-platform-engineering
kubectl describe externalsecret <name> -n ai-platform-engineering
```

3. Check ClusterSecretStore:
```bash
kubectl get clustersecretstore
kubectl describe clustersecretstore azure-keyvault-store
```

### Permission Issues

1. Verify Workload Identity:
```bash
kubectl get sa external-secrets -n external-secrets -o yaml
```

2. Check Azure RBAC:
```bash
az keyvault show --name $AZURE_KEYVAULT_NAME
az role assignment list --scope /subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.KeyVault/vaults/<vault-name>
```

### Secret Format Issues

Ensure secrets in Azure Key Vault are valid JSON:

```bash
# Get and validate secret
az keyvault secret show --vault-name $AZURE_KEYVAULT_NAME --name "ai-platform-engineering-global" --query value -o tsv | jq .
```

## Best Practices

1. **Environment Separation**: Use different Key Vaults for dev/staging/production
2. **Secret Rotation**: Implement regular rotation schedules
3. **Least Privilege**: Grant minimal required permissions
4. **Monitoring**: Enable audit logging and alerts
5. **Backup**: Enable Key Vault soft-delete and backup

## Migration Strategies

### From Vault to Azure Key Vault

1. Run migration script to copy existing secrets
2. Verify all secrets are correctly migrated
3. Update application configuration
4. Test with a single application first
5. Roll out to all applications

### From Azure Key Vault to Vault

1. Export secrets from Azure Key Vault
2. Import into Vault using vault CLI
3. Update application configurations
4. Verify all applications can access secrets

## Security Considerations

1. **Network Security**: Restrict Key Vault network access
2. **Authentication**: Use Workload Identity, not service principals
3. **Encryption**: Enable encryption at rest
4. **Auditing**: Enable diagnostic logs
5. **Access Control**: Use Azure RBAC for fine-grained permissions

## References

- [Azure Key Vault Documentation](https://docs.microsoft.com/en-us/azure/key-vault/)
- [External Secrets Operator](https://external-secrets.io/)
- [Azure Workload Identity](https://azure.github.io/azure-workload-identity/)
- [HashiCorp Vault](https://www.vaultproject.io/)