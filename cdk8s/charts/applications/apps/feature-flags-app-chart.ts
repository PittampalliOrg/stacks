import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for all feature flag definitions
 * This application manages FeatureFlag custom resources across the platform
 */
export class FeatureFlagsAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // Demo feature flags
    this.createApplication('feature-flags-demo', {
      resourcePath: 'feature-flags-demo', // Demo FeatureFlag resources
      namespace: 'default',
      project: 'applications',
      syncWave: '15', // Before flagd deployment (wave 20)
      labels: {
        'app.kubernetes.io/component': 'feature-flags',
        'app.kubernetes.io/part-of': 'configuration',
        'feature-flags.openfeature.dev/managed': 'true'
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
      ignoreDifferences: [{
        group: 'core.openfeature.dev',
        kind: 'FeatureFlag',
        jsonPointers: [
          '/status' // Ignore status updates from the operator
        ]
      }]
    });
    
    // NextJS application feature flags
    this.createApplication('nextjs-feature-flags', {
      resourcePath: 'nextjs-feature-flags', // NextJS FeatureFlag resources
      namespace: 'default',
      project: 'applications',
      syncWave: '15', // Before flagd deployment (wave 20)
      labels: {
        'app.kubernetes.io/component': 'feature-flags',
        'app.kubernetes.io/part-of': 'nextjs',
        'feature-flags.openfeature.dev/managed': 'true'
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
      ignoreDifferences: [{
        group: 'core.openfeature.dev',
        kind: 'FeatureFlag',
        jsonPointers: [
          '/status',
          '/metadata/annotations/kubectl.kubernetes.io~1last-applied-configuration'
        ]
      }]
    });
  }
}