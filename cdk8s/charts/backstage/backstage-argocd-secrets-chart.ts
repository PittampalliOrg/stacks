import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../../imports/k8s';
import { 
  ExternalSecret,
  ClusterSecretStore,
  ClusterSecretStoreSpecProviderKubernetesServerCaProviderType as CaProviderType,
  ExternalSecretSpecSecretStoreRefKind,
  ExternalSecretSpecTargetCreationPolicy
} from '../../imports/external-secrets.io';
import { createEnvExternalSecret } from '../../lib/eso-helpers';
import { JsonPatch } from 'cdk8s';

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
    const argocdCreds = createEnvExternalSecret(this, 'argocd-credentials-external', {
      externalName: 'argocd-credentials',
      name: 'argocd-credentials',
      namespace: 'backstage',
      refreshInterval: '0',
      secretStoreRef: { name: 'argocd', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
      mappings: [ { key: 'ARGOCD_ADMIN_PASSWORD', remoteRef: { key: 'argocd-initial-admin-secret', property: 'password' } } ],
    });
    argocdCreds.addJsonPatch(JsonPatch.add('/metadata/annotations', {}));
  }
}
