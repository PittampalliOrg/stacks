import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { 
  ExternalSecretV1Beta1,
  ExternalSecretV1Beta1SpecTargetCreationPolicy,
  ExternalSecretV1Beta1SpecTargetDeletionPolicy,
  ExternalSecretV1Beta1SpecTargetTemplateEngineVersion,
  ExternalSecretV1Beta1SpecTargetTemplateMergePolicy,
  ExternalSecretV1Beta1SpecDataRemoteRefConversionStrategy,
  ExternalSecretV1Beta1SpecDataRemoteRefDecodingStrategy,
  ExternalSecretV1Beta1SpecDataRemoteRefMetadataPolicy
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
    new ExternalSecretV1Beta1(this, 'ghcr-chat-credentials-external', {
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
          kind: 'ClusterSecretStore'
        },
        target: {
          name: 'kargo-ghcr-chat-credentials',
          creationPolicy: ExternalSecretV1Beta1SpecTargetCreationPolicy.OWNER,
          deletionPolicy: ExternalSecretV1Beta1SpecTargetDeletionPolicy.RETAIN,
          template: {
            engineVersion: ExternalSecretV1Beta1SpecTargetTemplateEngineVersion.V2,
            mergePolicy: ExternalSecretV1Beta1SpecTargetTemplateMergePolicy.REPLACE,
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
              conversionStrategy: ExternalSecretV1Beta1SpecDataRemoteRefConversionStrategy.DEFAULT,
              decodingStrategy: ExternalSecretV1Beta1SpecDataRemoteRefDecodingStrategy.NONE,
              metadataPolicy: ExternalSecretV1Beta1SpecDataRemoteRefMetadataPolicy.NONE
            }
          }
        ]
      }
    });

    // Create ExternalSecret for GHCR Backstage credentials
    new ExternalSecretV1Beta1(this, 'ghcr-backstage-credentials-external', {
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
          kind: 'ClusterSecretStore'
        },
        target: {
          name: 'kargo-ghcr-backstage-credentials',
          creationPolicy: ExternalSecretV1Beta1SpecTargetCreationPolicy.OWNER,
          deletionPolicy: ExternalSecretV1Beta1SpecTargetDeletionPolicy.RETAIN,
          template: {
            engineVersion: ExternalSecretV1Beta1SpecTargetTemplateEngineVersion.V2,
            mergePolicy: ExternalSecretV1Beta1SpecTargetTemplateMergePolicy.REPLACE,
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
              repoURL: 'ghcr.io/pittampalliorg/backstage'
            }
          }
        },
        data: [
          {
            secretKey: 'pat',
            remoteRef: {
              key: 'GITHUB-PAT',
              conversionStrategy: ExternalSecretV1Beta1SpecDataRemoteRefConversionStrategy.DEFAULT,
              decodingStrategy: ExternalSecretV1Beta1SpecDataRemoteRefDecodingStrategy.NONE,
              metadataPolicy: ExternalSecretV1Beta1SpecDataRemoteRefMetadataPolicy.NONE
            }
          }
        ]
      }
    });

    // Create Git credentials for Kargo to clone GitHub stacks repository
    new ExternalSecretV1Beta1(this, 'git-credentials-external', {
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
          kind: 'ClusterSecretStore'
        },
        target: {
          name: 'kargo-git-credentials',
          creationPolicy: ExternalSecretV1Beta1SpecTargetCreationPolicy.OWNER,
          deletionPolicy: ExternalSecretV1Beta1SpecTargetDeletionPolicy.RETAIN,
          template: {
            engineVersion: ExternalSecretV1Beta1SpecTargetTemplateEngineVersion.V2,
            mergePolicy: ExternalSecretV1Beta1SpecTargetTemplateMergePolicy.REPLACE,
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
              conversionStrategy: ExternalSecretV1Beta1SpecDataRemoteRefConversionStrategy.DEFAULT,
              decodingStrategy: ExternalSecretV1Beta1SpecDataRemoteRefDecodingStrategy.NONE,
              metadataPolicy: ExternalSecretV1Beta1SpecDataRemoteRefMetadataPolicy.NONE
            }
          }
        ]
      }
    });
  }
}