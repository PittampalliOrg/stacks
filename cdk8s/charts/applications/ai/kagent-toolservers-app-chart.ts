import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for Kagent Tool Servers
 * This application manages external tool servers for kagent agents via KGateway
 */
export class KagentToolServersAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.createApplication('kagent-toolservers', {
      resourcePath: 'kgateway-kagent-toolservers',
      namespace: 'kagent',
      project: 'ai-platform',
      syncWave: '86', // After agents (wave 85)
      labels: {
        'app.kubernetes.io/component': 'ai-toolservers',
        'app.kubernetes.io/part-of': 'kagent-platform',
        'app.kubernetes.io/name': 'kagent-toolservers'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true,
          allowEmpty: false
        },
        syncOptions: [
          'CreateNamespace=false', // Namespace created by platform-core
          'PrunePropagationPolicy=foreground',
          'PruneLast=true',
          'ServerSideApply=true'
        ],
        retry: {
          limit: 5,
          backoff: {
            duration: '5s',
            factor: 2,
            maxDuration: '3m'
          }
        }
      }
    });
  }
}