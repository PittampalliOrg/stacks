import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../../imports/k8s';
import { 
  ExternalSecretV1Beta1 as ExternalSecret,
  ExternalSecretV1Beta1SpecTargetCreationPolicy as ExternalSecretSpecTargetCreationPolicy
} from '../../imports/external-secrets.io';

export interface AiPlatformAzureSecretsChartProps extends ChartProps {
  namespace?: string;
}

/**
 * Simplified secrets chart for AI Platform Engineering
 * - External secrets from Azure Key Vault for API keys
 * - The Helm chart will create the actual Kubernetes secrets
 * - ExternalSecrets will populate them with data from Azure Key Vault
 */
export class AiPlatformAzureSecretsChart extends Chart {
  constructor(scope: Construct, id: string, props: AiPlatformAzureSecretsChartProps = {}) {
    super(scope, id, props);

    const namespace = props.namespace || 'ai-platform-engineering';

    // LLM secrets from Azure Key Vault (used by all agents)
    new ExternalSecret(this, 'llm-secrets', {
      metadata: {
        name: 'llm-secret-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'ai-platform-engineering',
          'app.kubernetes.io/component': 'external-secrets',
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-60'  // Before Helm deployment
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore'
        },
        target: {
          name: 'llm-secret',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER  // Create secret if it doesn't exist
        },
        data: [
          { secretKey: 'LLM_PROVIDER', remoteRef: { key: 'ai-platform-engineering-global', property: 'LLM_PROVIDER' } },
          { secretKey: 'OPENAI_API_KEY', remoteRef: { key: 'ai-platform-engineering-global', property: 'OPENAI_API_KEY' } },
          { secretKey: 'OPENAI_ENDPOINT', remoteRef: { key: 'ai-platform-engineering-global', property: 'OPENAI_ENDPOINT' } },
          { secretKey: 'OPENAI_MODEL_NAME', remoteRef: { key: 'ai-platform-engineering-global', property: 'OPENAI_MODEL_NAME' } },
          { secretKey: 'AZURE_OPENAI_API_KEY', remoteRef: { key: 'ai-platform-engineering-global', property: 'AZURE_OPENAI_API_KEY' } },
          { secretKey: 'AZURE_OPENAI_ENDPOINT', remoteRef: { key: 'ai-platform-engineering-global', property: 'AZURE_OPENAI_ENDPOINT' } },
          { secretKey: 'AZURE_OPENAI_API_VERSION', remoteRef: { key: 'ai-platform-engineering-global', property: 'AZURE_OPENAI_API_VERSION' } },
          { secretKey: 'AZURE_OPENAI_DEPLOYMENT', remoteRef: { key: 'ai-platform-engineering-global', property: 'AZURE_OPENAI_DEPLOYMENT' } },
          { secretKey: 'AWS_ACCESS_KEY_ID', remoteRef: { key: 'ai-platform-engineering-global', property: 'AWS_ACCESS_KEY_ID' } },
          { secretKey: 'AWS_SECRET_ACCESS_KEY', remoteRef: { key: 'ai-platform-engineering-global', property: 'AWS_SECRET_ACCESS_KEY' } },
          { secretKey: 'AWS_REGION', remoteRef: { key: 'ai-platform-engineering-global', property: 'AWS_REGION' } },
          { secretKey: 'AWS_BEDROCK_MODEL_ID', remoteRef: { key: 'ai-platform-engineering-global', property: 'AWS_BEDROCK_MODEL_ID' } },
          { secretKey: 'AWS_BEDROCK_PROVIDER', remoteRef: { key: 'ai-platform-engineering-global', property: 'AWS_BEDROCK_PROVIDER' } }
        ]
      }
    });

