import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for infrastructure apps
 * This application manages core infrastructure components like NGINX ingress controller
 */
export class InfrastructureAppsAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // Infrastructure apps (NGINX Ingress Controller, etc.)
    this.createApplication('infrastructure-apps', {
      resourcePath: 'infrastructure-apps',
      namespace: 'argocd', // Application itself lives in argocd namespace
      project: 'platform',
      syncWave: '-95', // Deploy very early, before any apps that need ingress
      labels: {
        'app.kubernetes.io/component': 'infrastructure',
        'app.kubernetes.io/part-of': 'platform',
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
          'Replace=true', // Force replace for CRDs if needed
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