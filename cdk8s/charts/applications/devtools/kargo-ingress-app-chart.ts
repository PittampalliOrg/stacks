import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for Kargo ingress
 * This application deploys the ingress for Kargo UI access
 */
export class KargoIngressAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.createApplication('kargo-ingress', {
      resourcePath: 'kargo', // Will match 0015-kargo.k8s.yaml
      namespace: 'kargo',
      project: 'devtools',
      syncWave: '80', // After Kargo Helm chart
      labels: {
        'app.kubernetes.io/component': 'ingress',
        'app.kubernetes.io/part-of': 'kargo',
        'app.kubernetes.io/name': 'kargo-ingress'
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