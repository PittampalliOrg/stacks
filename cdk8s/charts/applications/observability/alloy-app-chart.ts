import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for Alloy ingress and additional resources
 * Alloy itself is deployed via Helm, but we need to deploy the ingress separately
 */
export class AlloyAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // Alloy ingress and additional resources
    this.createApplication('alloy-resources', {
      resourcePath: 'alloy', // Contains ingress and service definitions
      namespace: 'monitoring',
      project: 'observability',
      syncWave: '15', // After Alloy Helm deployment
      labels: {
        'app.kubernetes.io/component': 'collector',
        'app.kubernetes.io/part-of': 'observability',
        'app.kubernetes.io/name': 'alloy'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true,
          allowEmpty: false
        },
        syncOptions: [
          'CreateNamespace=true',
          'ServerSideApply=true'
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