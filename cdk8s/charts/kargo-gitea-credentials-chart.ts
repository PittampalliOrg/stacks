import { Chart, ChartProps } from 'cdk8s';
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
import { KubeSecret } from '../imports/k8s';

/**
 * Kargo Gitea Credentials Chart
 * Creates image registry and git repository credentials for local Gitea access
 */
export class KargoGiteaCredentialsChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const namespace = 'kargo-pipelines';

    // Create ExternalSecret for Gitea registry credentials for Backstage images
    new ExternalSecret(this, 'gitea-backstage-credentials-external', {
      metadata: {
        name: 'kargo-gitea-backstage-credentials-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'kargo-gitea-backstage-credentials',
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
          name: 'gitea',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
        },
        target: {
          name: 'kargo-gitea-backstage-credentials',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          deletionPolicy: ExternalSecretSpecTargetDeletionPolicy.RETAIN,
          template: {
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
            mergePolicy: ExternalSecretSpecTargetTemplateMergePolicy.REPLACE,
            metadata: {
              labels: {
                'app.kubernetes.io/name': 'kargo-gitea-backstage-credentials',
                'app.kubernetes.io/part-of': 'kargo-pipelines',
                'kargo.akuity.io/cred-type': 'image' // Required by Kargo
              }
            },
            data: {
              username: '{{ .username }}',
              password: '{{ .password }}',
              repoURL: 'gitea.cnoe.localtest.me:8443/giteaadmin/backstage-cnoe'
            }
          }
        },
        data: [
          {
            secretKey: 'username',
            remoteRef: {
              key: 'gitea-credential',
              property: 'username',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
              decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
              metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
            }
          },
          {
            secretKey: 'password',
            remoteRef: {
              key: 'gitea-credential',
              property: 'password',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
              decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
              metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
            }
          }
        ]
      }
    });

    // Create ExternalSecret for Gitea git repository credentials for manifest updates
    new ExternalSecret(this, 'gitea-git-manifest-credentials-external', {
      metadata: {
        name: 'kargo-gitea-manifest-credentials-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'kargo-gitea-manifest-credentials',
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
          name: 'gitea',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
        },
        target: {
          name: 'kargo-gitea-manifest-credentials',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          deletionPolicy: ExternalSecretSpecTargetDeletionPolicy.RETAIN,
          template: {
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
            mergePolicy: ExternalSecretSpecTargetTemplateMergePolicy.REPLACE,
            metadata: {
              labels: {
                'app.kubernetes.io/name': 'kargo-gitea-manifest-credentials',
                'app.kubernetes.io/part-of': 'kargo-pipelines',
                'kargo.akuity.io/cred-type': 'git' // Required by Kargo for git operations
              }
            },
            type: 'Opaque',
            data: {
              repoURL: 'https://gitea.cnoe.localtest.me:8443/giteaAdmin/idpbuilder-localdev-backstage-manifests.git',
              username: '{{ .username }}',
              password: '{{ .password }}',
              type: 'git'
            }
          }
        },
        data: [
          {
            secretKey: 'username',
            remoteRef: {
              key: 'gitea-credential',
              property: 'username',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
              decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
              metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
            }
          },
          {
            secretKey: 'password',
            remoteRef: {
              key: 'gitea-credential',
              property: 'password',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
              decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
              metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
            }
          }
        ]
      }
    });

    // Create a fallback secret with instructions if Gitea password is not in Azure Key Vault
    new KubeSecret(this, 'gitea-credentials-instructions', {
      metadata: {
        name: 'gitea-credentials-setup-instructions',
        namespace,
      },
      stringData: {
        'setup-instructions.txt': `Gitea Credentials Setup
=============================

This chart creates two types of Gitea credentials:
1. Image registry credentials (for pulling/pushing images)
2. Git repository credentials (for cloning/pushing manifests)

If using IDPBuilder locally, you can get the Gitea admin password with:
  idpbuilder get secrets -p gitea

Then add it to Azure Key Vault:
  - Key: GITEA-ADMIN-PASSWORD
  - Value: <password from idpbuilder>

Or create the secrets manually:

For image registry:
  kubectl create secret generic kargo-gitea-backstage-credentials \\
    --from-literal=username=giteaAdmin \\
    --from-literal=password=<password> \\
    --from-literal=repoURL=gitea.cnoe.localtest.me:8443/giteaadmin/backstage-cnoe \\
    -n kargo-pipelines

  kubectl label secret kargo-gitea-backstage-credentials \\
    kargo.akuity.io/cred-type=image \\
    -n kargo-pipelines

For git repository:
  kubectl create secret generic kargo-gitea-manifest-credentials \\
    --from-literal=username=giteaAdmin \\
    --from-literal=password=<password> \\
    --from-literal=repoURL=https://gitea.cnoe.localtest.me:8443/giteaAdmin/idpbuilder-localdev-backstage-manifests.git \\
    --from-literal=type=git \\
    -n kargo-pipelines

  kubectl label secret kargo-gitea-manifest-credentials \\
    kargo.akuity.io/cred-type=git \\
    -n kargo-pipelines
`,
      }
    });
    // Create Gitea API credentials secret for webhook setup
    new KubeSecret(this, 'gitea-api-credentials', {
      metadata: {
        name: 'gitea-credentials',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'gitea-credentials',
          'app.kubernetes.io/part-of': 'kargo-pipelines',
          'app.kubernetes.io/component': 'webhook-setup'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-20' // Create before webhook setup job
        }
      },
      stringData: {
        token: '808ee2f2ddf7b277f1a539f310b8ef4b8ee18612',
        username: 'giteaAdmin',
        password: 'L_0=_d]]cx3LD?PeZ[+Gj5<gY|8,P|:Iv$q3W3U2'
      }
    });
  }
}