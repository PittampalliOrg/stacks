import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Cert Manager ClusterIssuers Application Chart
 * 
 * Deploys Let's Encrypt ClusterIssuers after cert-manager is installed.
 * This allows automatic TLS certificate provisioning for ingress resources.
 */
export class CertManagerIssuersAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);
    
    this.createApplication('cert-manager-issuers', {
      resourcePath: 'cert-manager-issuers',
      namespace: 'default', // ClusterIssuers are cluster-scoped
      project: 'default',
      syncWave: '-290', // After cert-manager (-295)
      
      // No helm configuration needed - this is a directory-based app
      syncOptions: [
        'CreateNamespace=false', // No namespace needed for cluster-scoped resources
        'ServerSideApply=true',
      ],
      
      labels: {
        'app.kubernetes.io/component': 'cert-manager-issuers',
        'app.kubernetes.io/part-of': 'platform',
      },
      
      annotations: {
        'argocd.argoproj.io/sync-wave': '-290',
      },
    });
  }
}