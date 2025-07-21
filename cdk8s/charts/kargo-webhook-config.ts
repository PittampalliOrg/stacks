import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';
import { 
  ExternalSecret,
  ExternalSecretSpecTargetCreationPolicy,
  ExternalSecretSpecSecretStoreRefKind,
  ExternalSecretSpecDataRemoteRefConversionStrategy,
  ExternalSecretSpecDataRemoteRefDecodingStrategy,
  ExternalSecretSpecDataRemoteRefMetadataPolicy,
  ExternalSecretSpecDataFromSourceRefGeneratorRefKind
} from '../imports/external-secrets.io';

export interface KargoWebhookConfigChartProps extends ChartProps {
  githubWebhookSecret?: string;
}

/**
 * Kargo Webhook Configuration for GitHub private repositories
 * Enables automatic freight discovery on push events
 */
export class KargoWebhookConfigChart extends Chart {
  constructor(scope: Construct, id: string, props: KargoWebhookConfigChartProps = {}) {
    super(scope, id, props);

    const namespace = 'nextjs';
    
    // Only deploy webhook configuration in production environments
    const isProduction = process.env.ENVIRONMENT === 'production' || 
                        process.env.INGRESS_HOST?.includes('ai401kchat.com');
    
    if (!isProduction) {
      // Skip webhook configuration for local development
      return;
    }
    
    // 1. External Secret for GitHub webhook validation
    // This fetches the webhook secret from Azure Key Vault
    new ExternalSecret(this, 'github-webhook-secret-external', {
      metadata: {
        name: 'github-webhook-secret-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'github-webhook-secret',
          'app.kubernetes.io/part-of': 'kargo-webhooks'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-15', // Create before ProjectConfig
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'github-webhook-secret',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
        },
        data: [{
          secretKey: 'secret',
          remoteRef: {
            key: 'GITHUB-WEBHOOK-SECRET',
            conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
            decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
            metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
          }
        }]
      }
    });

    // Note: ProjectConfig for webhook receivers is now managed in kargo-pipelines-project-chart.ts
    // This prevents duplicate webhook configurations across namespaces

