import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for platform RBAC resources
 * This application manages ClusterRoles, ServiceAccounts, and RoleBindings
 */
export class PlatformRbacAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.createApplication('platform-rbac', {
      resourcePath: 'platform-prerequisites', // Contains ServiceAccounts and RBAC
      namespace: 'default', // RBAC resources are often cluster-scoped
      project: 'default',
      syncWave: '-90', // Very early - RBAC needs to exist before resources that use it
      labels: {
        'app.kubernetes.io/component': 'rbac',
        'app.kubernetes.io/part-of': 'platform-foundation'
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
          'PrunePropagationPolicy=orphan' // Don't cascade delete RBAC
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
      // Ignore common RBAC differences
      ignoreDifferences: [{
        group: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        jsonPointers: [
          '/metadata/annotations',
          '/rules' // In case of aggregated rules
        ]
      }, {
        group: 'rbac.authorization.k8s.io',
        kind: 'ClusterRoleBinding',
        jsonPointers: [
          '/metadata/annotations'
        ]
      }, {
        group: '',
        kind: 'ServiceAccount',
        jsonPointers: [
          '/metadata/annotations',
          '/secrets' // Auto-generated secrets
        ]
      }]
    });
  }
}