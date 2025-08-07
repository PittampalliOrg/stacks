import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { ClusterSecretStore, ClusterSecretStoreSpecProviderVaultVersion } from '../../imports/external-secrets.io';

export interface VaultSecretStoreChartProps extends ChartProps {
  namespace?: string;
}

export class VaultSecretStoreChart extends Chart {
  constructor(scope: Construct, id: string, props: VaultSecretStoreChartProps = {}) {
    super(scope, id, props);

    new ClusterSecretStore(this, 'vault-secret-store', {
      metadata: {
        name: 'vault-secret-store',
        annotations: {
          'argocd.argoproj.io/sync-wave': '2',
        },
        // Note: ClusterSecretStore is cluster-scoped, no namespace
      },
      spec: {
        provider: {
          vault: {
            server: 'http://vault.vault.svc.cluster.local:8200',
            path: 'secret',
            version: ClusterSecretStoreSpecProviderVaultVersion.V2,
            auth: {
              tokenSecretRef: {
                name: 'vault-root-token',
                key: 'token',
                namespace: 'vault',
              },
            },
          },
        },
      },
    });
  }
}