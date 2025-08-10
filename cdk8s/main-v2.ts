import { App, YamlOutputType } from 'cdk8s';
import * as fs from 'fs';
import * as path from 'path';
import { ArgoApplicationsChartV2 } from './charts/apps/argo-applications-chart-v2';
import { IdpBuilderChartFactory } from './lib/idpbuilder-chart-factory';
import { applicationConfigs } from './config/applications';

// Register all available charts with the factory
import { BootstrapSecretsChart } from './charts/bootstrap-secrets-chart';
import { ExternalSecretsWorkloadIdentityChart } from './charts/external-secrets-workload-identity-chart';
import { HeadlampChart } from './charts/headlamp-chart';
import { HeadlampKeycloakSecretsChart } from './charts/headlamp-keycloak-secrets-chart';
import { KeycloakHeadlampClientChart } from './charts/keycloak-headlamp-client-chart';
import { NamespaceChart } from './charts/namespace-chart';
import { NextJsChart } from './charts/nextjs-chart';
import { NextJsSecretsChart } from './charts/nextjs-secrets-chart';
import { PostgresChart } from './charts/postgres-chart';
import { RedisChart } from './charts/redis-chart';
import { KargoHelmChart } from './charts/kargo-helm-chart';
import { KargoSecretsChart } from './charts/kargo-secrets-chart';
import { KargoPipelinesProjectChart } from './charts/kargo-pipelines-project-chart';
import { KargoPipelinesCredentialsChart } from './charts/kargo-pipelines-credentials-chart';
import { KargoCACertificatesChart } from './charts/kargo-ca-certificates-chart';
import { KargoNextjsPipelineChart } from './charts/kargo-nextjs-pipeline-chart';
import { KargoBackstagePipelineChart } from './charts/kargo-backstage-pipeline-chart';
import { KargoGiteaWebhookSetupChart } from './charts/kargo-gitea-webhook-setup-chart';
import { KargoWebhookPatchChart } from './charts/kargo-webhook-patch-chart';
import { DaggerInfraChart } from './charts/dagger-infra-chart';
import { BackstageChart } from './charts/backstage-chart';
import { AiPlatformEngineeringChart } from './charts/ai-platform-engineering-chart';
import { AiPlatformEngineeringChartV2 } from './charts/ai-platform-engineering-chart-v2';
import { AiPlatformEngineeringAzureChart } from './charts/ai-platform-engineering-azure-chart';
import { VaultChart } from './charts/vault-chart';
import { VclusterDevChart } from './charts/apps/vcluster-dev-chart';
import { VclusterStagingChart } from './charts/apps/vcluster-staging-chart';
import { VclusterRegistrationRbacChart } from './charts/vcluster-registration-rbac-chart';
import { VclusterRegistrationJobChart } from './charts/vcluster-registration-job-chart';
import { VclusterRegistrationCronJobChart } from './charts/vcluster-registration-cronjob-chart';
import { NextJsParameterizedChart } from './charts/apps/nextjs-parameterized-chart';
import { NextJsMultiEnvApplicationSetChart } from './charts/apps/nextjs-multi-env-appset-chart';
import { BackstageParameterizedChart } from './charts/apps/backstage-parameterized-chart';
import { BackstageMultiEnvApplicationSetChart } from './charts/apps/backstage-multi-env-appset-chart';

