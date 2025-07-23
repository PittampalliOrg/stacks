import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for the Flagd platform service
 * This application manages the core Flagd deployment, service, RBAC, and networking
 */
export class FlagdPlatformAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.createApplication('flagd-platform', {
      resourcePath: 'flagd-service', // Core flagd service resources
      namespace: 'default',
      project: 'default',
      syncWave: '20', // After platform foundation but before applications
      labels: {
        'app.kubernetes.io/component': 'feature-flags',
        'app.kubernetes.io/part-of': 'platform-services',
        'app.kubernetes.io/name': 'flagd'
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
      // Ignore fields that might be managed by HPA or other controllers
      ignoreDifferences: [{
        group: 'apps',
        kind: 'Deployment',
        jsonPointers: [
          '/spec/replicas' // Managed by HPA
        ]
      }, {
        group: 'autoscaling',
        kind: 'HorizontalPodAutoscaler',
        jsonPointers: [
          '/status',
          '/metadata/annotations'
        ]
      }, {
        group: 'networking.k8s.io',
        kind: 'NetworkPolicy',
        jsonPointers: [
          '/metadata/annotations'
        ]
      }]
    });
  }
}