    // GitHub secrets from Azure Key Vault
    new ExternalSecret(this, 'github-secrets', {
      metadata: {
        name: 'agent-github-secret-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'agent-github',
          'app.kubernetes.io/component': 'external-secrets',
          'app.kubernetes.io/part-of': 'ai-platform-engineering',
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-60'
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore'
        },
        target: {
          name: 'agent-github-secret',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER
        },
        data: [
          { secretKey: 'GITHUB_PERSONAL_ACCESS_TOKEN', remoteRef: { key: 'ai-platform-engineering-github', property: 'GITHUB_PERSONAL_ACCESS_TOKEN' } }
        ]
      }
    });

    // Jira secrets from Azure Key Vault
    new ExternalSecret(this, 'jira-secrets', {
      metadata: {
        name: 'agent-jira-secret-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'agent-jira',
          'app.kubernetes.io/component': 'external-secrets',
          'app.kubernetes.io/part-of': 'ai-platform-engineering',
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-60'
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore'
        },
        target: {
          name: 'agent-jira-secret',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER
        },
        data: [
          { secretKey: 'ATLASSIAN_TOKEN', remoteRef: { key: 'ai-platform-engineering-jira', property: 'ATLASSIAN_TOKEN' } },
          { secretKey: 'ATLASSIAN_EMAIL', remoteRef: { key: 'ai-platform-engineering-jira', property: 'ATLASSIAN_EMAIL' } },
          { secretKey: 'ATLASSIAN_API_URL', remoteRef: { key: 'ai-platform-engineering-jira', property: 'ATLASSIAN_API_URL' } },
          { secretKey: 'ATLASSIAN_VERIFY_SSL', remoteRef: { key: 'ai-platform-engineering-jira', property: 'ATLASSIAN_VERIFY_SSL' } }
        ]
      }
    });

    // PagerDuty secrets from Azure Key Vault
    new ExternalSecret(this, 'pagerduty-secrets', {
      metadata: {
        name: 'agent-pagerduty-secret-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'agent-pagerduty',
          'app.kubernetes.io/component': 'external-secrets',
          'app.kubernetes.io/part-of': 'ai-platform-engineering',
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-60'
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore'
        },
        target: {
          name: 'agent-pagerduty-secret',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER
        },
        data: [
          { secretKey: 'PAGERDUTY_API_KEY', remoteRef: { key: 'ai-platform-engineering-pagerduty', property: 'PAGERDUTY_API_KEY' } },
          { secretKey: 'PAGERDUTY_API_URL', remoteRef: { key: 'ai-platform-engineering-pagerduty', property: 'PAGERDUTY_API_URL' } }
        ]
      }
    });

    // Slack secrets from Azure Key Vault
    new ExternalSecret(this, 'slack-secrets', {
      metadata: {
        name: 'agent-slack-secret-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'agent-slack',
          'app.kubernetes.io/component': 'external-secrets',
          'app.kubernetes.io/part-of': 'ai-platform-engineering',
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-60'
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore'
        },
        target: {
          name: 'agent-slack-secret',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER
        },
        data: [
          { secretKey: 'SLACK_BOT_TOKEN', remoteRef: { key: 'ai-platform-engineering-slack', property: 'SLACK_BOT_TOKEN' } },
          { secretKey: 'SLACK_APP_TOKEN', remoteRef: { key: 'ai-platform-engineering-slack', property: 'SLACK_APP_TOKEN' } },
          { secretKey: 'SLACK_SIGNING_SECRET', remoteRef: { key: 'ai-platform-engineering-slack', property: 'SLACK_SIGNING_SECRET' } },
          { secretKey: 'SLACK_CLIENT_SECRET', remoteRef: { key: 'ai-platform-engineering-slack', property: 'SLACK_CLIENT_SECRET' } },
          { secretKey: 'SLACK_TEAM_ID', remoteRef: { key: 'ai-platform-engineering-slack', property: 'SLACK_TEAM_ID' } }
        ]
      }
    });

    // Note: ArgoCD secret is handled differently
    // The Helm chart creates the ArgoCD secret, but we don't have ArgoCD credentials in Azure Key Vault
    // ArgoCD token needs to be populated through a different mechanism (e.g., Job or manual configuration)
  }
}