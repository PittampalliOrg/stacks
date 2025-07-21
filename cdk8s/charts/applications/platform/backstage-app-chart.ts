import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Backstage Developer Portal Application
 * Provides a unified interface for accessing all platform services
 */
export class BackstageAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.createApplication('backstage', {
      resourcePath: 'backstage',
      namespace: 'backstage',
      project: 'platform',
      syncWave: '95', // After databases are ready
      labels: {
        'app.kubernetes.io/component': 'portal',
        'app.kubernetes.io/part-of': 'backstage'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: false,  // Disabled to allow DevSpace development
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