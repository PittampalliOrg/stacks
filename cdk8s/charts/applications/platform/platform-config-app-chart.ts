import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for platform core resources
 * This application manages ALL platform-core resources including:
 * - Namespaces (created automatically via CreateNamespace=true)
 * - ConfigMaps for platform-wide configuration
 * - ClusterRoles and Ingress resources
 */
export class PlatformConfigAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.createApplication('platform-config', {
      resourcePath: 'platform-core', // Contains all platform core resources
      namespace: 'default',
      project: 'default',
      syncWave: '-80', // After RBAC but before other resources
      labels: {
        'app.kubernetes.io/component': 'configuration',
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
      // Ignore ConfigMap fields that might be updated by other systems
      ignoreDifferences: [{
        group: '',
        kind: 'ConfigMap',
        jsonPointers: [
          '/metadata/annotations',
          '/metadata/labels/app.kubernetes.io~1version', // Version labels might change
          '/binaryData', // Binary data comparisons can be problematic
          '/data/last-updated' // Timestamp fields
        ]
      }]
    });
    
    // Also manage OpenFeature configuration
    this.createApplication('openfeature-config', {
      resourcePath: 'openfeature-config', // OpenFeature ConfigMaps and FeatureFlags
      namespace: 'default',
      project: 'default',
      syncWave: '-75', // After platform-config
      labels: {
        'app.kubernetes.io/component': 'feature-flags-config',
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
    
    // Flagd UI for NextJS namespace
    this.createApplication('flagd-ui-nextjs', {
      resourcePath: 'flagd-ui-nextjs', // Flagd UI deployment for NextJS
      namespace: 'nextjs',
      project: 'default',
      syncWave: '-70', // After OpenFeature config
      labels: {
        'app.kubernetes.io/component': 'feature-flag-ui',
        'app.kubernetes.io/part-of': 'platform-foundation',
        'app.kubernetes.io/name': 'flagd-ui-nextjs'
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