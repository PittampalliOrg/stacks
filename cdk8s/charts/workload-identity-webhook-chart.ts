import { Chart, ChartProps, Helm } from 'cdk8s';
import { Construct } from 'constructs';

export interface WorkloadIdentityWebhookChartProps extends ChartProps {
  /**
   * Azure Tenant ID for workload identity
   */
  azureTenantId?: string;
  
  /**
   * Cluster type (kind or aks)
   * @default - determined from environment variable CLUSTER_TYPE
   */
  clusterType?: string;
}

/**
 * Workload Identity Webhook Chart
 * Deploys Azure Workload Identity webhook for KIND clusters
 * AKS clusters have workload identity pre-installed
 */
export class WorkloadIdentityWebhookChart extends Chart {
  constructor(scope: Construct, id: string, props: WorkloadIdentityWebhookChartProps = {}) {
    super(scope, id, props);

    const clusterType = props.clusterType || process.env.CLUSTER_TYPE || 'kind';
    const azureTenantId = props.azureTenantId || process.env.AZURE_TENANT_ID;

    if (!azureTenantId) {
      throw new Error('Azure Tenant ID is required. Set AZURE_TENANT_ID environment variable.');
    }

    // Only deploy webhook for KIND clusters
    if (clusterType.toLowerCase() === 'kind') {
      new Helm(this, 'workload-identity-webhook', {
        chart: 'workload-identity-webhook',
        repo: 'https://azure.github.io/azure-workload-identity/charts',
        namespace: 'azure-workload-identity-system',
        values: {
          azureTenantID: azureTenantId,
        },
        helmFlags: [
          '--wait',
          '--create-namespace',
        ],
      });
    }
  }
}