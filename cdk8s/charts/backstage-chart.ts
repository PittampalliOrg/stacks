import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { BackstageNamespaceRbacChart } from './backstage/backstage-namespace-rbac-chart';
import { BackstageDatabaseChart } from './backstage/backstage-database-chart';
import { BackstageSecretsChart } from './backstage/backstage-secrets-chart';
import { BackstageAppChart } from './backstage/backstage-app-chart';
import { BackstageArgoCDSecretsChart } from './backstage/backstage-argocd-secrets-chart';

/**
 * Main Backstage chart that combines all Backstage components
 */
export class BackstageChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    // Create all Backstage resources in the correct order
    // Note: Some resources from argocd-secrets.yaml go into argocd namespace
    new BackstageArgoCDSecretsChart(this, 'argocd-secrets');
    new BackstageNamespaceRbacChart(this, 'namespace-rbac');
    new BackstageSecretsChart(this, 'secrets');
    new BackstageDatabaseChart(this, 'database');
    new BackstageAppChart(this, 'app');
  }
}