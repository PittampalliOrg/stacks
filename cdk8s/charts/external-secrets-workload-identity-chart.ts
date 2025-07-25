import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';

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
  public readonly serviceAccountPatch: ApiObject;

  constructor(scope: Construct, id: string, props: ExternalSecretsWorkloadIdentityChartProps = {}) {
    super(scope, id, props);

    const azureClientId = props.azureClientId || process.env.AZURE_CLIENT_ID || '';
    const azureTenantId = props.azureTenantId || process.env.AZURE_TENANT_ID || '0c4da9c5-40ea-4e7d-9c7a-e7308d4f8e38';

    // Patch the existing external-secrets ServiceAccount with Azure Workload Identity annotations
    // Using a strategic merge patch to add annotations without replacing the entire resource
    this.serviceAccountPatch = new ApiObject(this, 'external-secrets-sa-patch', {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: {
        name: 'external-secrets',
        namespace: 'external-secrets',
        annotations: {
          'azure.workload.identity/client-id': azureClientId,
          'azure.workload.identity/tenant-id': azureTenantId,
          'argocd.argoproj.io/sync-options': 'ServerSideApply=true',
          'argocd.argoproj.io/sync-wave': '-94', // Early, but after external-secrets operator installation
        },
        labels: {
          'azure.workload.identity/use': 'true',
        },
      },
    });
  }
}