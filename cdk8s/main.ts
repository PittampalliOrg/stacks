import { App, YamlOutputType } from 'cdk8s';
import * as fs from 'fs';
import * as path from 'path';
import { NextJsChart } from './charts/nextjs-chart';
import { NextJsSecretsChart } from './charts/nextjs-secrets-chart';
import { InfraSecretsChart } from './charts/infra-secrets-chart';
import { PostgresChart } from './charts/postgres-chart';
import { RedisChart } from './charts/redis-chart';
import { BootstrapSecretsChart } from './charts/bootstrap-secrets-chart';
import { ExternalSecretsWorkloadIdentityChart } from './charts/external-secrets-workload-identity-chart';
import { HeadlampChart } from './charts/headlamp-chart';
import { HeadlampKeycloakSecretsChart } from './charts/headlamp-keycloak-secrets-chart';
import { KeycloakHeadlampClientChart } from './charts/keycloak-headlamp-client-chart';
import { BackstageSecretsChart } from './charts/backstage-secrets-chart';
import { ArgoApplicationsChart } from './charts/apps/argo-applications-chart';
import { IdpBuilderChartFactory } from './lib/idpbuilder-chart-factory';
import { applicationConfigs } from './config/applications';

const outputDir = 'dist';

// Register all available charts with the factory
IdpBuilderChartFactory.register('BootstrapSecretsChart', BootstrapSecretsChart);
IdpBuilderChartFactory.register('ExternalSecretsWorkloadIdentityChart', ExternalSecretsWorkloadIdentityChart);
IdpBuilderChartFactory.register('HeadlampChart', HeadlampChart);
IdpBuilderChartFactory.register('HeadlampKeycloakSecretsChart', HeadlampKeycloakSecretsChart);
IdpBuilderChartFactory.register('KeycloakHeadlampClientChart', KeycloakHeadlampClientChart);
IdpBuilderChartFactory.register('BackstageSecretsChart', BackstageSecretsChart);
IdpBuilderChartFactory.register('InfraSecretsChart', InfraSecretsChart);
IdpBuilderChartFactory.register('NextJsChart', NextJsChart);
IdpBuilderChartFactory.register('NextJsSecretsChart', NextJsSecretsChart);
IdpBuilderChartFactory.register('PostgresChart', PostgresChart);
IdpBuilderChartFactory.register('RedisChart', RedisChart);
// Add more chart registrations here as you create them

// Main synthesis function
async function main() {
  // Process each application configuration
  for (const appConfig of applicationConfigs) {
    console.log(`Synthesizing application: ${appConfig.name}`);
    
    try {
      // 1. Generate manifests for the application
      const manifestApp = new App({
        yamlOutputType: YamlOutputType.FILE_PER_APP,  // All resources in one file
        outdir: `${outputDir}/${appConfig.name}/manifests`,
        outputFileExtension: '.yaml',  // Generate install.yaml directly
      });
      
      // Use factory to create chart with dependencies
      await IdpBuilderChartFactory.createChart(manifestApp, appConfig);
      manifestApp.synth();
      
      // Rename app.yaml to install.yaml
      const appYamlPath = path.join(`${outputDir}/${appConfig.name}/manifests`, 'app.yaml');
      const installYamlPath = path.join(`${outputDir}/${appConfig.name}/manifests`, 'install.yaml');
      if (fs.existsSync(appYamlPath)) {
        fs.renameSync(appYamlPath, installYamlPath);
      }
      
      // 2. Generate ArgoCD Application manifest
      const argoApp = new App({
        yamlOutputType: YamlOutputType.FILE_PER_APP,  // Single file for ArgoCD app
        outdir: `${outputDir}`,
        outputFileExtension: '.yaml',  // Generate <app-name>.yaml directly
      });
      
      new ArgoApplicationsChart(argoApp, appConfig.name, {
        applicationName: appConfig.name,
        applicationNamespace: appConfig.namespace,
        manifestPath: 'manifests',
        argoCdConfig: appConfig.argocd
      });
      
      argoApp.synth();
      
      // Rename app.yaml to <app-name>.yaml for ArgoCD application
      const argoAppYamlPath = path.join(outputDir, 'app.yaml');
      const argoNamedYamlPath = path.join(outputDir, `${appConfig.name}.yaml`);
      if (fs.existsSync(argoAppYamlPath)) {
        fs.renameSync(argoAppYamlPath, argoNamedYamlPath);
      }
      
      console.log(`✓ Successfully synthesized: ${appConfig.name}`);
    } catch (error) {
      console.error(`✗ Failed to synthesize ${appConfig.name}:`, error);
      process.exit(1);
    }
  }
  
  console.log('\nSynthesis complete!');
  console.log(`Output directory: ${outputDir}/`);
  console.log('\nYou can now run: idpbuilder create -p cdk8s/dist/');
}

// Run the main function
main().catch(error => {
  console.error('Synthesis failed:', error);
  process.exit(1);
});
