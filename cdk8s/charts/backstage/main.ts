import { App } from 'cdk8s';
import { BackstageNamespaceRbacChart } from './backstage-namespace-rbac-chart';
import { BackstageDatabaseChart } from './backstage-database-chart';
import { BackstageSecretsChart } from './backstage-secrets-chart';
import { BackstageAppChart } from './backstage-app-chart';
import { BackstageArgoCDSecretsChart } from './backstage-argocd-secrets-chart';

/**
 * Standalone synthesis for Backstage charts
 * This creates the exact YAML output matching the existing manifests
 */
const app = new App();

// Create charts in order, respecting sync waves
// Note: ArgoCD secrets have resources in both argocd and backstage namespaces
new BackstageArgoCDSecretsChart(app, 'backstage-argocd-secrets');

// Main backstage resources
new BackstageNamespaceRbacChart(app, 'backstage-namespace-rbac');
new BackstageSecretsChart(app, 'backstage-secrets');
new BackstageDatabaseChart(app, 'backstage-database');
new BackstageAppChart(app, 'backstage-app');

app.synth();