import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { 
  ExternalSecret,
  ExternalSecretSpecTargetCreationPolicy,
  ExternalSecretSpecSecretStoreRefKind
} from '../../imports/external-secrets.io';

export interface AiPlatformEngineeringSecretsChartProps extends ChartProps {
  namespace?: string;
  secretStore?: string;
  refreshInterval?: string;
}

/**
 * Creates ExternalSecrets for AI Platform Engineering agents
 * These secrets are synchronized from Azure Key Vault to Kubernetes
 */
export class AiPlatformEngineeringSecretsChart extends Chart {
  constructor(scope: Construct, id: string, props: AiPlatformEngineeringSecretsChartProps = {}) {
    super(scope, id, props);

    const namespace = props.namespace || 'ai-platform-engineering';
    const secretStore = props.secretStore || 'azure-keyvault-store';
    const refreshInterval = props.refreshInterval || '1h';

    // Global secrets shared across all agents
    new ExternalSecret(this, 'global-secrets', {
      metadata: {
        name: 'ai-platform-global-secrets',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'ai-platform-engineering',
          'app.kubernetes.io/component': 'secrets',
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-50'
        }
      },
      spec: {
        refreshInterval,
        secretStoreRef: {
          name: secretStore,
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
        },
        target: {
          name: 'ai-platform-global-secrets',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER
        },
        data: [
          // LLM Provider Configuration
          { secretKey: 'LLM_PROVIDER', remoteRef: { key: 'ai-platform-engineering-global', property: 'LLM_PROVIDER' } },
          // Azure OpenAI
          { secretKey: 'AZURE_OPENAI_API_KEY', remoteRef: { key: 'ai-platform-engineering-global', property: 'AZURE_OPENAI_API_KEY' } },
          { secretKey: 'AZURE_OPENAI_ENDPOINT', remoteRef: { key: 'ai-platform-engineering-global', property: 'AZURE_OPENAI_ENDPOINT' } },
          { secretKey: 'AZURE_OPENAI_API_VERSION', remoteRef: { key: 'ai-platform-engineering-global', property: 'AZURE_OPENAI_API_VERSION' } },
          { secretKey: 'AZURE_OPENAI_DEPLOYMENT', remoteRef: { key: 'ai-platform-engineering-global', property: 'AZURE_OPENAI_DEPLOYMENT' } },
          // OpenAI
          { secretKey: 'OPENAI_API_KEY', remoteRef: { key: 'ai-platform-engineering-global', property: 'OPENAI_API_KEY' } },
          { secretKey: 'OPENAI_ENDPOINT', remoteRef: { key: 'ai-platform-engineering-global', property: 'OPENAI_ENDPOINT' } },
          { secretKey: 'OPENAI_MODEL_NAME', remoteRef: { key: 'ai-platform-engineering-global', property: 'OPENAI_MODEL_NAME' } },
          // AWS Bedrock
          { secretKey: 'AWS_ACCESS_KEY_ID', remoteRef: { key: 'ai-platform-engineering-global', property: 'AWS_ACCESS_KEY_ID' } },
          { secretKey: 'AWS_SECRET_ACCESS_KEY', remoteRef: { key: 'ai-platform-engineering-global', property: 'AWS_SECRET_ACCESS_KEY' } },
          { secretKey: 'AWS_REGION', remoteRef: { key: 'ai-platform-engineering-global', property: 'AWS_REGION' } },
          { secretKey: 'AWS_BEDROCK_MODEL_ID', remoteRef: { key: 'ai-platform-engineering-global', property: 'AWS_BEDROCK_MODEL_ID' } },
          { secretKey: 'AWS_BEDROCK_PROVIDER', remoteRef: { key: 'ai-platform-engineering-global', property: 'AWS_BEDROCK_PROVIDER' } }
        ]
      }
    });

