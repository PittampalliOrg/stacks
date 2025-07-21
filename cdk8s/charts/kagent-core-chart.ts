import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';

export class KagentCoreChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    // Create namespace
    new ApiObject(this, 'kagent-namespace', {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: 'kagent',
      },
    });
    
    // Create ExternalSecret for OpenAI API key
    new ApiObject(this, 'kagent-openai-secret', {
      apiVersion: 'external-secrets.io/v1',
      kind: 'ExternalSecret',
      metadata: {
        name: 'kagent-openai',
        namespace: 'kagent',
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore',
        },
        target: {
          name: 'kagent-openai',
          creationPolicy: 'Owner',
        },
        data: [
          {
            secretKey: 'OPENAI_API_KEY',
            remoteRef: {
              key: 'OPENAI-API-KEY',
            },
          },
        ],
      },
    });

    // Create ExternalSecret for Anthropic API key
    new ApiObject(this, 'kagent-anthropic-secret', {
      apiVersion: 'external-secrets.io/v1',
      kind: 'ExternalSecret',
      metadata: {
        name: 'kagent-anthropic',
        namespace: 'kagent',
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore',
        },
        target: {
          name: 'kagent-anthropic',
          creationPolicy: 'Owner',
        },
        data: [
          {
            secretKey: 'ANTHROPIC_API_KEY',
            remoteRef: {
              key: 'ANTHROPIC-API-KEY',
            },
          },
        ],
      },
    });

    // Create ExternalSecret for Azure OpenAI
    new ApiObject(this, 'kagent-azureopenai-secret', {
      apiVersion: 'external-secrets.io/v1',
      kind: 'ExternalSecret',
      metadata: {
        name: 'kagent-azureopenai',
        namespace: 'kagent',
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore',
        },
        target: {
          name: 'kagent-azureopenai',
          creationPolicy: 'Owner',
        },
        data: [
          {
            secretKey: 'AZURE_API_KEY',
            remoteRef: {
              key: 'AZURE-API-KEY',
            },
          },
        ],
      },
    });
  }
}