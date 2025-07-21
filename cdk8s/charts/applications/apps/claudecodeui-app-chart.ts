import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for Claude Code UI
 * This application manages the Claude Code UI deployment and related resources
 */
export class ClaudeCodeUIAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.createApplication('claudecodeui', {
      resourcePath: 'claudecodeui', // Points to the synthesized Claude Code UI resources
      namespace: 'nextjs',
      project: 'applications',
      syncWave: '115', // Deploy after Next.js (110)
      labels: {
        'app.kubernetes.io/component': 'frontend',
        'app.kubernetes.io/part-of': 'application-stack',
        'app.kubernetes.io/name': 'claudecodeui'
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
          '/spec/replicas', // Allow HPA to manage replicas if added later
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