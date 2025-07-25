import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { 
  ExternalSecret,
  ExternalSecretSpecTargetCreationPolicy,
  ExternalSecretSpecDataRemoteRefConversionStrategy
} from '../imports/external-secrets.io';

/**
 * Chart that manages ExternalSecrets for the application stack
 * Creates ExternalSecrets for NextJS, Redis, and Postgres
 */
export class AppStackSecretsChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const namespace = 'nextjs';

    // Postgres/Neon Database Credentials
    new ExternalSecret(this, 'neon-database-secret', {
      metadata: {
        name: 'neon-database-credentials',
        namespace: namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-25' // Before applications
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore',
        },
        target: {
          name: 'neon-database-credentials',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
        },
        data: [
          {
            secretKey: 'DATABASE_URL',
            remoteRef: {
              key: 'POSTGRES-URL',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
            },
          },
          {
            secretKey: 'POSTGRES_URL',
            remoteRef: {
              key: 'POSTGRES-URL',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
            },
          },
          {
            secretKey: 'POSTGRES_PRISMA_URL',
            remoteRef: {
              key: 'POSTGRES-URL',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
            },
          },
          {
            secretKey: 'POSTGRES_URL_NON_POOLING',
            remoteRef: {
              key: 'POSTGRES-URL',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
            },
          },
          {
            secretKey: 'NEON_API_KEY',
            remoteRef: {
              key: 'NEON-API-KEY',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
            },
          },
          {
            secretKey: 'NEON_PROJECT_ID',
            remoteRef: {
              key: 'NEON-PROJECT-ID',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
            },
          },
        ],
      },
    });

    // Docker registry secret for GHCR
    new ExternalSecret(this, 'ghcr-dockercfg-external', {
      metadata: {
        name: 'ghcr-dockercfg-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'ghcr-dockercfg',
          'app.kubernetes.io/part-of': 'nextjs'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-10', // Create before deployment
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore',
        },
        target: {
          name: 'ghcr-dockercfg',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            type: 'kubernetes.io/dockerconfigjson',
            data: {
              '.dockerconfigjson': `{
                "auths": {
                  "ghcr.io": {
                    "username": "pittampalliorg",
                    "password": "{{ .pat }}",
                    "auth": "{{ printf "%s:%s" "pittampalliorg" .pat | b64enc }}"
                  }
                }
              }`
            }
          }
        },
        data: [
          {
            secretKey: 'pat',
            remoteRef: {
              key: 'GITHUB-PAT',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
            }
          }
        ]
      }
    });

    // Redis Credentials (if needed in the future)
    // Uncomment and configure when Redis requires authentication
    /*
    new ApiObject(this, 'redis-credentials', {
      apiVersion: 'external-secrets.io/v1',
      kind: 'ExternalSecret',
      metadata: {
        name: 'redis-credentials',
        namespace: namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-25'
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore',
        },
        target: {
          name: 'redis-credentials',
          creationPolicy: 'Owner',
        },
        data: [
          {
            secretKey: 'REDIS_PASSWORD',
            remoteRef: {
              key: 'REDIS-PASSWORD',
            },
          },
        ],
      },
    });
    */

    // Additional application secrets can be added here
    // For example: API keys, service credentials, etc.
  }
}