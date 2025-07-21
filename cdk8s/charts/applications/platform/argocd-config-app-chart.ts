import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for ArgoCD configuration
 * This manages ArgoCD ConfigMaps, Secrets, and RBAC resources
 */
export class ArgoCDConfigAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.createApplication('argocd-config', {
      resourcePath: 'argocd-config',
      namespace: 'argocd',
      project: 'platform',
      syncWave: '-95', // Very early - ArgoCD needs its config before other resources
      labels: {
        'app.kubernetes.io/component': 'argocd-config',
        'app.kubernetes.io/part-of': 'platform-foundation'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true,
          allowEmpty: false
        },
        syncOptions: [
          'CreateNamespace=false', // ArgoCD namespace already exists
          'ServerSideApply=true',
          'RespectIgnoreDifferences=true',
          'Replace=true' // Replace existing ConfigMaps/Secrets
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
      // Ignore changes that ArgoCD makes to its own config
      ignoreDifferences: [{
        group: '',
        kind: 'ConfigMap',
        name: 'argocd-cm',
        jsonPointers: [
          '/data/admin.enabled'
        ]
      }, {
        group: '',
        kind: 'Secret',
        name: 'argocd-secret',
        jsonPointers: [
          '/data/admin.passwordMtime'
        ]
      }]
    });
  }
}