import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { 
  ExternalSecret,
  ExternalSecretSpecTargetCreationPolicy,
  ExternalSecretSpecSecretStoreRefKind,
  ExternalSecretSpecTargetDeletionPolicy,
  ExternalSecretSpecTargetTemplateEngineVersion,
  ExternalSecretSpecTargetTemplateMergePolicy,
  ExternalSecretSpecDataRemoteRefConversionStrategy,
  ExternalSecretSpecDataRemoteRefDecodingStrategy,
  ExternalSecretSpecDataRemoteRefMetadataPolicy
} from '../imports/external-secrets.io';

/**
 * Kargo Pipelines Credentials Chart
 * Creates image registry credentials for Kargo warehouses in the kargo-pipelines namespace
 */
export class KargoPipelinesCredentialsChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const namespace = 'kargo-pipelines';

    // Create ExternalSecret for GHCR NextJS (chat) credentials
    new ExternalSecret(this, 'ghcr-chat-credentials-external', {
      metadata: {
        name: 'kargo-ghcr-chat-credentials-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'kargo-ghcr-chat-credentials',
          'app.kubernetes.io/part-of': 'kargo-pipelines',
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
          deletionPolicy: ExternalSecretSpecTargetDeletionPolicy.RETAIN,
          template: {
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
            mergePolicy: ExternalSecretSpecTargetTemplateMergePolicy.REPLACE,
            metadata: {
              labels: {
                'app.kubernetes.io/name': 'kargo-ghcr-chat-credentials',
                'app.kubernetes.io/part-of': 'kargo-pipelines',
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

    // Create ExternalSecret for GHCR Backstage credentials
    new ExternalSecret(this, 'ghcr-backstage-credentials-external', {
      metadata: {
        name: 'kargo-ghcr-backstage-credentials-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'kargo-ghcr-backstage-credentials',
          'app.kubernetes.io/part-of': 'kargo-pipelines',
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
          deletionPolicy: ExternalSecretSpecTargetDeletionPolicy.RETAIN,
          template: {
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
            mergePolicy: ExternalSecretSpecTargetTemplateMergePolicy.REPLACE,
            metadata: {
              labels: {
                'app.kubernetes.io/name': 'kargo-ghcr-backstage-credentials',
                'app.kubernetes.io/part-of': 'kargo-pipelines',
                'kargo.akuity.io/cred-type': 'image' // Required by Kargo
              }
            },
            data: {
              username: 'pittampalliorg',
              password: '{{ .pat }}',
              repoURL: 'ghcr.io/pittampalliorg/backstage-cnoe'
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

    // Create Git credentials for Kargo to clone GitHub stacks repository
    new ExternalSecret(this, 'git-credentials-external', {
      metadata: {
        name: 'kargo-git-credentials-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'kargo-git-credentials',
          'app.kubernetes.io/part-of': 'kargo-pipelines',
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
          deletionPolicy: ExternalSecretSpecTargetDeletionPolicy.RETAIN,
          template: {
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
            mergePolicy: ExternalSecretSpecTargetTemplateMergePolicy.REPLACE,
            metadata: {
              labels: {
                'app.kubernetes.io/name': 'kargo-git-credentials',
                'app.kubernetes.io/part-of': 'kargo-pipelines',
                'kargo.akuity.io/cred-type': 'git' // Required by Kargo
              }
            },
            type: 'Opaque',
            data: {
              repoURL: 'https://github.com/PittampalliOrg/stacks.git',
              username: 'x-access-token',
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
  }
}