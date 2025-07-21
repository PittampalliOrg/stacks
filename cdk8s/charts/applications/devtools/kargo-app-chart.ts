import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for Kargo GitOps promotions
 * This application manages Kargo resources for multi-stage deployments
 */
export class KargoAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // Kargo pipeline resources
    // REMOVED: Kargo pipeline resources are now managed at bootstrap level
    // The kargo.k8s.yaml only contains the ingress, which is managed by kargo-ingress app
    /*
    this.createApplication('kargo-pipeline', {
      resourcePath: 'kargo', // Kargo projects, stages, warehouses
      namespace: 'kargo',
      project: 'devtools',
      syncWave: '90', // After most infrastructure
      labels: {
        'app.kubernetes.io/component': 'gitops-promotions',
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
    */
    
    // REMOVED: kargo-credentials application - moved to platform project
    // The infra-secrets resources are all in nextjs namespace which devtools project cannot access
  }
}