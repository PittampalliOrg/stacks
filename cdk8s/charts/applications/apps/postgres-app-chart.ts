import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for PostgreSQL/Neon
 * This application manages the PostgreSQL deployment resources
 */
export class PostgresAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.createApplication('postgres', {
      resourcePath: 'postgres', // Points to the synthesized Postgres resources
      namespace: 'nextjs',
      project: 'applications',
      syncWave: '90', // Deploy before applications that depend on it
      labels: {
        'app.kubernetes.io/component': 'database',
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
      },
      // Ignore dynamic fields
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