import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { 
  ExternalSecret,
  ExternalSecretSpecTargetCreationPolicy,
  ExternalSecretSpecSecretStoreRefKind
} from '../../imports/external-secrets.io';
import { createEnvExternalSecret } from '../../lib/eso-helpers';
import { JsonPatch } from 'cdk8s';

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
    const global = createEnvExternalSecret(this, 'ai-platform-global-secrets-external', {
      externalName: 'ai-platform-global-secrets',
      name: 'ai-platform-global-secrets',
      namespace,
      refreshInterval,
      secretStoreRef: { name: secretStore, kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
      mappings: [
        { key: 'LLM_PROVIDER', remoteRef: { key: 'ai-platform-engineering-global', property: 'LLM_PROVIDER' } },
        { key: 'AZURE_OPENAI_API_KEY', remoteRef: { key: 'ai-platform-engineering-global', property: 'AZURE_OPENAI_API_KEY' } },
        { key: 'AZURE_OPENAI_ENDPOINT', remoteRef: { key: 'ai-platform-engineering-global', property: 'AZURE_OPENAI_ENDPOINT' } },
        { key: 'AZURE_OPENAI_API_VERSION', remoteRef: { key: 'ai-platform-engineering-global', property: 'AZURE_OPENAI_API_VERSION' } },
        { key: 'AZURE_OPENAI_DEPLOYMENT', remoteRef: { key: 'ai-platform-engineering-global', property: 'AZURE_OPENAI_DEPLOYMENT' } },
        { key: 'OPENAI_API_KEY', remoteRef: { key: 'ai-platform-engineering-global', property: 'OPENAI_API_KEY' } },
        { key: 'OPENAI_ENDPOINT', remoteRef: { key: 'ai-platform-engineering-global', property: 'OPENAI_ENDPOINT' } },
        { key: 'OPENAI_MODEL_NAME', remoteRef: { key: 'ai-platform-engineering-global', property: 'OPENAI_MODEL_NAME' } },
        { key: 'AWS_ACCESS_KEY_ID', remoteRef: { key: 'ai-platform-engineering-global', property: 'AWS_ACCESS_KEY_ID' } },
        { key: 'AWS_SECRET_ACCESS_KEY', remoteRef: { key: 'ai-platform-engineering-global', property: 'AWS_SECRET_ACCESS_KEY' } },
        { key: 'AWS_REGION', remoteRef: { key: 'ai-platform-engineering-global', property: 'AWS_REGION' } },
        { key: 'AWS_BEDROCK_MODEL_ID', remoteRef: { key: 'ai-platform-engineering-global', property: 'AWS_BEDROCK_MODEL_ID' } },
        { key: 'AWS_BEDROCK_PROVIDER', remoteRef: { key: 'ai-platform-engineering-global', property: 'AWS_BEDROCK_PROVIDER' } },
      ],
    });
    global.addJsonPatch(JsonPatch.add('/metadata/labels', {
      'app.kubernetes.io/name': 'ai-platform-engineering',
      'app.kubernetes.io/component': 'secrets',
      'app.kubernetes.io/managed-by': 'cdk8s'
    }));
    global.addJsonPatch(JsonPatch.add('/metadata/annotations', { 'argocd.argoproj.io/sync-wave': '-50' }));

    // ArgoCD Agent Secrets
    const argocd = createEnvExternalSecret(this, 'agent-argocd-secret-external', {
      externalName: 'agent-argocd-secret-external',
      name: 'agent-argocd-secret',
      namespace,
      refreshInterval,
      secretStoreRef: { name: secretStore, kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
      mappings: [
        { key: 'ARGOCD_TOKEN', remoteRef: { key: 'ai-platform-engineering-argocd', property: 'ARGOCD_TOKEN' } },
        { key: 'ARGOCD_API_URL', remoteRef: { key: 'ai-platform-engineering-argocd', property: 'ARGOCD_API_URL' } },
        { key: 'ARGOCD_VERIFY_SSL', remoteRef: { key: 'ai-platform-engineering-argocd', property: 'ARGOCD_VERIFY_SSL' } },
      ],
    });
    argocd.addJsonPatch(JsonPatch.add('/metadata/labels', {
      'app.kubernetes.io/name': 'agent-argocd',
      'app.kubernetes.io/component': 'secrets',
      'app.kubernetes.io/part-of': 'ai-platform-engineering',
      'app.kubernetes.io/managed-by': 'cdk8s'
    }));
    argocd.addJsonPatch(JsonPatch.add('/metadata/annotations', { 'argocd.argoproj.io/sync-wave': '-49' }));

    // GitHub Agent Secrets
    const github = createEnvExternalSecret(this, 'agent-github-secrets-external', {
      externalName: 'agent-github-secrets',
      name: 'agent-github-secrets',
      namespace,
      refreshInterval,
      secretStoreRef: { name: secretStore, kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
      mappings: [
        { key: 'GITHUB_PERSONAL_ACCESS_TOKEN', remoteRef: { key: 'ai-platform-engineering-github', property: 'GITHUB_PERSONAL_ACCESS_TOKEN' } },
      ],
    });
    github.addJsonPatch(JsonPatch.add('/metadata/labels', {
      'app.kubernetes.io/name': 'agent-github',
      'app.kubernetes.io/component': 'secrets',
      'app.kubernetes.io/part-of': 'ai-platform-engineering',
      'app.kubernetes.io/managed-by': 'cdk8s'
    }));
    github.addJsonPatch(JsonPatch.add('/metadata/annotations', { 'argocd.argoproj.io/sync-wave': '-49' }));

    // Jira Agent Secrets
    const jira = createEnvExternalSecret(this, 'agent-jira-secrets-external', {
      externalName: 'agent-jira-secrets',
      name: 'agent-jira-secrets',
      namespace,
      refreshInterval,
      secretStoreRef: { name: secretStore, kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
      mappings: [
        { key: 'ATLASSIAN_TOKEN', remoteRef: { key: 'ai-platform-engineering-jira', property: 'ATLASSIAN_TOKEN' } },
        { key: 'ATLASSIAN_EMAIL', remoteRef: { key: 'ai-platform-engineering-jira', property: 'ATLASSIAN_EMAIL' } },
        { key: 'ATLASSIAN_API_URL', remoteRef: { key: 'ai-platform-engineering-jira', property: 'ATLASSIAN_API_URL' } },
        { key: 'ATLASSIAN_VERIFY_SSL', remoteRef: { key: 'ai-platform-engineering-jira', property: 'ATLASSIAN_VERIFY_SSL' } },
      ],
    });
    jira.addJsonPatch(JsonPatch.add('/metadata/labels', {
      'app.kubernetes.io/name': 'agent-jira',
      'app.kubernetes.io/component': 'secrets',
      'app.kubernetes.io/part-of': 'ai-platform-engineering',
      'app.kubernetes.io/managed-by': 'cdk8s'
    }));
    jira.addJsonPatch(JsonPatch.add('/metadata/annotations', { 'argocd.argoproj.io/sync-wave': '-49' }));

    // PagerDuty Agent Secrets
    const pagerduty = createEnvExternalSecret(this, 'agent-pagerduty-secrets-external', {
      externalName: 'agent-pagerduty-secrets',
      name: 'agent-pagerduty-secrets',
      namespace,
      refreshInterval,
      secretStoreRef: { name: secretStore, kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
      mappings: [
        { key: 'PAGERDUTY_API_KEY', remoteRef: { key: 'ai-platform-engineering-pagerduty', property: 'PAGERDUTY_API_KEY' } },
        { key: 'PAGERDUTY_API_URL', remoteRef: { key: 'ai-platform-engineering-pagerduty', property: 'PAGERDUTY_API_URL' } },
      ],
    });
    pagerduty.addJsonPatch(JsonPatch.add('/metadata/labels', {
      'app.kubernetes.io/name': 'agent-pagerduty',
      'app.kubernetes.io/component': 'secrets',
      'app.kubernetes.io/part-of': 'ai-platform-engineering',
      'app.kubernetes.io/managed-by': 'cdk8s'
    }));
    pagerduty.addJsonPatch(JsonPatch.add('/metadata/annotations', { 'argocd.argoproj.io/sync-wave': '-49' }));

    // Slack Agent Secrets
    const slack = createEnvExternalSecret(this, 'agent-slack-secrets-external', {
      externalName: 'agent-slack-secrets',
      name: 'agent-slack-secrets',
      namespace,
      refreshInterval,
      secretStoreRef: { name: secretStore, kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
      mappings: [
        { key: 'SLACK_BOT_TOKEN', remoteRef: { key: 'ai-platform-engineering-slack', property: 'SLACK_BOT_TOKEN' } },
        { key: 'SLACK_APP_TOKEN', remoteRef: { key: 'ai-platform-engineering-slack', property: 'SLACK_APP_TOKEN' } },
        { key: 'SLACK_SIGNING_SECRET', remoteRef: { key: 'ai-platform-engineering-slack', property: 'SLACK_SIGNING_SECRET' } },
        { key: 'SLACK_CLIENT_SECRET', remoteRef: { key: 'ai-platform-engineering-slack', property: 'SLACK_CLIENT_SECRET' } },
        { key: 'SLACK_TEAM_ID', remoteRef: { key: 'ai-platform-engineering-slack', property: 'SLACK_TEAM_ID' } },
      ],
    });
    slack.addJsonPatch(JsonPatch.add('/metadata/labels', {
      'app.kubernetes.io/name': 'agent-slack',
      'app.kubernetes.io/component': 'secrets',
      'app.kubernetes.io/part-of': 'ai-platform-engineering',
      'app.kubernetes.io/managed-by': 'cdk8s'
    }));
    slack.addJsonPatch(JsonPatch.add('/metadata/annotations', { 'argocd.argoproj.io/sync-wave': '-49' }));

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
