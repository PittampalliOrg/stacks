import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for monitoring infrastructure
 * This application deploys the Helm-based monitoring stack (Loki, Tempo, Grafana, Alloy)
 */
export class MonitoringInfraAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // Create application that deploys all monitoring infrastructure
    this.createApplication('monitoring-infra', {
      resourcePath: 'monitoring-helm-apps',
      namespace: 'argocd', // Applications are created in argocd namespace
      project: 'default', // Use platform project as these are infrastructure components
      syncWave: '-10', // Deploy early as other apps depend on monitoring
      labels: {
        'app.kubernetes.io/component': 'monitoring',
        'app.kubernetes.io/part-of': 'infrastructure',
        'app.kubernetes.io/name': 'monitoring-infra'
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