import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { ModelConfig, ModelConfigSpecProvider } from '../imports/kagent.dev';

export class KagentModelsChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    // Default model config for Helm-generated agents
    // The Helm chart has defaultModelConfig.create: false, so we create it here
    new ModelConfig(this, 'default-model-config', {
      metadata: {
        name: 'default-model-config',
        namespace: 'kagent',
      },
      spec: {
        apiKeySecretRef: 'kagent-openai',
        apiKeySecretKey: 'OPENAI_API_KEY',
        model: 'gpt-4o',
        provider: ModelConfigSpecProvider.OPEN_AI,
      },
    });

    // OpenAI GPT-4.1 - Latest and most powerful (April 2025)
    new ModelConfig(this, 'openai-gpt41-config', {
      metadata: {
        name: 'openai-gpt41-config',
        namespace: 'kagent',
      },
      spec: {
        apiKeySecretRef: 'kagent-openai',
        apiKeySecretKey: 'OPENAI_API_KEY',
        model: 'gpt-4.1',
        provider: ModelConfigSpecProvider.OPEN_AI,
      },
    });

    // OpenAI GPT-4o - Multimodal model
    new ModelConfig(this, 'openai-gpt4o-config', {
      metadata: {
        name: 'openai-gpt4o-config',
        namespace: 'kagent',
      },
      spec: {
        apiKeySecretRef: 'kagent-openai',
        apiKeySecretKey: 'OPENAI_API_KEY',
        model: 'gpt-4o',
        provider: ModelConfigSpecProvider.OPEN_AI,
      },
    });

    // OpenAI GPT-4.1 mini - Cost-effective latest model
    new ModelConfig(this, 'openai-gpt41-mini-config', {
      metadata: {
        name: 'openai-gpt41-mini-config',
        namespace: 'kagent',
      },
      spec: {
        apiKeySecretRef: 'kagent-openai',
        apiKeySecretKey: 'OPENAI_API_KEY',
        model: 'gpt-4.1-mini',
        provider: ModelConfigSpecProvider.OPEN_AI,
      },
    });

    // OpenAI o3-mini - Latest reasoning model
    new ModelConfig(this, 'openai-o3-mini-config', {
      metadata: {
        name: 'openai-o3-mini-config',
        namespace: 'kagent',
      },
      spec: {
        apiKeySecretRef: 'kagent-openai',
        apiKeySecretKey: 'OPENAI_API_KEY',
        model: 'o3-mini',
        provider: ModelConfigSpecProvider.OPEN_AI,
      },
    });

    // NOTE: Anthropic ExternalSecret is created in kagent-resources-chart.ts
    // to avoid duplication

    // Anthropic Claude 3.5 Sonnet model config
    new ModelConfig(this, 'anthropic-claude-sonnet-config', {
      metadata: {
        name: 'anthropic-claude-sonnet-config',
        namespace: 'kagent',
      },
      spec: {
        apiKeySecretRef: 'kagent-anthropic',
        apiKeySecretKey: 'ANTHROPIC_API_KEY',
        model: 'claude-sonnet-4-20250514',
        provider: ModelConfigSpecProvider.ANTHROPIC,
      },
    });


    new ModelConfig(this, 'anthropic-claude-opus-config', {
      metadata: {
        name: 'anthropic-claude-opus-config',
        namespace: 'kagent',
      },
      spec: {
        apiKeySecretRef: 'kagent-anthropic',
        apiKeySecretKey: 'ANTHROPIC_API_KEY',
        model: 'claude-opus-4-20250514',
        provider: ModelConfigSpecProvider.ANTHROPIC,
      },
    });

    // Azure OpenAI model config
    // Note: This assumes you have an Azure OpenAI deployment
    // You'll need to update the endpoint and deployment name
    // NOTE: Azure OpenAI ExternalSecret is created in kagent-resources-chart.ts
    // to avoid duplication

    new ModelConfig(this, 'azure-openai-model-config', {
      metadata: {
        name: 'azure-openai-gpt4o-config',
        namespace: 'kagent',
      },
      spec: {
        apiKeySecretRef: 'kagent-azureopenai',
        apiKeySecretKey: 'AZURE_OPENAI_API_KEY',
        model: 'gpt-4o',
        provider: ModelConfigSpecProvider.AZURE_OPEN_AI,
        azureOpenAi: {
          // Update these values based on your Azure OpenAI deployment
          azureEndpoint: 'https://daprazureopenai.openai.azure.com/',
          apiVersion: '2024-10-21',
          azureDeployment: 'gpt-4o',
        },
      },
    });

    // Local Ollama deployment for self-hosted models
    // First, deploy Ollama to the cluster
    new ApiObject(this, 'ollama-namespace', {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: 'ollama',
      },
    });

    new ApiObject(this, 'ollama-deployment', {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: 'ollama',
        namespace: 'ollama',
      },
      spec: {
        selector: {
          matchLabels: {
            app: 'ollama',
          },
        },
        template: {
          metadata: {
            labels: {
              app: 'ollama',
            },
          },
          spec: {
            containers: [
              {
                name: 'ollama',
                image: 'ollama/ollama:latest',
                ports: [
                  {
                    containerPort: 11434,
                  },
                ],
                resources: {
                  requests: {
                    memory: '2Gi',
                    cpu: '1000m',
                  },
                  limits: {
                    memory: '4Gi',
                    cpu: '2000m',
                  },
                },
                volumeMounts: [
                  {
                    name: 'ollama-storage',
                    mountPath: '/root/.ollama',
                  },
                ],
              },
            ],
            volumes: [
              {
                name: 'ollama-storage',
                emptyDir: {},
              },
            ],
          },
        },
      },
    });

    new ApiObject(this, 'ollama-service', {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: 'ollama',
        namespace: 'ollama',
      },
      spec: {
        selector: {
          app: 'ollama',
        },
        ports: [
          {
            port: 80,
            targetPort: 11434,
          },
        ],
      },
    });

    // Ollama Llama 3.2 model config
    new ModelConfig(this, 'ollama-llama3-config', {
      metadata: {
        name: 'ollama-llama3-config',
        namespace: 'kagent',
      },
      spec: {
        // Ollama doesn't require API keys, but the fields are still required
        apiKeySecretRef: 'kagent-openai', // Reuse existing secret
        apiKeySecretKey: 'OPENAI_API_KEY', // Required but not used
        model: 'llama3.2',
        provider: ModelConfigSpecProvider.OLLAMA,
        ollama: {
          host: 'http://ollama.ollama.svc.cluster.local',
        },
      },
    });

    // Ollama Mistral model config
    new ModelConfig(this, 'ollama-mistral-config', {
      metadata: {
        name: 'ollama-mistral-config',
        namespace: 'kagent',
      },
      spec: {
        apiKeySecretRef: 'kagent-openai', // Reuse existing secret
        apiKeySecretKey: 'OPENAI_API_KEY', // Required but not used
        model: 'mistral',
        provider: ModelConfigSpecProvider.OLLAMA,
        ollama: {
          host: 'http://ollama.ollama.svc.cluster.local',
        },
      },
    });

    // Google Vertex AI configurations would require Google credentials
    // This is commented out as it requires a Google Cloud project and credentials file
    /*
    new ApiObject(this, 'google-creds-secret', {
      apiVersion: 'external-secrets.io/v1',
      kind: 'ExternalSecret',
      metadata: {
        name: 'kagent-google-creds',
        namespace: 'kagent',
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore',
        },
        target: {
          name: 'kagent-google-creds',
          creationPolicy: 'Owner',
        },
        dataFrom: [
          {
            find: {
              name: {
                regexp: '^GOOGLE-CREDS-JSON$',
              },
            },
            rewrite: [
              {
                regexp: {
                  source: '^GOOGLE-CREDS-JSON$',
                  target: 'google_creds.json',
                },
              },
            ],
          },
        ],
      },
    });

    new ApiObject(this, 'gemini-vertex-config', {
      apiVersion: 'kagent.dev/v1alpha1',
      kind: 'ModelConfig',
      metadata: {
        name: 'gemini-vertex-config',
        namespace: 'kagent',
      },
      spec: {
        apiKeySecretRef: 'kagent-google-creds',
        apiKeySecretKey: 'google_creds.json',
        model: 'gemini-2.0-flash-exp',
        provider: 'GeminiVertexAI',
        geminiVertexAI: {
          projectID: 'your-gcp-project-id',
          location: 'us-central1',
          maxOutputTokens: 2048,
        },
      },
    });
    */
  }
}