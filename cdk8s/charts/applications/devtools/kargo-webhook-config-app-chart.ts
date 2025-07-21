import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for Kargo webhook configuration
 * This application manages webhook receivers and credentials for automatic freight discovery
 */
export class KargoWebhookConfigAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // Kargo Webhook Configuration Application
    this.createApplication('kargo-webhook-config', {
      resourcePath: 'kargo-webhook-config',
      namespace: 'nextjs', // Resources are created in nextjs namespace
      project: 'devtools',
      syncWave: '-40', // After Kargo pipeline but before actual deployments
      labels: {
        'app.kubernetes.io/component': 'webhook-config',
        'app.kubernetes.io/part-of': 'kargo',
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true,
          allowEmpty: false
        },
        syncOptions: [
          'CreateNamespace=true',
          'ServerSideApply=true',
        ],
        retry: {
          limit: 5,
          backoff: {
            duration: '10s',
            factor: 2,
            maxDuration: '3m'
          }
        }
      }
    });
  }
}