import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for Kagent custom AI agents
 * This application manages DevOps, Security, Data Engineering, GitHub, and Grafana agents
 */
export class KagentAgentsAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.createApplication('kagent-agents', {
      resourcePath: 'kagent-agents',
      namespace: 'kagent',
      project: 'ai-platform',
      syncWave: '85', // After models (wave 84)
      labels: {
        'app.kubernetes.io/component': 'ai-agents',
        'app.kubernetes.io/part-of': 'kagent-platform',
        'app.kubernetes.io/name': 'kagent-agents'
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