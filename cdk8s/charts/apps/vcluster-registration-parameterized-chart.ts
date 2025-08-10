import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { 
  ClusterSecretStore, 
  ExternalSecret, 
  ExternalSecretSpecSecretStoreRefKind, 
  ClusterSecretStoreSpecProviderKubernetesServerCaProviderType 
} from '../../imports/external-secrets.io';

export interface VclusterRegistrationParameterizedChartProps extends ChartProps {
  environmentName: string;
}

/**
 * Creates vcluster registration resources for a specific environment
 * Generates complete manifests with actual values (no placeholders)
 */
export class VclusterRegistrationParameterizedChart extends Chart {
  constructor(scope: Construct, id: string, props: VclusterRegistrationParameterizedChartProps) {
    super(scope, id, props);

    const envName = props.environmentName;

    // Create ClusterSecretStore for this specific environment
    new ClusterSecretStore(this, `${envName}-cluster-secret-store`, {
      metadata: {
        name: `kubernetes-${envName}-vcluster`,
        annotations: {
          'argocd.argoproj.io/sync-wave': '15',
        },
      },
      spec: {
        provider: {
          kubernetes: {
            remoteNamespace: `${envName}-vcluster`,
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

    // Create ExternalSecret for this specific environment
    new ExternalSecret(this, `${envName}-external-secret`, {
      metadata: {
        name: `${envName}-vcluster-secret`,
        namespace: 'argocd',
        annotations: {
          'argocd.argoproj.io/sync-wave': '20',
        },
      },
      spec: {
        secretStoreRef: {
          name: `kubernetes-${envName}-vcluster`,
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: `${envName}-vcluster-secret`,
          template: {
            metadata: {
              labels: {
                'argocd.argoproj.io/secret-type': 'cluster',
              },
            },
            data: {
              name: `${envName}-vcluster`,
              server: `https://${envName}-vcluster-helm.${envName}-vcluster.svc:443`,
              config: '{"tlsClientConfig":{"caData":"{{ .ca | b64enc }}","certData":"{{ .cert | b64enc }}","keyData":"{{ .key | b64enc }}"}}',
            },
          },
        },
        data: [
          {
            secretKey: 'ca',
            remoteRef: {
              key: `vc-${envName}-vcluster-helm`,
              property: 'certificate-authority',
            },
          },
          {
            secretKey: 'cert',
            remoteRef: {
              key: `vc-${envName}-vcluster-helm`,
              property: 'client-certificate',
            },
          },
          {
            secretKey: 'key',
            remoteRef: {
              key: `vc-${envName}-vcluster-helm`,
              property: 'client-key',
            },
          },
        ],
      },
    });
  }
}