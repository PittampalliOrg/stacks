import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

export interface PlatformPrerequisitesChartProps extends ChartProps {
  azureClientId?: string;
  azureTenantId?: string;
}

/**
 * Creates prerequisite resources that other charts depend on
 * This ensures all dependencies are satisfied before main deployment
 */
export class PlatformPrerequisitesChart extends Chart {
  constructor(scope: Construct, id: string, props: PlatformPrerequisitesChartProps = {}) {
    super(scope, id, props);

    // Note: external-secrets namespace is created by platform-core-chart.ts
    // Note: argo namespace is created by platform-core-chart.ts

    // Create the external-secrets ServiceAccount that the operator uses
    new k8s.KubeServiceAccount(this, 'external-secrets-sa', {
      metadata: {
        name: 'external-secrets',
        namespace: 'external-secrets',
        annotations: {
          'azure.workload.identity/client-id': process.env.AZURE_CLIENT_ID || process.env.APP_ID || '',
          'azure.workload.identity/use': 'true',
          'azure.workload.identity/tenant-id': process.env.AZURE_TENANT_ID || '',
        },
        labels: {
          'app.kubernetes.io/name': 'external-secrets',
          'app.kubernetes.io/component': 'external-secrets'
        }
      }
    });

    // Note: keyvault ServiceAccount has been moved to workload-identity-presync-chart.ts
    // to ensure it's created with proper sync wave ordering

    // DNS configuration is now handled by the Makefile before ArgoCD deployment
    // This avoids the chicken-and-egg problem where ArgoCD needs DNS to work

    // Create a NetworkPolicy that ensures DNS traffic is allowed
    new k8s.KubeNetworkPolicy(this, 'allow-dns', {
      metadata: {
        name: 'allow-dns-traffic',
        namespace: 'kube-system',
        annotations: {
        }
      },
      spec: {
        podSelector: {},
        policyTypes: ['Egress'],
        egress: [
          {
            ports: [
              {
                protocol: 'UDP',
                port: k8s.IntOrString.fromNumber(53)
              },
              {
                protocol: 'TCP',
                port: k8s.IntOrString.fromNumber(53)
              }
            ]
          }
        ]
      }
    });
  }
}