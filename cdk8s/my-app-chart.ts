import { App, Chart } from 'cdk8s';
import { ApplicationConstruct, Environment } from './lib/application-construct';

export interface MyAppChartProps {
  /**
   * Environment to deploy to (defaults to 'local')
   */
  environment?: Environment;

  /**
   * GitHub repository URL for staging/production environments
   */
  gitRepoUrl?: string;

  /**
   * GitHub organization for private repositories
   */
  githubOrg?: string;
}

export class MyAppChart extends Chart {
  constructor(scope: App, id: string, props?: MyAppChartProps) {
    super(scope, id);

    const environment = props?.environment || 'local';

    new ApplicationConstruct(this, 'my-app', {
      name: 'my-app',
      namespace: 'argocd',
      environment: environment,
      
      // In local, this is the relative path from the app.yaml to the manifests directory
      // In production, this is the path within the git repository
      path: environment === 'local' ? 'manifests' : '.',
      
      // Repository configuration
      repository: {
        url: props?.gitRepoUrl,
        organization: props?.githubOrg,
      },
      
      targetRevision: 'HEAD',
      project: 'default',
      destinationNamespace: 'my-app',
      
      // Labels to match the example
      labels: {
        example: 'basic',
      },
      
      // Sync policy configuration
      automatedSync: true,
      selfHeal: true,
      createNamespace: true,
    });
  }
}

// Only run if this file is executed directly (not imported)
if (require.main === module) {
  // Main entry point
  const app = new App();

  // Get environment from environment variable or default to 'local'
  const environment = (process.env.ENVIRONMENT as Environment) || 'local';

  // For production/staging, these would be set via environment variables
  const gitRepoUrl = process.env.GIT_REPO_URL;
  const githubOrg = process.env.GITHUB_ORG;

  new MyAppChart(app, 'my-app', {
    environment,
    gitRepoUrl,
    githubOrg,
  });

  app.synth();
}