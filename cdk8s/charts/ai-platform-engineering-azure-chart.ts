import { Chart, ChartProps, Helm, ApiObject, JsonPatch } from 'cdk8s';
import { Construct } from 'constructs';
import { AiPlatformEngineeringIngressChart } from './ai-platform-engineering/ai-platform-engineering-ingress-chart';
import { AiPlatformAzureSecretsChart } from './ai-platform-engineering/ai-platform-azure-secrets-chart';

export interface AiPlatformEngineeringAzureChartProps extends ChartProps {
  namespace?: string;
}

/**
 * Simplified AI Platform Engineering chart using Azure Key Vault only
 * No backwards compatibility - Azure Key Vault is the only supported secret store
 */
export class AiPlatformEngineeringAzureChart extends Chart {
  constructor(scope: Construct, id: string, props: AiPlatformEngineeringAzureChartProps = {}) {
    super(scope, id, props);

    const namespace = props.namespace || 'ai-platform-engineering';

    // Create external secrets and local ArgoCD secret
    new AiPlatformAzureSecretsChart(this, 'secrets', {
      namespace: namespace
    });

    // Deploy AI Platform Engineering using Helm chart
    const helmChart = new Helm(this, 'ai-platform', {
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
        
        // Agent configurations - all use pre-created secrets
        'agent-argocd': {
          enabled: true,
          nameOverride: 'agent-argocd',
          image: {
            repository: 'ghcr.io/cnoe-io/agent-argocd',
            pullPolicy: 'Always'
          },
          // Let Helm create the secret, ExternalSecret will populate it
        },
        
        'agent-backstage': {
          enabled: true,
          nameOverride: 'agent-backstage',
          image: {
            repository: 'ghcr.io/cnoe-io/agent-backstage',
            pullPolicy: 'Always'
          },
          // Let Helm create the secret, ExternalSecret will populate it
        },
        
        'agent-github': {
          enabled: true,
          nameOverride: 'agent-github',
          image: {
            repository: 'ghcr.io/cnoe-io/agent-github',
            pullPolicy: 'Always'
          },
          // Let Helm create the secret, ExternalSecret will populate it
        },
        
        'agent-jira': {
          enabled: true,
          nameOverride: 'agent-jira',
          image: {
            repository: 'ghcr.io/cnoe-io/agent-jira',
            pullPolicy: 'Always'
          },
          // Let Helm create the secret, ExternalSecret will populate it
        },
        
        'agent-pagerduty': {
          enabled: true,
          nameOverride: 'agent-pagerduty',
          image: {
            repository: 'ghcr.io/cnoe-io/agent-pagerduty',
            pullPolicy: 'Always'
          },
          // Let Helm create the secret, ExternalSecret will populate it
        },
        
        'agent-slack': {
          enabled: true,
          nameOverride: 'agent-slack',
          image: {
            repository: 'ghcr.io/cnoe-io/agent-slack',
            pullPolicy: 'Always'
          },
          // Let Helm create the secret, ExternalSecret will populate it
        },
        
        // Confluence agent disabled by default
        'agent-confluence': {
          enabled: false
        },
        
        // Global configuration
        global: {
          // Empty global config, the Helm chart will use its default secret names
          secrets: {}
        }
      }
    });

    // Use escape hatch to patch the EXTERNAL_URL environment variable
    // Find the ai-platform-engineering deployment
    const deployment = helmChart.apiObjects.find(obj => 
      obj.kind === 'Deployment' && 
      obj.name === 'ai-platform-engineering'
    );

    if (deployment) {
      // The EXTERNAL_URL is the first environment variable (index 0) in the container
      // Patch it to use our custom value instead of the hardcoded default
      deployment.addJsonPatch(JsonPatch.replace(
        '/spec/template/spec/containers/0/env/0/value',
        process.env.EXTERNAL_URL || 'https://ai-platform-engineering.cnoe.localtest.me:8443'
      ));
    }

    // Create additional ingress resources if needed
    new AiPlatformEngineeringIngressChart(this, 'ingress', {
      namespace: namespace,
    });
  }
}