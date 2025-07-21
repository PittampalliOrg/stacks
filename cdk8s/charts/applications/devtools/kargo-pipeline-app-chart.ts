import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for Kargo Pipeline resources
 * Deploys Kargo Projects, Warehouses, and Stages for the Next.js application
 */
export class KargoPipelineAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // Kargo pipeline resources (Project, Warehouse, Stages)
    this.createApplication('kargo-pipeline', {
      resourcePath: 'kargo-pipeline', // Will match [0-9][0-9][0-9][0-9]-kargo-pipeline.k8s.yaml
      namespace: 'nextjs', // Kargo resources will be created in nextjs namespace
      project: 'devtools',
      syncWave: '95', // After Kargo itself is deployed
      labels: {
        'app.kubernetes.io/component': 'gitops-pipeline',
        'app.kubernetes.io/part-of': 'kargo',
        'app.kubernetes.io/name': 'kargo-pipeline'
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
          'RespectIgnoreDifferences=true',
          'SkipDryRunOnMissingResource=true' // Kargo CRDs might not be ready
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
        group: 'kargo.akuity.io',
        kind: 'Project',
        jsonPointers: [
          '/status',
          '/metadata/annotations'
        ]
      }, {
        group: 'kargo.akuity.io',
        kind: 'Stage',
        jsonPointers: [
          '/status',
          '/spec/requestedFreight', // Freight requests are dynamic
          '/metadata/annotations/kargo.akuity.io~1approved-freight' // Approval annotations
        ]
      }, {
        group: 'kargo.akuity.io',
        kind: 'Warehouse',
        jsonPointers: [
          '/status',
          '/spec/subscriptions/[*]/discoveryLimit' // Discovery limits might be adjusted
        ]
      }, {
        group: 'kargo.akuity.io',
        kind: 'Freight',
        jsonPointers: [
          '/status',
          '/metadata' // Freight metadata is highly dynamic
        ]
      }]
    });
  }
}