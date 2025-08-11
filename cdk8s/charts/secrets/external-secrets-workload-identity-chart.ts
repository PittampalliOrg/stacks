import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { KubeServiceAccount } from '../../imports/k8s';

export interface ExternalSecretsWorkloadIdentityChartProps extends ChartProps {
  azureClientId?: string;
  azureTenantId?: string;
}

/**
 * External Secrets Workload Identity Chart
 * Patches the external-secrets service account with Azure Workload Identity annotations
 * This enables the external-secrets operator to authenticate to Azure KeyVault
 * 
 * Note: This assumes the external-secrets operator is already installed in the cluster
 */
export class ExternalSecretsWorkloadIdentityChart extends Chart {
  public readonly serviceAccountPatch: KubeServiceAccount;

  constructor(scope: Construct, id: string, props: ExternalSecretsWorkloadIdentityChartProps = {}) {
    super(scope, id, props);

    const azureClientId = props.azureClientId || process.env.AZURE_CLIENT_ID || '';
    const azureTenantId = props.azureTenantId || process.env.AZURE_TENANT_ID || '0c4da9c5-40ea-4e7d-9c7a-e7308d4f8e38';

    // Patch/ensure the external-secrets ServiceAccount has Azure Workload Identity annotations
    // ArgoCD ServerSideApply ensures non-destructive updates if it already exists
    this.serviceAccountPatch = new KubeServiceAccount(this, 'external-secrets-sa-patch', {
      metadata: {
        name: 'external-secrets',
        namespace: 'external-secrets',
        annotations: {
          'azure.workload.identity/client-id': azureClientId,
          'azure.workload.identity/tenant-id': azureTenantId,
          'argocd.argoproj.io/sync-options': 'ServerSideApply=true',
          'argocd.argoproj.io/sync-wave': '-94',
        },
        labels: {
          'azure.workload.identity/use': 'true',
        },
      },
    });
  }
}
