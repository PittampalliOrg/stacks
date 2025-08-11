import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../../imports/k8s';
import { 
  ExternalSecret,
  ExternalSecretSpecTargetCreationPolicy,
  ExternalSecretSpecSecretStoreRefKind
} from '../../imports/external-secrets.io';
import { createEnvExternalSecret } from '../../lib/eso-helpers';
import { JsonPatch } from 'cdk8s';

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
    const llm = createEnvExternalSecret(this, 'llm-secrets-external', {
      externalName: 'llm-secret-external',
      name: 'llm-secret',
      namespace,
      refreshInterval: '1h',
      secretStoreRef: { name: 'azure-keyvault-store', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
      mappings: [
        { key: 'LLM_PROVIDER', remoteRef: { key: 'ai-platform-engineering-global', property: 'LLM_PROVIDER' } },
        { key: 'OPENAI_API_KEY', remoteRef: { key: 'ai-platform-engineering-global', property: 'OPENAI_API_KEY' } },
        { key: 'OPENAI_ENDPOINT', remoteRef: { key: 'ai-platform-engineering-global', property: 'OPENAI_ENDPOINT' } },
        { key: 'OPENAI_MODEL_NAME', remoteRef: { key: 'ai-platform-engineering-global', property: 'OPENAI_MODEL_NAME' } },
        { key: 'AZURE_OPENAI_API_KEY', remoteRef: { key: 'ai-platform-engineering-global', property: 'AZURE_OPENAI_API_KEY' } },
        { key: 'AZURE_OPENAI_ENDPOINT', remoteRef: { key: 'ai-platform-engineering-global', property: 'AZURE_OPENAI_ENDPOINT' } },
        { key: 'AZURE_OPENAI_API_VERSION', remoteRef: { key: 'ai-platform-engineering-global', property: 'AZURE_OPENAI_API_VERSION' } },
        { key: 'AZURE_OPENAI_DEPLOYMENT', remoteRef: { key: 'ai-platform-engineering-global', property: 'AZURE_OPENAI_DEPLOYMENT' } },
        { key: 'AWS_ACCESS_KEY_ID', remoteRef: { key: 'ai-platform-engineering-global', property: 'AWS_ACCESS_KEY_ID' } },
        { key: 'AWS_SECRET_ACCESS_KEY', remoteRef: { key: 'ai-platform-engineering-global', property: 'AWS_SECRET_ACCESS_KEY' } },
        { key: 'AWS_REGION', remoteRef: { key: 'ai-platform-engineering-global', property: 'AWS_REGION' } },
        { key: 'AWS_BEDROCK_MODEL_ID', remoteRef: { key: 'ai-platform-engineering-global', property: 'AWS_BEDROCK_MODEL_ID' } },
        { key: 'AWS_BEDROCK_PROVIDER', remoteRef: { key: 'ai-platform-engineering-global', property: 'AWS_BEDROCK_PROVIDER' } },
      ],
    });
    llm.addJsonPatch(JsonPatch.add('/metadata/labels', {
      'app.kubernetes.io/name': 'ai-platform-engineering',
      'app.kubernetes.io/component': 'external-secrets',
      'app.kubernetes.io/managed-by': 'cdk8s'
    }));
    llm.addJsonPatch(JsonPatch.add('/metadata/annotations', { 'argocd.argoproj.io/sync-wave': '-60' }));

    // GitHub secrets from Azure Key Vault
    const github = createEnvExternalSecret(this, 'agent-github-secret-external', {
      externalName: 'agent-github-secret-external',
      name: 'agent-github-secret',
      namespace,
      refreshInterval: '1h',
      secretStoreRef: { name: 'azure-keyvault-store', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
      mappings: [ { key: 'GITHUB_PERSONAL_ACCESS_TOKEN', remoteRef: { key: 'ai-platform-engineering-github', property: 'GITHUB_PERSONAL_ACCESS_TOKEN' } } ],
    });
    github.addJsonPatch(JsonPatch.add('/metadata/labels', {
      'app.kubernetes.io/name': 'agent-github',
      'app.kubernetes.io/component': 'external-secrets',
      'app.kubernetes.io/part-of': 'ai-platform-engineering',
      'app.kubernetes.io/managed-by': 'cdk8s'
    }));
    github.addJsonPatch(JsonPatch.add('/metadata/annotations', { 'argocd.argoproj.io/sync-wave': '-60' }));

    // Jira secrets from Azure Key Vault
    const jira = createEnvExternalSecret(this, 'agent-jira-secret-external', {
      externalName: 'agent-jira-secret-external',
      name: 'agent-jira-secret',
      namespace,
      refreshInterval: '1h',
      secretStoreRef: { name: 'azure-keyvault-store', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
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
      'app.kubernetes.io/component': 'external-secrets',
      'app.kubernetes.io/part-of': 'ai-platform-engineering',
      'app.kubernetes.io/managed-by': 'cdk8s'
    }));
    jira.addJsonPatch(JsonPatch.add('/metadata/annotations', { 'argocd.argoproj.io/sync-wave': '-60' }));

    // PagerDuty secrets from Azure Key Vault
    const pagerduty = createEnvExternalSecret(this, 'agent-pagerduty-secret-external', {
      externalName: 'agent-pagerduty-secret-external',
      name: 'agent-pagerduty-secret',
      namespace,
      refreshInterval: '1h',
      secretStoreRef: { name: 'azure-keyvault-store', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
      mappings: [
        { key: 'PAGERDUTY_API_KEY', remoteRef: { key: 'ai-platform-engineering-pagerduty', property: 'PAGERDUTY_API_KEY' } },
        { key: 'PAGERDUTY_API_URL', remoteRef: { key: 'ai-platform-engineering-pagerduty', property: 'PAGERDUTY_API_URL' } },
      ],
    });
    pagerduty.addJsonPatch(JsonPatch.add('/metadata/labels', {
      'app.kubernetes.io/name': 'agent-pagerduty',
      'app.kubernetes.io/component': 'external-secrets',
      'app.kubernetes.io/part-of': 'ai-platform-engineering',
      'app.kubernetes.io/managed-by': 'cdk8s'
    }));
    pagerduty.addJsonPatch(JsonPatch.add('/metadata/annotations', { 'argocd.argoproj.io/sync-wave': '-60' }));

    // Slack secrets from Azure Key Vault
    const slack = createEnvExternalSecret(this, 'agent-slack-secret-external', {
      externalName: 'agent-slack-secret-external',
      name: 'agent-slack-secret',
      namespace,
      refreshInterval: '1h',
      secretStoreRef: { name: 'azure-keyvault-store', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
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
      'app.kubernetes.io/component': 'external-secrets',
      'app.kubernetes.io/part-of': 'ai-platform-engineering',
      'app.kubernetes.io/managed-by': 'cdk8s'
    }));
    slack.addJsonPatch(JsonPatch.add('/metadata/annotations', { 'argocd.argoproj.io/sync-wave': '-60' }));

    // Backstage secrets from Azure Key Vault
    const backstage = createEnvExternalSecret(this, 'agent-backstage-secret-external', {
      externalName: 'agent-backstage-secret-external',
      name: 'agent-backstage-secret',
      namespace,
      refreshInterval: '1h',
      secretStoreRef: { name: 'azure-keyvault-store', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
      mappings: [
        { key: 'BACKSTAGE_API_TOKEN', remoteRef: { key: 'ai-platform-engineering-backstage', property: 'BACKSTAGE_API_TOKEN' } },
        { key: 'BACKSTAGE_API_URL', remoteRef: { key: 'ai-platform-engineering-backstage', property: 'BACKSTAGE_API_URL' } },
        { key: 'BACKSTAGE_URL', remoteRef: { key: 'ai-platform-engineering-backstage', property: 'BACKSTAGE_URL' } },
      ],
    });
    backstage.addJsonPatch(JsonPatch.add('/metadata/labels', {
      'app.kubernetes.io/name': 'agent-backstage',
      'app.kubernetes.io/component': 'external-secrets',
      'app.kubernetes.io/part-of': 'ai-platform-engineering',
      'app.kubernetes.io/managed-by': 'cdk8s'
    }));
    backstage.addJsonPatch(JsonPatch.add('/metadata/annotations', { 'argocd.argoproj.io/sync-wave': '-60' }));

    // ArgoCD secrets from Azure Key Vault
    const argocd = createEnvExternalSecret(this, 'agent-argocd-secret-external', {
      externalName: 'agent-argocd-secret-external',
      name: 'agent-argocd-secret',
      namespace,
      refreshInterval: '1h',
      secretStoreRef: { name: 'azure-keyvault-store', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
      mappings: [
        { key: 'ARGOCD_TOKEN', remoteRef: { key: 'ai-platform-engineering-argocd', property: 'ARGOCD_TOKEN' } },
        { key: 'ARGOCD_API_URL', remoteRef: { key: 'ai-platform-engineering-argocd', property: 'ARGOCD_API_URL' } },
        { key: 'ARGOCD_VERIFY_SSL', remoteRef: { key: 'ai-platform-engineering-argocd', property: 'ARGOCD_VERIFY_SSL' } },
      ],
    });
  }
}
