import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for Prometheus metrics storage
 * This is the primary metrics backend for kgateway and other components
 */
export class PrometheusAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // Prometheus deployment
    this.createApplication('prometheus', {
      resourcePath: 'prometheus',
      namespace: 'monitoring',
      project: 'observability',
      syncWave: '10', // Deploy before services that need metrics storage
      labels: {
        'app.kubernetes.io/component': 'metrics-storage',
        'app.kubernetes.io/part-of': 'observability',
        'app.kubernetes.io/name': 'prometheus'
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
      },
      ignoreDifferences: [{
        group: 'apps',
        kind: 'StatefulSet',
        jsonPointers: [
          '/spec/replicas'
        ]
      }]
    });
  }
}