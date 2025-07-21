import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';

export interface ArgoCDWebhookConfigChartProps extends ChartProps {}

/**
 * ArgoCD Webhook Configuration Chart
 * Configures webhook secret for GitHub integration to enable instant Git synchronization
 */
export class ArgoCDWebhookConfigChart extends Chart {
  constructor(scope: Construct, id: string, props: ArgoCDWebhookConfigChartProps = {}) {
    super(scope, id, props);

    const namespace = 'argocd';

    // External Secret for ArgoCD GitHub webhook secret
    // This patches the existing argocd-secret with the webhook configuration
    new ApiObject(this, 'argocd-webhook-secret-external', {
      apiVersion: 'external-secrets.io/v1',
      kind: 'ExternalSecret',
      metadata: {
        name: 'argocd-webhook-secret-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'argocd-webhook-secret',
          'app.kubernetes.io/part-of': 'argocd',
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-90', // After argocd-secret is created
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore',
        },
        target: {
          name: 'argocd-secret',
          creationPolicy: 'Merge', // Merge with existing secret
          template: {
            mergePolicy: 'Merge',
            data: {
              'webhook.github.secret': '{{ .webhookSecret }}'
            }
          }
        },
        data: [{
          secretKey: 'webhookSecret',
          remoteRef: {
            key: 'ARGOCD-GITHUB-WEBHOOK-SECRET',
            conversionStrategy: 'Default',
            decodingStrategy: 'None',
            metadataPolicy: 'None'
          }
        }]
      }
    });

    // ConfigMap patch to update the webhook payload size limit (optional)
    new ApiObject(this, 'argocd-cm-webhook-patch', {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: 'argocd-cm',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-options': 'Prune=false', // Don't prune existing keys
          'argocd.argoproj.io/sync-wave': '-90',
        }
      },
      data: {
        // Set webhook payload size limit to 10MB (default is 50MB)
        // This helps prevent DDoS attacks
        'webhook.maxPayloadSizeMB': '10'
      }
    });
  }
}