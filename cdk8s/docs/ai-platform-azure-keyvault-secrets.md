# AI Platform Engineering - Azure Key Vault Secret Structure

This document outlines the Azure Key Vault secret structure required for the AI Platform Engineering deployment.

## Prerequisites

1. Azure Key Vault instance created and accessible
2. Azure Workload Identity configured for the external-secrets service account
3. External Secrets Operator installed in the cluster

## Secret Structure

All secrets for AI Platform Engineering should be created in Azure Key Vault with the following naming convention:

### Global Secrets (Shared Across All Agents)
**Key Vault Secret Name:** `ai-platform-engineering-global`

```json
{
  "LLM_PROVIDER": "openai | azure-openai | aws-bedrock",
  "AZURE_OPENAI_API_KEY": "<your-azure-openai-api-key>",
  "AZURE_OPENAI_ENDPOINT": "<your-azure-openai-endpoint>",
  "AZURE_OPENAI_API_VERSION": "2024-02-15-preview",
  "AZURE_OPENAI_DEPLOYMENT": "<your-deployment-name>",
  "OPENAI_API_KEY": "<your-openai-api-key>",
  "OPENAI_ENDPOINT": "https://api.openai.com/v1",
  "OPENAI_MODEL_NAME": "gpt-4",
  "AWS_ACCESS_KEY_ID": "<your-aws-access-key>",
  "AWS_SECRET_ACCESS_KEY": "<your-aws-secret-key>",
  "AWS_REGION": "us-east-1",
  "AWS_BEDROCK_MODEL_ID": "<bedrock-model-id>",
  "AWS_BEDROCK_PROVIDER": "<bedrock-provider>"
}
```

### Agent-Specific Secrets

#### ArgoCD Agent
**Key Vault Secret Name:** `ai-platform-engineering-argocd`

```json
{
  "ARGOCD_TOKEN": "<argocd-api-token>",
  "ARGOCD_API_URL": "https://argocd.example.com",
  "ARGOCD_VERIFY_SSL": "true"
}
```

#### GitHub Agent
**Key Vault Secret Name:** `ai-platform-engineering-github`

```json
{
  "GITHUB_PERSONAL_ACCESS_TOKEN": "<github-pat-token>"
}
```

#### Jira Agent
**Key Vault Secret Name:** `ai-platform-engineering-jira`

```json
{
  "ATLASSIAN_TOKEN": "<atlassian-api-token>",
  "ATLASSIAN_EMAIL": "<your-atlassian-email>",
  "ATLASSIAN_API_URL": "https://your-domain.atlassian.net",
  "ATLASSIAN_VERIFY_SSL": "true"
}
```

#### PagerDuty Agent
**Key Vault Secret Name:** `ai-platform-engineering-pagerduty`

```json
{
  "PAGERDUTY_API_KEY": "<pagerduty-api-key>",
  "PAGERDUTY_API_URL": "https://api.pagerduty.com"
}
```

#### Slack Agent
**Key Vault Secret Name:** `ai-platform-engineering-slack`

```json
{
  "SLACK_BOT_TOKEN": "xoxb-your-bot-token",
  "SLACK_APP_TOKEN": "xapp-your-app-token",
  "SLACK_SIGNING_SECRET": "<signing-secret>",
  "SLACK_CLIENT_SECRET": "<client-secret>",
  "SLACK_TEAM_ID": "<team-id>"
}
```

## Creating Secrets in Azure Key Vault

### Using Azure CLI

```bash
# Set your Key Vault name
export KEYVAULT_NAME="your-keyvault-name"

# Create global secrets
az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name "ai-platform-engineering-global" \
  --value '{"LLM_PROVIDER":"openai","OPENAI_API_KEY":"your-key"}'

# Create ArgoCD secrets
az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name "ai-platform-engineering-argocd" \
  --value '{"ARGOCD_TOKEN":"your-token","ARGOCD_API_URL":"https://argocd.example.com","ARGOCD_VERIFY_SSL":"true"}'

# Repeat for other agents...
```

### Using Azure Portal

1. Navigate to your Key Vault in Azure Portal
2. Go to "Secrets" section
3. Click "+ Generate/Import"
4. For each secret:
   - Name: Use the secret names defined above
   - Value: JSON string with all required fields
   - Content type: `application/json` (optional but recommended)

## Kubernetes Integration

The secrets will be synchronized to Kubernetes using External Secrets Operator. Each agent will have its own ExternalSecret resource that references the appropriate Azure Key Vault secret.

Example ExternalSecret for ArgoCD agent:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: agent-argocd-secrets
  namespace: ai-platform-engineering
spec:
  secretStoreRef:
    name: azure-keyvault-store
    kind: ClusterSecretStore
  target:
    name: agent-argocd-secrets
  data:
    - secretKey: ARGOCD_TOKEN
      remoteRef:
        key: ai-platform-engineering-argocd
        property: ARGOCD_TOKEN
    - secretKey: ARGOCD_API_URL
      remoteRef:
        key: ai-platform-engineering-argocd
        property: ARGOCD_API_URL
    - secretKey: ARGOCD_VERIFY_SSL
      remoteRef:
        key: ai-platform-engineering-argocd
        property: ARGOCD_VERIFY_SSL
```

## Security Best Practices

1. **Least Privilege Access**: Grant only the minimum required permissions to the Workload Identity
2. **Secret Rotation**: Implement regular rotation of API keys and tokens
3. **Audit Logging**: Enable Azure Key Vault audit logging to track access
4. **Environment Separation**: Use separate Key Vaults for dev/staging/production
5. **Backup**: Enable Key Vault backup and soft-delete protection

## Troubleshooting

### Common Issues

1. **ExternalSecret not syncing**
   - Check External Secrets Operator logs
   - Verify Workload Identity permissions
   - Ensure secret exists in Key Vault with correct name

2. **Permission Denied**
   - Verify the external-secrets service account has the correct Azure Workload Identity annotations
   - Check Azure RBAC permissions for the identity

3. **Invalid Secret Format**
   - Ensure secrets are valid JSON when storing complex values
   - Use Azure CLI or portal's validation features

## Migration from Vault

To migrate existing secrets from HashiCorp Vault to Azure Key Vault, use the provided migration script:

```bash
npm run migrate-secrets-to-azure
```

This script will:
1. Connect to the local Vault instance
2. Read all ai-platform-engineering secrets
3. Format them appropriately
4. Create them in Azure Key Vault