// Register all charts
IdpBuilderChartFactory.register('BootstrapSecretsChart', BootstrapSecretsChart);
IdpBuilderChartFactory.register('ExternalSecretsWorkloadIdentityChart', ExternalSecretsWorkloadIdentityChart);
IdpBuilderChartFactory.register('HeadlampChart', HeadlampChart);
IdpBuilderChartFactory.register('HeadlampKeycloakSecretsChart', HeadlampKeycloakSecretsChart);
IdpBuilderChartFactory.register('KeycloakHeadlampClientChart', KeycloakHeadlampClientChart);
IdpBuilderChartFactory.register('NamespaceChart', NamespaceChart);
IdpBuilderChartFactory.register('NextJsChart', NextJsChart);
IdpBuilderChartFactory.register('NextJsSecretsChart', NextJsSecretsChart);
IdpBuilderChartFactory.register('PostgresChart', PostgresChart);
IdpBuilderChartFactory.register('RedisChart', RedisChart);
IdpBuilderChartFactory.register('KargoHelmChart', KargoHelmChart);
IdpBuilderChartFactory.register('KargoSecretsChart', KargoSecretsChart);
IdpBuilderChartFactory.register('KargoPipelinesProjectChart', KargoPipelinesProjectChart);
IdpBuilderChartFactory.register('KargoPipelinesCredentialsChart', KargoPipelinesCredentialsChart);
IdpBuilderChartFactory.register('KargoCACertificatesChart', KargoCACertificatesChart);
IdpBuilderChartFactory.register('KargoNextjsPipelineChart', KargoNextjsPipelineChart);
IdpBuilderChartFactory.register('KargoBackstagePipelineChart', KargoBackstagePipelineChart);
IdpBuilderChartFactory.register('KargoGiteaWebhookSetupChart', KargoGiteaWebhookSetupChart);
IdpBuilderChartFactory.register('KargoWebhookPatchChart', KargoWebhookPatchChart);
IdpBuilderChartFactory.register('DaggerInfraChart', DaggerInfraChart);
IdpBuilderChartFactory.register('BackstageChart', BackstageChart);
IdpBuilderChartFactory.register('AiPlatformEngineeringChart', AiPlatformEngineeringChart);
IdpBuilderChartFactory.register('AiPlatformEngineeringChartV2', AiPlatformEngineeringChartV2);
IdpBuilderChartFactory.register('AiPlatformEngineeringAzureChart', AiPlatformEngineeringAzureChart);
IdpBuilderChartFactory.register('VaultChart', VaultChart);
IdpBuilderChartFactory.register('VclusterDevChart', VclusterDevChart);
IdpBuilderChartFactory.register('VclusterStagingChart', VclusterStagingChart);
IdpBuilderChartFactory.register('VclusterRegistrationRbacChart', VclusterRegistrationRbacChart);
IdpBuilderChartFactory.register('VclusterRegistrationJobChart', VclusterRegistrationJobChart);
IdpBuilderChartFactory.register('VclusterRegistrationCronJobChart', VclusterRegistrationCronJobChart);
IdpBuilderChartFactory.register('NextJsParameterizedChart', NextJsParameterizedChart);
IdpBuilderChartFactory.register('NextJsMultiEnvApplicationSetChart', NextJsMultiEnvApplicationSetChart);
IdpBuilderChartFactory.register('BackstageParameterizedChart', BackstageParameterizedChart);
IdpBuilderChartFactory.register('BackstageMultiEnvApplicationSetChart', BackstageMultiEnvApplicationSetChart);

const outputDir = 'dist';

/**
 * Synthesis configuration options
 */
interface SynthesisOptions {
  /**
   * Output directory for generated manifests
   */
  outputDir: string;
  
  /**
   * Whether to generate Helm charts instead of raw manifests
   */
  helmOutput?: boolean;
  
  /**
   * Environment (dev, staging, production)
   */
  environment?: string;
}

/**
 * Create the proper IDPBuilder package structure
 */
async function createPackageStructure(appName: string, outputDir: string): Promise<void> {
  const packageDir = path.join(outputDir, appName);
  const manifestsDir = path.join(packageDir, 'manifests');
  
  // Ensure directories exist
  if (!fs.existsSync(manifestsDir)) {
    fs.mkdirSync(manifestsDir, { recursive: true });
  }
}

/**
 * Synthesize a single application
 */
