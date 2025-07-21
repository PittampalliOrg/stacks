import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';

export interface OpenFeatureConfigChartProps extends ChartProps {
  namespace?: string;
}

/**
 * OpenFeature Configuration Chart
 * Manages feature flags for CDK8s environment variables
 */
export class OpenFeatureConfigChart extends Chart {
  constructor(scope: Construct, id: string, props: OpenFeatureConfigChartProps = {}) {
    super(scope, id, props);

    const namespace = props.namespace || 'default';

    // Create FeatureFlag for CDK8s environment variables
    new ApiObject(this, 'cdk8s-env-flags', {
      apiVersion: 'core.openfeature.dev/v1beta1',
      kind: 'FeatureFlag',
      metadata: {
        name: 'cdk8s-env-config',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '5'
        }
      },
      spec: {
        flagSpec: {
          flags: {
          // Azure Configuration
          azureClientId: {
            state: 'ENABLED',
            variants: {
              production: '8cbc522c-9bf4-4c16-b010-c118626f8549',
              development: '8cbc522c-9bf4-4c16-b010-c118626f8549'
            },
            defaultVariant: 'production'
          },
          azureTenantId: {
            state: 'ENABLED',
            variants: {
              production: '0c4da9c5-40ea-4e7d-9c7a-e7308d4f8e38',
              development: '0c4da9c5-40ea-4e7d-9c7a-e7308d4f8e38'
            },
            defaultVariant: 'production'
          },
          azureKeyvaultName: {
            state: 'ENABLED',
            variants: {
              production: 'keyvault-thcmfmoo5oeow',
              development: 'keyvault-thcmfmoo5oeow'
            },
            defaultVariant: 'production'
          },
          // GitHub Configuration
          ghAppId: {
            state: 'ENABLED',
            variants: {
              default: '1272071'
            },
            defaultVariant: 'default'
          },
          ghInstallationId: {
            state: 'ENABLED',
            variants: {
              default: '66754705'
            },
            defaultVariant: 'default'
          },
          // Application Configuration
          logLevel: {
            state: 'ENABLED',
            variants: {
              production: 'info',
              development: 'debug',
              debug: 'debug'
            },
            defaultVariant: 'debug',
            // Temporarily disable complex targeting until we fix the syntax
            // targeting: {
            //   if: [
            //     { var: 'environment' },
            //     { '==': [{ var: 'environment' }, 'production'] },
            //     'production',
            //     'development'
            //   ]
            // }
          },
          nextjsBaseUrl: {
            state: 'ENABLED',
            variants: {
              production: 'https://chat.production.com',
              staging: 'https://chat.staging.com',
              development: 'https://chat.localtest.me'
            },
            defaultVariant: 'development'
          },
          nodeEnv: {
            state: 'ENABLED',
            variants: {
              production: 'production',
              development: 'development'
            },
            defaultVariant: 'development'
          },
          otelEndpoint: {
            state: 'ENABLED',
            variants: {
              production: 'http://alloy.monitoring:4318',
              development: 'http://alloy.monitoring:4318'
            },
            defaultVariant: 'development'
          }
        }
        }
      }
    });

    // Create ConfigMap for legacy applications that can't use feature flags directly
    new ApiObject(this, 'openfeature-env-configmap', {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: 'openfeature-env-config',
        namespace,
        labels: {
          'app.kubernetes.io/managed-by': 'openfeature',
          'app.kubernetes.io/component': 'configuration'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '5'
        }
      },
      data: {
        // Current configuration values
        AZURE_CLIENT_ID: '8cbc522c-9bf4-4c16-b010-c118626f8549',
        AZURE_TENANT_ID: '0c4da9c5-40ea-4e7d-9c7a-e7308d4f8e38',
        AZURE_KEYVAULT_NAME: 'keyvault-thcmfmoo5oeow',
        GH_APP_ID: '1272071',
        GH_INSTALLATION_ID: '66754705',
        LOG_LEVEL: 'debug',
        NEXTJS_BASE_URL: 'https://chat.localtest.me',
        NODE_ENV: 'development',
        OTEL_ENDPOINT: 'http://alloy.monitoring:4318'
      }
    });

    // Create a sidecar injector configuration for applications
    new ApiObject(this, 'openfeature-sidecar-config', {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: 'openfeature-sidecar-config',
        namespace,
        labels: {
          'app.kubernetes.io/managed-by': 'openfeature',
          'app.kubernetes.io/component': 'sidecar'
        }
      },
      data: {
        'config.yaml': JSON.stringify({
          // Configuration for the flagd sidecar
          uri: 'kubernetes:///cdk8s-env-config',
          sourceSelector: 'app.kubernetes.io/managed-by=openfeature',
          envVarPrefix: 'FLAGD_'
        }, null, 2)
      }
    });
  }
}