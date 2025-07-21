import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for Next.js
 * This application manages the Next.js deployment and related resources
 */
export class NextJsAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.createApplication('nextjs', {
      resourcePath: 'nextjs', // Points to the synthesized Next.js resources
      namespace: 'nextjs',
      project: 'applications',
      syncWave: '110', // Deploy after database and cache
      labels: {
        'app.kubernetes.io/component': 'frontend',
        'app.kubernetes.io/part-of': 'application-stack',
        'app.kubernetes.io/name': 'nextjs'
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
          'ApplyOutOfSyncOnly=true' // Only apply changes, not unchanged resources
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
      // Ignore fields that change frequently
      ignoreDifferences: [{
        group: 'apps',
        kind: 'Deployment',
        jsonPointers: [
          '/spec/replicas', // Allow HPA to manage replicas
          '/spec/template/metadata/annotations' // Ignore pod annotations
        ]
      }, {
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