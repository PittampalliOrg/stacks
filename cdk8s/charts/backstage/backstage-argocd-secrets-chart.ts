import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../../imports/k8s';
import { 
  ExternalSecretV1Beta1 as ExternalSecret,
  ClusterSecretStoreV1Beta1 as ClusterSecretStore,
  ClusterSecretStoreV1Beta1SpecProviderKubernetesServerCaProviderType as CaProviderType
} from '../../imports/external-secrets.io';

/**
 * Chart that creates ArgoCD-related resources for Backstage
 * This includes the ClusterSecretStore and ArgoCD credentials ExternalSecret
 */
export class BackstageArgoCDSecretsChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    // ServiceAccount for ESO store
    new k8s.KubeServiceAccount(this, 'eso-store-sa', {
      metadata: {
        name: 'eso-store',
        namespace: 'argocd'
      }
    });

    // Role for ESO store
    new k8s.KubeRole(this, 'eso-store-role', {
      metadata: {
        name: 'eso-store',
        namespace: 'argocd'
      },
      rules: [
        {
          apiGroups: [''],
          resources: ['secrets'],
          verbs: ['get', 'list', 'watch']
        },
        {
          apiGroups: ['authorization.k8s.io'],
          resources: ['selfsubjectrulesreviews'],
          verbs: ['create']
        }
      ]
    });

    // RoleBinding for ESO store
    new k8s.KubeRoleBinding(this, 'eso-store-binding', {
      metadata: {
        name: 'eso-store',
        namespace: 'argocd'
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'eso-store',
          namespace: 'argocd'
        }
      ],
      roleRef: {
        kind: 'Role',
        name: 'eso-store',
        apiGroup: 'rbac.authorization.k8s.io'
      }
    });

    // ArgoCD ClusterSecretStore
    new ClusterSecretStore(this, 'argocd-store', {
      metadata: {
        name: 'argocd'
      },
      spec: {
        provider: {
          kubernetes: {
            remoteNamespace: 'argocd',
            server: {
              caProvider: {
                type: CaProviderType.CONFIG_MAP,
                name: 'kube-root-ca.crt',
                namespace: 'argocd',
                key: 'ca.crt'
              }
            },
            auth: {
              serviceAccount: {
                name: 'eso-store',
                namespace: 'argocd'
              }
            }
          }
        }
      }
    });

    // ArgoCD credentials ExternalSecret
    new ExternalSecret(this, 'argocd-credentials', {
      metadata: {
        name: 'argocd-credentials',
        namespace: 'backstage'
      },
      spec: {
        secretStoreRef: {
          name: 'argocd',
          kind: 'ClusterSecretStore'
        },
        refreshInterval: '0',
        target: {
          name: 'argocd-credentials'
        },
        data: [
          {
            secretKey: 'ARGOCD_ADMIN_PASSWORD',
            remoteRef: {
              key: 'argocd-initial-admin-secret',
              property: 'password'
            }
          }
        ]
      }
    });
  }
}