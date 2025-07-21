import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates ArgoCD Application for Headlamp Secrets
 * Manages External Secrets for Headlamp Azure AD authentication
 */
export class HeadlampSecretsAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.createApplication('headlamp-secrets', {
      resourcePath: 'headlamp-secrets',
      namespace: 'monitoring',
      project: 'observability',
      syncWave: '-15', // Deploy before Headlamp application
      syncOptions: [
        'CreateNamespace=true'
      ],
      labels: {
        'app.kubernetes.io/component': 'secrets',
        'app.kubernetes.io/part-of': 'headlamp',
        'app.kubernetes.io/managed-by': 'cdk8s'
      }
    });
  }
}