import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for Redis
 * This application manages the Redis deployment and service resources
 */
export class RedisAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.createApplication('redis', {
      resourcePath: 'redis', // Points to the synthesized Redis resources
      namespace: 'nextjs',
      project: 'applications',
      syncWave: '100', // Deploy after infrastructure
      labels: {
        'app.kubernetes.io/component': 'cache',
        'app.kubernetes.io/part-of': 'application-stack'
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