import { App, Chart } from 'cdk8s';
import { BaseArgoApplication } from './lib/argocd-application-base';
import { GitSourceProviderFactory } from './lib/git-source-provider';
import { 
  Environment, 
  getEnvironmentConfig
} from './lib/environment-config';

/**
 * Example of creating the same application for different environments
 * Similar to /home/vscode/stacks/basic/package1 but with better abstraction
 */
class MultiEnvironmentApplicationChart extends Chart {
  constructor(scope: App, id: string, environment: Environment) {
    super(scope, id);
    
    // Get environment configuration with defaults
    const envConfig = getEnvironmentConfig(environment, {
      gitConfig: environment !== 'dev' ? {
        organization: 'myorg',
        repository: 'my-app',
        isPrivate: true,
      } : undefined,
    });
    
    // Create git source provider based on environment
    const sourceProvider = GitSourceProviderFactory.forEnvironment(
      environment,
      envConfig.gitConfig
    );
    
    // Create the application with environment-specific configuration
    new BaseArgoApplication(this, 'my-app', {
      name: 'my-app',
      namespace: 'argocd',
      
      // Git source configuration
      sourceProvider: sourceProvider,
      sourcePath: environment === 'dev' ? 'manifests' : 'k8s/manifests',
      targetRevision: envConfig.defaultTargetRevision,
      
      // Destination
      destination: {
        namespace: 'my-app',
      },
      
      // Sync policy from environment defaults
      syncPolicy: envConfig.defaultSyncPolicy,
      
      // Labels
      labels: {
        'example': 'basic',
        'environment': environment,
        'managed-by': 'cdk8s',
      },
      
      // Only print setup instructions for non-dev environments
      printSetupInstructions: environment !== 'dev',
    });
  }
}

/**
 * Example showing how to create a custom application with specific requirements
 */
class CustomApplicationChart extends Chart {
  constructor(scope: App, id: string) {
    super(scope, id);
    
    // Example 1: Local development with custom sync policy
    const localProvider = GitSourceProviderFactory.forEnvironment('dev');
    
    new BaseArgoApplication(this, 'custom-app-local', {
      name: 'custom-app',
      namespace: 'argocd',
      sourceProvider: localProvider,
      sourcePath: 'deploy/manifests',
      destination: {
        namespace: 'custom-app',
      },
      syncPolicy: {
        automated: true,
        selfHeal: true,
        prune: true, // Enable pruning for this app
        createNamespace: true,
        syncOptions: ['ApplyOutOfSyncOnly=true'], // Custom sync option
      },
      labels: {
        'team': 'platform',
        'tier': 'backend',
      },
    });
    
    // Example 2: Production with manual sync
    const prodProvider = GitSourceProviderFactory.forEnvironment('production', {
      organization: 'acme-corp',
      repository: 'payment-service',
      isPrivate: true,
    });
    
    new BaseArgoApplication(this, 'payment-service-prod', {
      name: 'payment-service',
      namespace: 'argocd',
      sourceProvider: prodProvider,
      sourcePath: 'kubernetes/production',
      targetRevision: 'v1.2.3', // Pin to specific version
      destination: {
        namespace: 'payment-system',
        server: 'https://prod-cluster.example.com:6443', // Different cluster
      },
      syncPolicy: {
        automated: false, // Manual sync for critical service
        createNamespace: false,
      },
      labels: {
        'criticality': 'high',
        'compliance': 'pci',
      },
      annotations: {
        'notifications.argoproj.io/subscribe.on-sync-failed.slack': 'prod-alerts',
      },
    });
  }
}

// Main: Create and synthesize applications
const app = new App();

// Create the same application for different environments
console.log('Creating applications for different environments...\n');

// Development environment (local with idpbuilder)
new MultiEnvironmentApplicationChart(app, 'my-app-dev', 'dev');

// Staging environment (GitHub private repo)
new MultiEnvironmentApplicationChart(app, 'my-app-staging', 'staging');

// Production environment (GitHub private repo, manual sync)
new MultiEnvironmentApplicationChart(app, 'my-app-prod', 'production');

// Custom applications with specific requirements
new CustomApplicationChart(app, 'custom-apps');

app.synth();

console.log('\nApplications created successfully!');
console.log('Check the dist/ directory for generated YAML files.');