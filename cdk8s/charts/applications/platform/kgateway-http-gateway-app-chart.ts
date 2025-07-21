import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for HTTP Gateway
 * Deploys a simple HTTP gateway for testing
 */
export class KGatewayHTTPGatewayAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // HTTP Gateway for testing
    this.createApplication('kgateway-http-gateway', {
      resourcePath: 'kgateway-http-gateway',
      namespace: 'kgateway-system',
      project: 'platform',
      syncWave: '86', // After kgateway itself
      labels: {
        'app.kubernetes.io/component': 'http-gateway',
        'app.kubernetes.io/part-of': 'kgateway',
        'app.kubernetes.io/name': 'http-gateway'
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