import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { 
  ExternalSecretV1Beta1 as ExternalSecret,
  ClusterSecretStoreV1Beta1 as ClusterSecretStore,
  ClusterSecretStoreV1Beta1SpecProviderAzurekvAuthType,
  ExternalSecretV1Beta1SpecTargetCreationPolicy
} from '../imports/external-secrets.io';
import { ExternalSecretsWorkloadIdentityChart } from './external-secrets-workload-identity-chart';

export interface BootstrapSecretsChartProps extends ChartProps {
  externalSecretsWorkloadIdentity?: ExternalSecretsWorkloadIdentityChart;
}

/**
 * Bootstrap Secrets Chart
 * Manages initial secrets required for ArgoCD to access private repositories
 * This includes the GitHub App credentials for repository access
 */
export class BootstrapSecretsChart extends Chart {
  constructor(scope: Construct, id: string, props: BootstrapSecretsChartProps = {}) {
    super(scope, id, props);

    // GitHub App Repository Credentials ExternalSecret
    new ExternalSecret(this, 'github-app-repo-creds-external', {
      metadata: {
        name: 'github-app-repo-creds-external',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'bootstrap',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-90',
        },
      },
      spec: {
        refreshInterval: '10m',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore',
        },
        target: {
          name: 'github-app-repo-creds-from-external',
          creationPolicy: ExternalSecretV1Beta1SpecTargetCreationPolicy.OWNER,
          template: {
            metadata: {
              labels: {
                'argocd.argoproj.io/secret-type': 'repository',
              },
            },
            data: {
              // Repository details
              type: 'git',
              url: 'https://github.com/PittampalliOrg/cdk8s-project.git',
              // GitHub App authentication
              githubAppID: '1272071',
              githubAppInstallationID: '66754705',
              githubAppPrivateKey: '{{ .ghPrivateKey | toString }}',
            },
          },
        },
        data: [
          {
            secretKey: 'ghPrivateKey',
            remoteRef: {
              key: 'github-app-private-key',
            },
          },
        ],
      },
    });

    // Azure KeyVault ClusterSecretStore
    // This is created here as it's required for all other ExternalSecrets
    const clusterSecretStore = new ClusterSecretStore(this, 'azure-keyvault-store', {
      metadata: {
        name: 'azure-keyvault-store',
        labels: {
          'app.kubernetes.io/managed-by': 'bootstrap',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-92',
        },
      },
      spec: {
        provider: {
          azurekv: {
            vaultUrl: `https://${process.env.AZURE_KEYVAULT_NAME}.vault.azure.net`,
            authType: ClusterSecretStoreV1Beta1SpecProviderAzurekvAuthType.WORKLOAD_IDENTITY,
            serviceAccountRef: {
              name: 'external-secrets',
              namespace: 'external-secrets',
            },
          },
        },
      },
    });

    // Add dependency on workload identity if provided
    if (props.externalSecretsWorkloadIdentity) {
      clusterSecretStore.addDependency(props.externalSecretsWorkloadIdentity.serviceAccountPatch);
    }

    // GitHub PEM Key ExternalSecret
    // This is used by various GitHub integrations
    new ExternalSecret(this, 'github-pem', {
      metadata: {
        name: 'github-pem',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'bootstrap',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-90',
        },
      },
      spec: {
        refreshInterval: '10m',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore',
        },
        target: {
          name: 'github-pem',
          creationPolicy: ExternalSecretV1Beta1SpecTargetCreationPolicy.OWNER,
        },
        data: [
          {
            secretKey: 'privateKey',
            remoteRef: {
              key: 'github-app-private-key',
            },
          },
        ],
      },
    });
  }
}