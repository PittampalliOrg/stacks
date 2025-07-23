import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { 
  ClusterSecretStore,
  ClusterSecretStoreSpecProviderAzurekvAuthType
} from '../imports/external-secrets.io';

export interface AzureKeyVaultSecretStoreChartProps extends ChartProps {
  /**
   * Azure Key Vault name
   */
  keyVaultName?: string;
  
  /**
   * Service account name for workload identity
   * @default external-secrets
   */
  serviceAccountName?: string;
  
  /**
   * Service account namespace
   * @default external-secrets
   */
  serviceAccountNamespace?: string;
}

/**
 * Azure Key Vault SecretStore Chart
 * Creates a ClusterSecretStore for Azure Key Vault with workload identity authentication
 */
export class AzureKeyVaultSecretStoreChart extends Chart {
  constructor(scope: Construct, id: string, props: AzureKeyVaultSecretStoreChartProps = {}) {
    super(scope, id, props);

    const keyVaultName = props.keyVaultName || process.env.AZURE_KEYVAULT_NAME;
    
    if (!keyVaultName) {
      throw new Error('Azure Key Vault name is required. Set AZURE_KEYVAULT_NAME environment variable.');
    }

    const serviceAccountName = props.serviceAccountName || 'external-secrets';
    const serviceAccountNamespace = props.serviceAccountNamespace || 'external-secrets';

    // Create ClusterSecretStore for Azure Key Vault
    new ClusterSecretStore(this, 'azure-keyvault-store', {
      metadata: {
        name: 'azure-keyvault-store',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'app.kubernetes.io/component': 'external-secrets',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-92',
        },
      },
      spec: {
        provider: {
          azurekv: {
            vaultUrl: `https://${keyVaultName}.vault.azure.net`,
            authType: ClusterSecretStoreSpecProviderAzurekvAuthType.WORKLOAD_IDENTITY,
            serviceAccountRef: {
              name: serviceAccountName,
              namespace: serviceAccountNamespace,
            },
          },
        },
      },
    });
  }
}