import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { 
  ExternalSecret, 
  ExternalSecretSpecSecretStoreRefKind,
  ExternalSecretSpecTargetCreationPolicy,
  ExternalSecretSpecDataRemoteRefConversionStrategy,
  ExternalSecretSpecDataRemoteRefDecodingStrategy,
  ExternalSecretSpecDataRemoteRefMetadataPolicy
} from '../imports/external-secrets.io';

export class BackstageSecretsChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const namespace = 'backstage';

    // Microsoft Auth Secrets
    new ExternalSecret(this, 'backstage-auth-secrets', {
      metadata: {
        name: 'backstage-auth-secrets',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-10', // Create before deployment
        }
      },
      spec: {
        refreshInterval: '5m',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'backstage-auth-secrets',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
        },
        dataFrom: [{
          extract: {
            key: 'BACKSTAGE-AUTH', // Azure Key Vault secret containing all auth config
          }
        }]
      }
    });

    // GitHub Token Secret
    new ExternalSecret(this, 'github-token', {
      metadata: {
        name: 'github-token',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-10', // Create before deployment
        }
      },
      spec: {
        refreshInterval: '5m',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'github-token',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
        },
        data: [{
          secretKey: 'token',
          remoteRef: {
            key: 'GITHUB-PAT',
            conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
            decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
            metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
          }
        }]
      }
    });

    // ArgoCD Integration Secrets
    const environment = process.env.ENVIRONMENT || 'dev';
    
    // ArgoCD secrets for all environments
    new ExternalSecret(this, 'backstage-argocd-secrets', {
      metadata: {
        name: 'backstage-argocd-secrets',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-10', // Create before deployment
        }
      },
      spec: {
        refreshInterval: '5m',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'backstage-argocd-secrets',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
        },
        data: [
          {
            secretKey: 'base-url',
            remoteRef: {
              key: 'BACKSTAGE-ARGOCD',
              property: `${environment}.base-url`
            }
          },
          {
            secretKey: 'auth-token',
            remoteRef: {
              key: 'BACKSTAGE-ARGOCD',
              property: `${environment}.auth-token`
            }
          }
        ]
      }
    });

    // AKS Cluster Secrets - REMOVED
    // Since we're using in-cluster authentication with service accounts,
    // we don't need external secrets for AKS cluster access.
    // The Kubernetes plugin will use the pod's service account for authentication.

    // GitHub OAuth Secrets
    new ApiObject(this, 'github-oauth-secrets', {
      apiVersion: 'external-secrets.io/v1',
      kind: 'ExternalSecret',
      metadata: {
        name: 'backstage-github-oauth-secrets',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-10', // Create before deployment
        }
      },
      spec: {
        refreshInterval: '5m',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'backstage-github-oauth-secrets',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
        },
        data: [
          {
            secretKey: 'client-id',
            remoteRef: {
              key: 'BACKSTAGE-GITHUB-OAUTH',
              property: `${environment}.client-id`
            }
          },
          {
            secretKey: 'client-secret',
            remoteRef: {
              key: 'BACKSTAGE-GITHUB-OAUTH',
              property: `${environment}.client-secret`
            }
          }
        ]
      }
    });

    // ArgoCD Credentials
    new ApiObject(this, 'argocd-credentials', {
      apiVersion: 'external-secrets.io/v1',
      kind: 'ExternalSecret',
      metadata: {
        name: 'backstage-argocd-credentials',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-10', // Create before deployment
        }
      },
      spec: {
        refreshInterval: '5m',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'backstage-argocd-credentials',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
        },
        data: [
          {
            secretKey: 'username',
            remoteRef: {
              key: 'BACKSTAGE-ARGOCD',
              property: `${environment}.username`
            }
          },
          {
            secretKey: 'password',
            remoteRef: {
              key: 'BACKSTAGE-ARGOCD',
              property: `${environment}.password`
            }
          }
        ]
      }
    });

    // GitHub App Integration Secrets
    new ApiObject(this, 'github-app-secrets', {
      apiVersion: 'external-secrets.io/v1',
      kind: 'ExternalSecret',
      metadata: {
        name: 'github-app-secrets',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-10', // Create before deployment
        }
      },
      spec: {
        refreshInterval: '5m',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'github-app-secrets',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
        },
        data: [
          {
            secretKey: 'app-id',
            remoteRef: {
              key: 'BACKSTAGE-GITHUB-APP',
              property: 'app-id'
            }
          },
          {
            secretKey: 'client-id',
            remoteRef: {
              key: 'BACKSTAGE-GITHUB-APP',
              property: 'client-id'
            }
          },
          {
            secretKey: 'client-secret',
            remoteRef: {
              key: 'BACKSTAGE-GITHUB-APP',
              property: 'client-secret'
            }
          },
          {
            secretKey: 'webhook-secret',
            remoteRef: {
              key: 'BACKSTAGE-GITHUB-APP',
              property: 'webhook-secret'
            }
          },
          {
            secretKey: 'private-key',
            remoteRef: {
              key: 'BACKSTAGE-GITHUB-APP',
              property: 'private-key'
            }
          }
        ]
      }
    });

    // GitHub Webhook Secret for Events
    new ExternalSecret(this, 'backstage-github-webhook-secret', {
      metadata: {
        name: 'backstage-github-webhook-secret',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-10', // Create before deployment
        }
      },
      spec: {
        refreshInterval: '5m',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'backstage-github-webhook-secret',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
        },
        data: [{
          secretKey: 'webhook-secret',
          remoteRef: {
            key: 'GITHUB-WEBHOOK-SECRET',
            conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
            decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
            metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
          }
        }]
      }
    });
  }
}