    // ArgoCD Agent Secrets
    new ExternalSecret(this, 'argocd-secrets', {
      metadata: {
        name: 'agent-argocd-secret-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'agent-argocd',
          'app.kubernetes.io/component': 'secrets',
          'app.kubernetes.io/part-of': 'ai-platform-engineering',
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-49'
        }
      },
      spec: {
        refreshInterval,
        secretStoreRef: {
          name: secretStore,
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
        },
        target: {
          name: 'agent-argocd-secret',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER
        },
        data: [
          { secretKey: 'ARGOCD_TOKEN', remoteRef: { key: 'ai-platform-engineering-argocd', property: 'ARGOCD_TOKEN' } },
          { secretKey: 'ARGOCD_API_URL', remoteRef: { key: 'ai-platform-engineering-argocd', property: 'ARGOCD_API_URL' } },
          { secretKey: 'ARGOCD_VERIFY_SSL', remoteRef: { key: 'ai-platform-engineering-argocd', property: 'ARGOCD_VERIFY_SSL' } }
        ]
      }
    });

    // GitHub Agent Secrets
    new ExternalSecret(this, 'github-secrets', {
      metadata: {
        name: 'agent-github-secrets',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'agent-github',
          'app.kubernetes.io/component': 'secrets',
          'app.kubernetes.io/part-of': 'ai-platform-engineering',
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-49'
        }
      },
      spec: {
        refreshInterval,
        secretStoreRef: {
          name: secretStore,
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
        },
        target: {
          name: 'agent-github-secrets',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER
        },
        data: [
          { secretKey: 'GITHUB_PERSONAL_ACCESS_TOKEN', remoteRef: { key: 'ai-platform-engineering-github', property: 'GITHUB_PERSONAL_ACCESS_TOKEN' } }
        ]
      }
    });

    // Jira Agent Secrets
    new ExternalSecret(this, 'jira-secrets', {
      metadata: {
        name: 'agent-jira-secrets',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'agent-jira',
          'app.kubernetes.io/component': 'secrets',
          'app.kubernetes.io/part-of': 'ai-platform-engineering',
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-49'
        }
      },
      spec: {
        refreshInterval,
        secretStoreRef: {
          name: secretStore,
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
        },
        target: {
          name: 'agent-jira-secrets',
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

    // PagerDuty Agent Secrets
    new ExternalSecret(this, 'pagerduty-secrets', {
      metadata: {
        name: 'agent-pagerduty-secrets',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'agent-pagerduty',
          'app.kubernetes.io/component': 'secrets',
          'app.kubernetes.io/part-of': 'ai-platform-engineering',
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-49'
        }
      },
      spec: {
        refreshInterval,
        secretStoreRef: {
          name: secretStore,
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
        },
        target: {
          name: 'agent-pagerduty-secrets',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER
        },
        data: [
          { secretKey: 'PAGERDUTY_API_KEY', remoteRef: { key: 'ai-platform-engineering-pagerduty', property: 'PAGERDUTY_API_KEY' } },
          { secretKey: 'PAGERDUTY_API_URL', remoteRef: { key: 'ai-platform-engineering-pagerduty', property: 'PAGERDUTY_API_URL' } }
        ]
      }
    });

    // Slack Agent Secrets
    new ExternalSecret(this, 'slack-secrets', {
      metadata: {
        name: 'agent-slack-secrets',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'agent-slack',
          'app.kubernetes.io/component': 'secrets',
          'app.kubernetes.io/part-of': 'ai-platform-engineering',
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-49'
        }
      },
      spec: {
        refreshInterval,
        secretStoreRef: {
          name: secretStore,
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
        },
        target: {
          name: 'agent-slack-secrets',
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

    // Backstage Agent Secrets (if needed)
    new ExternalSecret(this, 'backstage-agent-secrets', {
      metadata: {
        name: 'agent-backstage-secrets',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'agent-backstage',
          'app.kubernetes.io/component': 'secrets',
          'app.kubernetes.io/part-of': 'ai-platform-engineering',
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-49'
        }
      },
      spec: {
        refreshInterval,
        secretStoreRef: {
          name: secretStore,
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
        },
        target: {
          name: 'agent-backstage-secrets',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER
        },
        // Add backstage-specific secrets if needed
        data: []
      }
    });
  }
}