    // 3. External Secret for GitHub App credentials
    // This creates a secret with GitHub App credentials from Azure Key Vault
    new ExternalSecret(this, 'github-app-credentials-external', {
      metadata: {
        name: 'github-app-credentials-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'github-app-credentials',
          'app.kubernetes.io/part-of': 'kargo-credentials'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-15', // Create before ProjectConfig
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'github-app-credentials',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            metadata: {
              labels: {
                'kargo.akuity.io/secret-type': 'repo',
                'app.kubernetes.io/name': 'github-app-credentials',
                'app.kubernetes.io/part-of': 'kargo-credentials'
              }
            },
            data: {
              type: 'github-app',
              url: 'https://github.com/PittampalliOrg',
              github_app_id: process.env.GH_APP_ID || '1272071',
              github_app_installation_id: process.env.GH_INSTALLATION_ID || '66754705',
              github_app_private_key: '{{ .private_key }}'
            }
          }
        },
        data: [{
          secretKey: 'private_key',
          remoteRef: {
            key: 'GITHUB-APP-PRIVATE-KEY',
            conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
            decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
            metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
          }
        }]
      }
    });

    // 4. External Secret for GHCR chat repository credentials
    new ExternalSecret(this, 'ghcr-chat-credentials-external', {
      metadata: {
        name: 'ghcr-chat-credentials-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'ghcr-chat-credentials',
          'app.kubernetes.io/part-of': 'kargo-credentials'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-15', // Create before ProjectConfig
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'ghcr-chat-credentials',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            metadata: {
              labels: {
                'kargo.akuity.io/cred-type': 'image',
                'app.kubernetes.io/name': 'ghcr-chat-credentials',
                'app.kubernetes.io/part-of': 'kargo-credentials'
              }
            },
            data: {
              repoURL: 'ghcr.io/pittampalliorg/chat',
              username: 'pittampalliorg',
              password: '{{ .pat }}'
            }
          }
        },
        data: [{
          secretKey: 'pat',
          remoteRef: {
            key: 'GITHUB-PAT',
            conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
            decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
            metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
          }
        }]
      }
    });

    // 5. External Secret for GHCR backstage repository credentials
    new ExternalSecret(this, 'ghcr-backstage-credentials-external', {
      metadata: {
        name: 'ghcr-backstage-credentials-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'ghcr-backstage-credentials',
          'app.kubernetes.io/part-of': 'kargo-credentials'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-15', // Create before ProjectConfig
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'ghcr-backstage-credentials',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            metadata: {
              labels: {
                'kargo.akuity.io/cred-type': 'image',
                'app.kubernetes.io/name': 'ghcr-backstage-credentials',
                'app.kubernetes.io/part-of': 'kargo-credentials'
              }
            },
            data: {
              repoURL: 'ghcr.io/pittampalliorg/backstage',
              username: 'pittampalliorg',
              password: '{{ .pat }}'
            }
          }
        },
        data: [{
          secretKey: 'pat',
          remoteRef: {
            key: 'GITHUB-PAT',
            conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
            decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
            metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
          }
        }]
      }
    });

    // 6. ACR Access Token Generator for Kargo
    // This generates short-lived tokens for ACR access using workload identity
    new ApiObject(this, 'kargo-acr-token', {
      apiVersion: 'generators.external-secrets.io/v1alpha1',
      kind: 'ACRAccessToken',
      metadata: {
        name: 'kargo-acr-token',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-20', // Create before ExternalSecrets
        }
      },
      spec: {
        auth: {
          workloadIdentity: {
            serviceAccountRef: {
              name: 'acr-sa',
              namespace,
              audiences: ['api://AzureADTokenExchange']
            }
          }
        },
        environmentType: 'PublicCloud',
        registry: 'vpittamp.azurecr.io',
        tenantId: process.env.AZURE_TENANT_ID || '0c4da9c5-40ea-4e7d-9c7a-e7308d4f8e38'
      }
    });

    // 7. External Secret for ACR credentials (all repositories)
    // This creates a secret with ACR credentials that Kargo can use for all repositories
    new ExternalSecret(this, 'kargo-acr-credentials-external', {
      metadata: {
        name: 'kargo-acr-credentials-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'kargo-acr-credentials',
          'app.kubernetes.io/part-of': 'kargo-credentials'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-15', // Create before ProjectConfig
        }
      },
      spec: {
        refreshInterval: '3h',
        dataFrom: [{
          sourceRef: {
            generatorRef: {
              apiVersion: 'generators.external-secrets.io/v1alpha1',
              kind: ExternalSecretSpecDataFromSourceRefGeneratorRefKind.ACR_ACCESS_TOKEN,
              name: 'kargo-acr-token'
            }
          }
        }],
        target: {
          name: 'kargo-acr-all-credentials',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            metadata: {
              labels: {
                'kargo.akuity.io/cred-type': 'image',
                'app.kubernetes.io/name': 'kargo-acr-all-credentials',
                'app.kubernetes.io/part-of': 'kargo-credentials'
              }
            },
            data: {
              repoURL: 'vpittamp.azurecr.io',
              username: '{{ .username }}',
              password: '{{ .password }}'
            }
          }
        }
      }
    });

    // Note: ACR authentication uses workload identity via the acr-sa service account
    // The ACRAccessToken generator creates short-lived tokens that refresh every 3 hours

    // 8. Ingress for Kargo External Webhook Service
    // This enables GitHub to send webhooks to Kargo
    // The Kargo Helm chart creates the internal webhook ingress, but we need
    // an external one for GitHub webhooks
    const ingressHost = process.env.INGRESS_HOST || 'localtest.me';
    const enableTls = process.env.ENABLE_TLS === 'true';
    
    new k8s.KubeIngress(this, 'kargo-external-webhooks-ingress', {
      metadata: {
        name: 'kargo-external-webhooks',
        namespace: 'kargo',
        annotations: {
          'nginx.ingress.kubernetes.io/ssl-redirect': enableTls ? 'true' : 'false',
          'nginx.ingress.kubernetes.io/backend-protocol': 'HTTPS',
          ...(enableTls && { 'cert-manager.io/cluster-issuer': process.env.TLS_ISSUER || 'letsencrypt-prod' })
        }
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [{
          host: `kargo-webhooks.${ingressHost}`,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: 'kargo-external-webhooks-server',
                  port: {
                    number: 443
                  }
                }
              }
            }]
          }
        }],
        ...(enableTls && {
          tls: [{
            hosts: [`kargo-webhooks.${ingressHost}`],
            secretName: 'kargo-webhook-tls'
          }]
        })
      }
    });

    // Note: The Kargo controller configuration (API_SERVER_BASE_URL) is now
    // managed via the Helm chart values in kargo-helm-app-chart.ts
    // This prevents conflicts with the Helm-managed ConfigMap
  }
}