async function synthesizeApplication(appConfig: any, options: SynthesisOptions): Promise<void> {
  console.log(`Synthesizing application: ${appConfig.name}`);
  
  try {
    // Create package structure
    await createPackageStructure(appConfig.name, options.outputDir);
    
    // 1. Generate manifests for the application
    const manifestApp = new App({
      yamlOutputType: YamlOutputType.FILE_PER_RESOURCE,
      outdir: path.join(options.outputDir, appConfig.name, 'manifests'),
    });
    
    // Use factory to create chart with dependencies
    await IdpBuilderChartFactory.createChart(manifestApp, appConfig);
    manifestApp.synth();

    // With FILE_PER_RESOURCE, we'll have multiple YAML files in the manifests directory
    // IDPBuilder will handle these individual resource files
    console.log(`  ✓ Generated individual resource files for ${appConfig.name}`);

    // Ensure a kustomization.yaml exists so Argo CD can apply kustomize patches when needed
    try {
      const manifestsDir = path.join(options.outputDir, appConfig.name, 'manifests');
      const files = fs.readdirSync(manifestsDir)
        .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
        .sort();
      const kustomizationPath = path.join(manifestsDir, 'kustomization.yaml');
      const kustomization = [
        'apiVersion: kustomize.config.k8s.io/v1beta1',
        'kind: Kustomization',
        'resources:',
        ...files.map((f) => `  - ${f}`),
        ''
      ].join('\n');
      fs.writeFileSync(kustomizationPath, kustomization);
      console.log(`  ✓ Wrote kustomization.yaml for ${appConfig.name}`);
    } catch (e) {
      console.warn(`  ⚠ Could not write kustomization.yaml for ${appConfig.name}:`, e);
    }
    
    // Copy values.yaml if it exists in the source package
    const sourceValuesPath = path.join(__dirname, '..', 'ai-platform-engineering', appConfig.name, 'values.yaml');
    const destValuesPath = path.join(options.outputDir, appConfig.name, 'values.yaml');
    if (fs.existsSync(sourceValuesPath)) {
      fs.copyFileSync(sourceValuesPath, destValuesPath);
      console.log(`  ✓ Copied values.yaml for ${appConfig.name}`);
    }
    
    // 2. Generate ArgoCD Application manifest (or ApplicationSet for special cases)
    const argoApp = new App({
      yamlOutputType: YamlOutputType.FILE_PER_APP,
      outdir: options.outputDir,
    });
    
    // Check if this is a NextJs parameterized application
    if (appConfig.chart?.type === 'NextJsParameterizedChart') {
      // Generate separate manifests for each environment
      const environments = appConfig.chart.props?.environments || ['dev', 'staging'];
      for (const env of environments) {
        const envApp = new App({
          yamlOutputType: YamlOutputType.FILE_PER_RESOURCE,
          outdir: path.join(options.outputDir, `nextjs-${env}`, 'manifests'),
        });
        
        // Create package structure for this environment
        await createPackageStructure(`nextjs-${env}`, options.outputDir);
        
        // Generate manifests for this environment
        new NextJsParameterizedChart(envApp, `${env}-nextjs`, {
          environmentName: env,
        });
        envApp.synth();
        
        // Create kustomization.yaml for this environment's manifests
        const envManifestsDir = path.join(options.outputDir, `nextjs-${env}`, 'manifests');
        const files = fs.readdirSync(envManifestsDir)
          .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
          .sort();
        const kustomizationPath = path.join(envManifestsDir, 'kustomization.yaml');
        const kustomization = [
          'apiVersion: kustomize.config.k8s.io/v1beta1',
          'kind: Kustomization',
          'resources:',
          ...files.map((f) => `  - ${f}`),
          ''
        ].join('\n');
        fs.writeFileSync(kustomizationPath, kustomization);
        console.log(`  ✓ Generated manifests for nextjs-${env}`);
      }
      
      // Generate the ApplicationSet
      new NextJsMultiEnvApplicationSetChart(argoApp, 'nextjs-multi-env-appset', {});
    } else if (appConfig.chart?.type === 'BackstageParameterizedChart') {
      // Generate separate manifests for each environment
      const environments = appConfig.chart.props?.environments || ['dev', 'staging'];
      for (const env of environments) {
        const envApp = new App({
          yamlOutputType: YamlOutputType.FILE_PER_RESOURCE,
          outdir: path.join(options.outputDir, `backstage-${env}`, 'manifests'),
        });
        
        // Create package structure for this environment
        await createPackageStructure(`backstage-${env}`, options.outputDir);
        
        // Generate manifests for this environment
        new BackstageParameterizedChart(envApp, `${env}-backstage`, {
          environmentName: env,
        });
        envApp.synth();
        
        // Create kustomization.yaml for this environment's manifests
        const envManifestsDir = path.join(options.outputDir, `backstage-${env}`, 'manifests');
        const files = fs.readdirSync(envManifestsDir)
          .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
          .sort();
        const kustomizationPath = path.join(envManifestsDir, 'kustomization.yaml');
        const kustomization = [
          'apiVersion: kustomize.config.k8s.io/v1beta1',
          'kind: Kustomization',
          'resources:',
          ...files.map((f) => `  - ${f}`),
          ''
        ].join('\n');
        fs.writeFileSync(kustomizationPath, kustomization);
        console.log(`  ✓ Generated manifests for backstage-${env}`);
      }
      
      // Generate the ApplicationSet
      new BackstageMultiEnvApplicationSetChart(argoApp, 'backstage-multi-env-appset', {});
    } else if (appConfig.chart?.type === 'VclusterDevChart' || appConfig.chart?.type === 'VclusterStagingChart') {
      // Generate vcluster Application directly without ArgoApplicationsChartV2 wrapper
      // These charts already contain the full Application definition with Helm source
      const ChartClass = appConfig.chart.type === 'VclusterDevChart' ? VclusterDevChart : VclusterStagingChart;
      new ChartClass(argoApp, appConfig.name, appConfig.chart.props || {});
    } else if (appConfig.chart?.type === 'VclusterRegistrationJobChart') {
      // Registration job needs special handling - bypass wrapper to avoid cnoe:// URLs
      // Just generate the manifests, ArgoCD app will be created separately
      // For now, use standard approach but this needs to be fixed for production
      new ArgoApplicationsChartV2(argoApp, appConfig.name, {
        applicationName: appConfig.name,
        applicationNamespace: appConfig.namespace,
        manifestPath: 'manifests',
        argoCdConfig: appConfig.argocd,
        environment: options.environment
      });
    } else if (appConfig.argocd?.sources && appConfig.argocd.sources.length > 0) {
      // Multi-source application
      new ArgoApplicationsChartV2(argoApp, appConfig.name, {
        applicationName: appConfig.name,
        applicationNamespace: appConfig.namespace,
        manifestPath: 'manifests',
        argoCdConfig: appConfig.argocd,
        environment: options.environment
      });
    } else {
      // Single source application using builder within a chart
      new ArgoApplicationsChartV2(argoApp, appConfig.name, {
        applicationName: appConfig.name,
        applicationNamespace: appConfig.namespace,
        manifestPath: 'manifests',
        argoCdConfig: appConfig.argocd,
        environment: options.environment
      });
    }
    
    argoApp.synth();
    
    // Clean up file naming
    const argoFiles = fs.readdirSync(options.outputDir);
    const argoAppFile = argoFiles.find(f => f === 'app.yaml' || f === 'app.k8s.yaml');
    if (argoAppFile) {
      fs.renameSync(
        path.join(options.outputDir, argoAppFile),
        path.join(options.outputDir, `${appConfig.name}.yaml`)
      );
    }
    
    console.log(`✓ Successfully synthesized: ${appConfig.name}`);
  } catch (error) {
    console.error(`✗ Failed to synthesize ${appConfig.name}:`, error);
    throw error;
  }
}

/**
 * Main synthesis function with improved structure
 */
async function main() {
  const options: SynthesisOptions = {
    outputDir,
    environment: process.env.ENVIRONMENT || 'dev',
    helmOutput: process.env.HELM_OUTPUT === 'true'
  };
  
  // Clean output directory
  if (fs.existsSync(options.outputDir)) {
    fs.rmSync(options.outputDir, { recursive: true });
  }
  fs.mkdirSync(options.outputDir, { recursive: true });
  
  // Process each application
  for (const appConfig of applicationConfigs) {
    await synthesizeApplication(appConfig, options);
  }
  
  console.log('\nSynthesis complete!');
  console.log(`Output directory: ${options.outputDir}/`);
  console.log('\nIDPBuilder package structure:');
  console.log('- Each application has its own directory with app.yaml and manifests/');
  console.log('- Directory structure matches cnoe:// URL requirements');
  console.log('\nYou can now run: idpbuilder create -p cdk8s/dist/');
}

// Run the main function
main().catch(error => {
  console.error('Synthesis failed:', error);
  process.exit(1);
});
