import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { 
  ExternalSecret,
  ExternalSecretSpecTargetCreationPolicy,
  ExternalSecretSpecTargetDeletionPolicy,
  ExternalSecretSpecTargetTemplateEngineVersion,
  ExternalSecretSpecTargetTemplateMergePolicy,
  ExternalSecretSpecSecretStoreRefKind,
  ExternalSecretSpecDataRemoteRefConversionStrategy,
  ExternalSecretSpecDataRemoteRefDecodingStrategy,
  ExternalSecretSpecDataRemoteRefMetadataPolicy,
  ExternalSecretSpecDataFromSourceRefGeneratorRefKind
} from '../imports/external-secrets.io';

/**
 * Kargo Pipelines Credentials Chart
 * Creates image registry credentials for Kargo warehouses in the gitops-pipelines namespace
 */
export class KargoPipelinesCredentialsChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const namespace = 'gitops-pipelines';

    // Create ServiceAccount for workload identity
    new ApiObject(this, 'acr-sa', {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: {
        name: 'acr-sa',
        namespace,
        labels: { 
          'azure.workload.identity/use': 'true',
          'app.kubernetes.io/name': 'acr-sa',
          'app.kubernetes.io/part-of': 'gitops-pipelines',
          'app.kubernetes.io/component': 'credentials'
        },
        annotations: {
          'azure.workload.identity/client-id': process.env.AZURE_CLIENT_ID!,
          'azure.workload.identity/tenant-id': process.env.AZURE_TENANT_ID!,
          'argocd.argoproj.io/sync-wave': '-20', // Deploy early to setup workload identity
        },
      },
    });

    // Create ACRAccessToken generator for ACR credentials
    new ApiObject(this, 'acr-token-generator', {
      apiVersion: 'generators.external-secrets.io/v1alpha1',
      kind: 'ACRAccessToken',
      metadata: {
        name: 'kargo-acr-token',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'kargo-acr-token',
          'app.kubernetes.io/part-of': 'gitops-pipelines',
          'app.kubernetes.io/component': 'credentials'
        }
      },
      spec: {
        auth: {
          workloadIdentity: {
            serviceAccountRef: {
              name: 'acr-sa',
              namespace: namespace,
              audiences: ['api://AzureADTokenExchange']
            }
          }
        },
        registry: 'vpittamp.azurecr.io',
        tenantId: process.env.AZURE_TENANT_ID!,
        environmentType: 'PublicCloud'
      }
    });

    // Create ExternalSecret for ACR flagd-ui credentials
    new ExternalSecret(this, 'acr-flagdui-credentials-external', {
      metadata: {
        name: 'kargo-acr-flagdui-credentials-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'kargo-acr-flagdui-credentials',
          'app.kubernetes.io/part-of': 'gitops-pipelines',
          'app.kubernetes.io/component': 'credentials'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-15' // Create before warehouses
        }
      },
      spec: {
        refreshInterval: '3h',
        dataFrom: [
          {
            sourceRef: {
              generatorRef: {
                apiVersion: 'generators.external-secrets.io/v1alpha1',
                kind: ExternalSecretSpecDataFromSourceRefGeneratorRefKind.ACR_ACCESS_TOKEN,
                name: 'kargo-acr-token'
              }
            }
          }
        ],
        target: {
          name: 'kargo-acr-flagdui-credentials',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          deletionPolicy: ExternalSecretSpecTargetDeletionPolicy.RETAIN,
          template: {
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
            mergePolicy: ExternalSecretSpecTargetTemplateMergePolicy.REPLACE,
            metadata: {
              labels: {
                'app.kubernetes.io/name': 'kargo-acr-flagdui-credentials',
                'app.kubernetes.io/part-of': 'gitops-pipelines',
                'kargo.akuity.io/cred-type': 'image' // Required by Kargo
              }
            },
            data: {
              username: '{{ .username }}',
              password: '{{ .password }}',
              repoURL: 'vpittamp.azurecr.io/flagd-ui'
            }
          }
        }
      }
    });

    // Create ExternalSecret for ACR claudecodeui credentials
    new ExternalSecret(this, 'acr-claudecodeui-credentials-external', {
      metadata: {
        name: 'kargo-acr-claudecodeui-credentials-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'kargo-acr-claudecodeui-credentials',
          'app.kubernetes.io/part-of': 'gitops-pipelines',
          'app.kubernetes.io/component': 'credentials'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-15' // Create before warehouses
        }
      },
      spec: {
        refreshInterval: '3h',
        dataFrom: [
          {
            sourceRef: {
              generatorRef: {
                apiVersion: 'generators.external-secrets.io/v1alpha1',
                kind: ExternalSecretSpecDataFromSourceRefGeneratorRefKind.ACR_ACCESS_TOKEN,
                name: 'kargo-acr-token'
              }
            }
          }
        ],
        target: {
          name: 'kargo-acr-claudecodeui-credentials',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          deletionPolicy: ExternalSecretSpecTargetDeletionPolicy.RETAIN,
          template: {
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
            mergePolicy: ExternalSecretSpecTargetTemplateMergePolicy.REPLACE,
            metadata: {
              labels: {
                'app.kubernetes.io/name': 'kargo-acr-claudecodeui-credentials',
                'app.kubernetes.io/part-of': 'gitops-pipelines',
                'kargo.akuity.io/cred-type': 'image' // Required by Kargo
              }
            },
            data: {
              username: '{{ .username }}',
              password: '{{ .password }}',
              repoURL: 'vpittamp.azurecr.io/claudecodeui'
            }
          }
        }
      }
    });

    // Create ExternalSecret for GHCR chat credentials
    new ExternalSecret(this, 'ghcr-chat-credentials-external', {
      metadata: {
        name: 'kargo-ghcr-chat-credentials-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'kargo-ghcr-chat-credentials',
          'app.kubernetes.io/part-of': 'gitops-pipelines',
          'app.kubernetes.io/component': 'credentials'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-15' // Create before warehouses
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
        },
        target: {
          name: 'kargo-ghcr-chat-credentials',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            metadata: {
              labels: {
                'app.kubernetes.io/name': 'kargo-ghcr-chat-credentials',
                'app.kubernetes.io/part-of': 'gitops-pipelines',
                'kargo.akuity.io/cred-type': 'image' // Required by Kargo
              }
            },
            data: {
              username: 'pittampalliorg',
              password: '{{ .pat }}',
              repoURL: 'ghcr.io/pittampalliorg/chat'
            }
          }
        },
        data: [
          {
            secretKey: 'pat',
            remoteRef: {
              key: 'GITHUB-PAT',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
              decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
              metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
            }
          }
        ]
      }
    });

    // Create ExternalSecret for GHCR backstage credentials
    new ExternalSecret(this, 'ghcr-backstage-credentials-external', {
      metadata: {
        name: 'kargo-ghcr-backstage-credentials-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'kargo-ghcr-backstage-credentials',
          'app.kubernetes.io/part-of': 'gitops-pipelines',
          'app.kubernetes.io/component': 'credentials'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-15' // Create before warehouses
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
        },
        target: {
          name: 'kargo-ghcr-backstage-credentials',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            metadata: {
              labels: {
                'app.kubernetes.io/name': 'kargo-ghcr-backstage-credentials',
                'app.kubernetes.io/part-of': 'gitops-pipelines',
                'kargo.akuity.io/cred-type': 'image' // Required by Kargo
              }
            },
            data: {
              username: 'pittampalliorg',
              password: '{{ .pat }}',
              repoURL: 'ghcr.io/pittampalliorg/backstage'
            }
          }
        },
        data: [
          {
            secretKey: 'pat',
            remoteRef: {
              key: 'GITHUB-PAT',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
              decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
              metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
            }
          }
        ]
      }
    });

    // Create Git credentials for Kargo to clone GitHub repositories
    new ExternalSecret(this, 'git-credentials-external', {
      metadata: {
        name: 'kargo-git-credentials-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'kargo-git-credentials',
          'app.kubernetes.io/part-of': 'gitops-pipelines',
          'app.kubernetes.io/component': 'credentials'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-15' // Create before stages
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
        },
        target: {
          name: 'kargo-git-credentials',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            metadata: {
              labels: {
                'app.kubernetes.io/name': 'kargo-git-credentials',
                'app.kubernetes.io/part-of': 'gitops-pipelines',
                'kargo.akuity.io/cred-type': 'git' // Required by Kargo
              }
            },
            type: 'Opaque',
            data: {
              repoURL: 'https://github.com/PittampalliOrg/cdk8s-project.git',
              username: 'x-access-token', // GitHub expects this for PAT auth
              password: '{{ .pat }}',
              type: 'git'
            }
          }
        },
        data: [
          {
            secretKey: 'pat',
            remoteRef: {
              key: 'GITHUB-PAT',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
              decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
              metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
            }
          }
        ]
      }
    });

    // Create Git credentials for backstage repository
    new ExternalSecret(this, 'backstage-git-credentials-external', {
      metadata: {
        name: 'kargo-backstage-git-credentials-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'kargo-backstage-git-credentials',
          'app.kubernetes.io/part-of': 'gitops-pipelines',
          'app.kubernetes.io/component': 'credentials'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-15' // Create before stages
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
        },
        target: {
          name: 'kargo-backstage-git-credentials',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            metadata: {
              labels: {
                'app.kubernetes.io/name': 'kargo-backstage-git-credentials',
                'app.kubernetes.io/part-of': 'gitops-pipelines',
                'kargo.akuity.io/cred-type': 'git' // Required by Kargo
              }
            },
            type: 'Opaque',
            data: {
              repoURL: 'https://github.com/PittampalliOrg/backstage.git',
              username: 'x-access-token', // GitHub expects this for PAT auth
              password: '{{ .pat }}',
              type: 'git'
            }
          }
        },
        data: [
          {
            secretKey: 'pat',
            remoteRef: {
              key: 'GITHUB-PAT',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
              decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
              metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
            }
          }
        ]
      }
    });

    // Note: Azure AD config is handled through workload identity annotations on the ServiceAccount
  }
}