import { Chart, ChartProps, Helm } from 'cdk8s';
import { Construct } from 'constructs';
import { AiPlatformEngineeringIngressChart } from './ai-platform-engineering/ai-platform-engineering-ingress-chart';
import { AiPlatformEngineeringSecretsChart } from './ai-platform-engineering/ai-platform-engineering-secrets-chart';

export interface AiPlatformEngineeringChartV2Props extends ChartProps {
  namespace?: string;
  secretStore?: string;
  useExternalSecrets?: boolean;
}

/**
 * Enhanced AI Platform Engineering chart with configurable secret store support
 */
export class AiPlatformEngineeringChartV2 extends Chart {
  constructor(scope: Construct, id: string, props: AiPlatformEngineeringChartV2Props = {}) {
    super(scope, id, props);

    const namespace = props.namespace || 'ai-platform-engineering';
    const baseHost = process.env.INGRESS_HOST || 'cnoe.localtest.me';
    const secretStore = props.secretStore || process.env.AI_PLATFORM_SECRET_STORE || 'vault-secret-store';
    const useExternalSecrets = props.useExternalSecrets !== false; // Default true

    // Create external secrets if using Azure Key Vault
    if (useExternalSecrets && secretStore === 'azure-keyvault-store') {
      new AiPlatformEngineeringSecretsChart(this, 'external-secrets', {
        namespace: namespace,
        secretStore: secretStore
      });
    }

    // Helper function to get the correct secret key path based on secret store
    const getSecretPath = (vaultPath: string): string => {
      if (secretStore === 'azure-keyvault-store') {
        // Convert vault path to Azure Key Vault format
        // ai-platform-engineering/global -> ai-platform-engineering-global
        return vaultPath.replace('/', '-');
      }
      return vaultPath;
    };

    // Deploy AI Platform Engineering using Helm chart
    new Helm(this, 'ai-platform', {
      chart: 'oci://ghcr.io/cnoe-io/helm-charts/ai-platform-engineering',
      version: '0.1.10',
      namespace: namespace,
      releaseName: 'ai-platform-engineering',
      values: {
        // Main platform configuration
        'ai-platform-engineering': {
          enabled: true,
          nameOverride: 'ai-platform-engineering',
          isMultiAgent: true,
          image: {
            repository: 'ghcr.io/cnoe-io/ai-platform-engineering',
            tag: 'stable',
            pullPolicy: 'Always',
            command: ['poetry', 'run', 'ai-platform-engineering'],
            args: ['platform-engineer']
          },
          env: {
            EXTERNAL_URL: `https://${baseHost}:8443/ai-platform-engineering`
          },
          multiAgentConfig: {
            protocol: 'a2a',
            port: '8000',
            releasePrefix: 'ai-platform-engineering',
            agents: [
              'argocd',
              'backstage',
              'github',
              'jira',
              'pagerduty',
              'slack'
            ]
          }
        },
        
        // Backstage plugin (disabled by default)
        'backstage-plugin-agent-forge': {
          enabled: false
        },
        
        // Agent configurations with external secrets
        'agent-argocd': {
          enabled: true,
          nameOverride: 'agent-argocd',
          image: {
            repository: 'ghcr.io/cnoe-io/agent-argocd',
            pullPolicy: 'Always'
          },
          secrets: {
            externalSecret: {
              enabled: useExternalSecrets,
              secretStore: secretStore,
              // When using Azure Key Vault, the separate secrets chart creates the ExternalSecrets
              // So we disable inline external secret creation
              createExternalSecret: secretStore !== 'azure-keyvault-store',
              data: [
                { secretKey: 'ARGOCD_TOKEN', key: getSecretPath('ai-platform-engineering/argocd-secret'), property: 'ARGOCD_TOKEN', optional: true },
                { secretKey: 'ARGOCD_API_URL', key: getSecretPath('ai-platform-engineering/argocd-secret'), property: 'ARGOCD_API_URL', optional: true },
                { secretKey: 'ARGOCD_VERIFY_SSL', key: getSecretPath('ai-platform-engineering/argocd-secret'), property: 'ARGOCD_VERIFY_SSL', optional: true }
              ]
            },
            // Reference the secret created by our ExternalSecret
            existingSecret: secretStore === 'azure-keyvault-store' ? 'agent-argocd-secrets' : undefined
          }
        },
        
        'agent-backstage': {
          enabled: true,
          nameOverride: 'agent-backstage',
          image: {
            repository: 'ghcr.io/cnoe-io/agent-backstage',
            pullPolicy: 'Always'
          },
          secrets: {
            externalSecret: {
              enabled: useExternalSecrets,
              secretStore: secretStore,
              createExternalSecret: secretStore !== 'azure-keyvault-store',
              data: [] // No specific secrets for backstage agent
            },
            existingSecret: secretStore === 'azure-keyvault-store' ? 'agent-backstage-secrets' : undefined
          }
        },
        
        'agent-github': {
          enabled: true,
          nameOverride: 'agent-github',
          image: {
            repository: 'ghcr.io/cnoe-io/agent-github',
            pullPolicy: 'Always'
          },
          secrets: {
            externalSecret: {
              enabled: useExternalSecrets,
              secretStore: secretStore,
              createExternalSecret: secretStore !== 'azure-keyvault-store',
              data: [
                { secretKey: 'GITHUB_PERSONAL_ACCESS_TOKEN', key: getSecretPath('ai-platform-engineering/github-secret'), property: 'GITHUB_PERSONAL_ACCESS_TOKEN', optional: true }
              ]
            },
            existingSecret: secretStore === 'azure-keyvault-store' ? 'agent-github-secrets' : undefined
          }
        },
        
        'agent-jira': {
          enabled: true,
          nameOverride: 'agent-jira',
          image: {
            repository: 'ghcr.io/cnoe-io/agent-jira',
            pullPolicy: 'Always'
          },
          secrets: {
            externalSecret: {
              enabled: useExternalSecrets,
              secretStore: secretStore,
              createExternalSecret: secretStore !== 'azure-keyvault-store',
              data: [
                { secretKey: 'ATLASSIAN_TOKEN', key: getSecretPath('ai-platform-engineering/jira-secret'), property: 'ATLASSIAN_TOKEN', optional: true },
                { secretKey: 'ATLASSIAN_EMAIL', key: getSecretPath('ai-platform-engineering/jira-secret'), property: 'ATLASSIAN_EMAIL', optional: true },
                { secretKey: 'ATLASSIAN_API_URL', key: getSecretPath('ai-platform-engineering/jira-secret'), property: 'ATLASSIAN_API_URL', optional: true },
                { secretKey: 'ATLASSIAN_VERIFY_SSL', key: getSecretPath('ai-platform-engineering/jira-secret'), property: 'ATLASSIAN_VERIFY_SSL', optional: true }
              ]
            },
            existingSecret: secretStore === 'azure-keyvault-store' ? 'agent-jira-secrets' : undefined
          }
        },
        
        'agent-pagerduty': {
          enabled: true,
          nameOverride: 'agent-pagerduty',
          image: {
            repository: 'ghcr.io/cnoe-io/agent-pagerduty',
            pullPolicy: 'Always'
          },
          secrets: {
            externalSecret: {
              enabled: useExternalSecrets,
              secretStore: secretStore,
              createExternalSecret: secretStore !== 'azure-keyvault-store',
              data: [
                { secretKey: 'PAGERDUTY_API_KEY', key: getSecretPath('ai-platform-engineering/pagerduty-secret'), property: 'PAGERDUTY_API_KEY', optional: true },
                { secretKey: 'PAGERDUTY_API_URL', key: getSecretPath('ai-platform-engineering/pagerduty-secret'), property: 'PAGERDUTY_API_URL', optional: true }
              ]
            },
            existingSecret: secretStore === 'azure-keyvault-store' ? 'agent-pagerduty-secrets' : undefined
          }
        },
        
        'agent-slack': {
          enabled: true,
          nameOverride: 'agent-slack',
          image: {
            repository: 'ghcr.io/cnoe-io/agent-slack',
            pullPolicy: 'Always'
          },
          secrets: {
            externalSecret: {
              enabled: useExternalSecrets,
              secretStore: secretStore,
              createExternalSecret: secretStore !== 'azure-keyvault-store',
              data: [
                { secretKey: 'SLACK_BOT_TOKEN', key: getSecretPath('ai-platform-engineering/slack-secret'), property: 'SLACK_BOT_TOKEN', optional: true },
                { secretKey: 'SLACK_APP_TOKEN', key: getSecretPath('ai-platform-engineering/slack-secret'), property: 'SLACK_APP_TOKEN', optional: true },
                { secretKey: 'SLACK_SIGNING_SECRET', key: getSecretPath('ai-platform-engineering/slack-secret'), property: 'SLACK_SIGNING_SECRET', optional: true },
                { secretKey: 'SLACK_CLIENT_SECRET', key: getSecretPath('ai-platform-engineering/slack-secret'), property: 'SLACK_CLIENT_SECRET', optional: true },
                { secretKey: 'SLACK_TEAM_ID', key: getSecretPath('ai-platform-engineering/slack-secret'), property: 'SLACK_TEAM_ID', optional: true }
              ]
            },
            existingSecret: secretStore === 'azure-keyvault-store' ? 'agent-slack-secrets' : undefined
          }
        },
        
        // Confluence agent disabled by default
        'agent-confluence': {
          enabled: false
        },
        
        // Global external secrets configuration
        global: {
          externalSecrets: {
            enabled: useExternalSecrets,
            secretStore: secretStore,
            createExternalSecret: secretStore !== 'azure-keyvault-store',
            data: [
              // LLM Provider configuration
              { secretKey: 'LLM_PROVIDER', key: getSecretPath('ai-platform-engineering/global'), property: 'LLM_PROVIDER', optional: true },
              // Azure OpenAI
              { secretKey: 'AZURE_OPENAI_API_KEY', key: getSecretPath('ai-platform-engineering/global'), property: 'AZURE_OPENAI_API_KEY', optional: true },
              { secretKey: 'AZURE_OPENAI_ENDPOINT', key: getSecretPath('ai-platform-engineering/global'), property: 'AZURE_OPENAI_ENDPOINT', optional: true },
              { secretKey: 'AZURE_OPENAI_API_VERSION', key: getSecretPath('ai-platform-engineering/global'), property: 'AZURE_OPENAI_API_VERSION', optional: true },
              { secretKey: 'AZURE_OPENAI_DEPLOYMENT', key: getSecretPath('ai-platform-engineering/global'), property: 'AZURE_OPENAI_DEPLOYMENT', optional: true },
              // OpenAI
              { secretKey: 'OPENAI_API_KEY', key: getSecretPath('ai-platform-engineering/global'), property: 'OPENAI_API_KEY', optional: true },
              { secretKey: 'OPENAI_ENDPOINT', key: getSecretPath('ai-platform-engineering/global'), property: 'OPENAI_ENDPOINT', optional: true },
              { secretKey: 'OPENAI_MODEL_NAME', key: getSecretPath('ai-platform-engineering/global'), property: 'OPENAI_MODEL_NAME', optional: true },
              // AWS Bedrock
              { secretKey: 'AWS_ACCESS_KEY_ID', key: getSecretPath('ai-platform-engineering/global'), property: 'AWS_ACCESS_KEY_ID', optional: true },
              { secretKey: 'AWS_SECRET_ACCESS_KEY', key: getSecretPath('ai-platform-engineering/global'), property: 'AWS_SECRET_ACCESS_KEY', optional: true },
              { secretKey: 'AWS_REGION', key: getSecretPath('ai-platform-engineering/global'), property: 'AWS_REGION', optional: true },
              { secretKey: 'AWS_BEDROCK_MODEL_ID', key: getSecretPath('ai-platform-engineering/global'), property: 'AWS_BEDROCK_MODEL_ID', optional: true },
              { secretKey: 'AWS_BEDROCK_PROVIDER', key: getSecretPath('ai-platform-engineering/global'), property: 'AWS_BEDROCK_PROVIDER', optional: true }
            ]
          },
          existingGlobalSecret: secretStore === 'azure-keyvault-store' ? 'ai-platform-global-secrets' : undefined
        }
      }
    });

    // Create additional ingress resources if needed
    new AiPlatformEngineeringIngressChart(this, 'ingress', {
      namespace: namespace,
    });
  }
}