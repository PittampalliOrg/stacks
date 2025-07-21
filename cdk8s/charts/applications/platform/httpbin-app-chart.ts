import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for Httpbin test app
 * Deploys httpbin for testing gateway functionality
 */
export class HttpbinAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // Httpbin test application
    this.createApplication('httpbin', {
      resourcePath: 'httpbin',
      namespace: 'default',
      project: 'platform',
      syncWave: '87', // After http-gateway (86)
      labels: {
        'app.kubernetes.io/component': 'httpbin',
        'app.kubernetes.io/part-of': 'kgateway-test',
        'app.kubernetes.io/name': 'httpbin'
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
      ignoreDifferences: [{
        group: '',
        kind: 'Service',
        jsonPointers: [
          '/spec/clusterIP',
          '/spec/clusterIPs'
        ]
      }]
    });
  }
}