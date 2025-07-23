import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for ArgoCD webhook configuration
 * This manages the webhook secret for GitHub integration
 */
export class ArgoCDWebhookConfigAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.createApplication('argocd-webhook-config', {
      resourcePath: 'argocd-webhook-config',
      namespace: 'argocd',
      project: 'default',
      syncWave: '-90', // After argocd-config
      labels: {
        'app.kubernetes.io/component': 'argocd-webhook-config',
        'app.kubernetes.io/part-of': 'platform-foundation'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true,
          allowEmpty: false
        },
        syncOptions: [
          'CreateNamespace=false', // ArgoCD namespace already exists
          'ServerSideApply=true',
          'RespectIgnoreDifferences=true'
        ],
        retry: {
          limit: 5,
          backoff: {
            duration: '10s',
            factor: 2,
            maxDuration: '3m'
          }
        }
      },
      // Ignore differences in the webhook secret that might be updated externally
      ignoreDifferences: [{
        group: '',
        kind: 'Secret',
        name: 'argocd-secret',
        jsonPointers: [
          '/data/webhook.github.secret'
        ]
      }]
    });
  }
}