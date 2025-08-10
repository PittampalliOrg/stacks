import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { ClusterSecretStore, ExternalSecret, ExternalSecretSpecSecretStoreRefKind, ClusterSecretStoreSpecProviderKubernetesServerCaProviderType } from '../../imports/external-secrets.io';

/**
 * Creates base resources that will be patched by the vcluster registration ApplicationSet
 */
export class VclusterRegistrationResourcesChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    // Create base ClusterSecretStore that will be patched by ApplicationSet
    new ClusterSecretStore(this, 'base-cluster-secret-store', {
      metadata: {
        name: 'unpatched-kubernetes-vcluster',
        annotations: {
          'argocd.argoproj.io/sync-wave': '15', // Before ExternalSecret
        },
      },
      spec: {
        provider: {
          kubernetes: {
            remoteNamespace: 'unpatched-namespace', // Will be patched to actual namespace
            auth: {
              serviceAccount: {
                name: 'external-secrets',
                namespace: 'external-secrets',
              },
            },
            server: {
              url: 'https://kubernetes.default.svc',
              caProvider: {
                type: ClusterSecretStoreSpecProviderKubernetesServerCaProviderType.CONFIG_MAP,
                name: 'kube-root-ca.crt',
                namespace: 'external-secrets',
                key: 'ca.crt',
              },
            },
          },
        },
      },
    });

    // Create base ExternalSecret that will be patched by ApplicationSet
    new ExternalSecret(this, 'base-external-secret', {
      metadata: {
        name: 'unpatched-vcluster-secret',
        namespace: 'argocd',
        annotations: {
          'argocd.argoproj.io/sync-wave': '20', // After ClusterSecretStore
        },
      },
      spec: {
        secretStoreRef: {
          name: 'unpatched-kubernetes-vcluster', // Will be patched
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'unpatched-vcluster-secret', // Will be patched
          template: {
            metadata: {
              labels: {
                'argocd.argoproj.io/secret-type': 'cluster',
              },
            },
            data: {
              name: 'unpatched-name', // Will be patched to actual vcluster name
              server: 'unpatched-server', // Will be patched to actual server URL
              config: '{"tlsClientConfig":{"caData":"{{ .ca | b64enc }}","certData":"{{ .cert | b64enc }}","keyData":"{{ .key | b64enc }}"}}',
            },
          },
        },
        data: [
          {
            secretKey: 'ca',
            remoteRef: {
              key: 'unpatched-key', // Will be patched to actual secret name
              property: 'certificate-authority',
            },
          },
          {
            secretKey: 'cert',
            remoteRef: {
              key: 'unpatched-key', // Will be patched to actual secret name
              property: 'client-certificate',
            },
          },
          {
            secretKey: 'key',
            remoteRef: {
              key: 'unpatched-key', // Will be patched to actual secret name
              property: 'client-key',
            },
          },
        ],
      },
    });
  }
}