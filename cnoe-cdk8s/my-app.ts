import { App } from 'cdk8s';
import { EnvironmentAwareApplication, Environment } from './EnvironmentAwareApplication';

// Create the CDK8s app
const app = new App();

// Get environment from environment variable or default to 'dev'
const environment = (process.env.ENVIRONMENT as Environment) || 'dev';

// Get GitHub configuration from environment variables (for staging/production)
const gitRepoUrl = process.env.GIT_REPO_URL || 'https://github.com/myorg/myrepo.git';

// Create the application
new EnvironmentAwareApplication(app, 'my-app', {
  appName: 'my-app',
  appNamespace: 'argocd',
  environment: environment,
  
  // Source configuration
  sourcePath: environment === 'dev' ? 'manifests' : '.',
  gitRepoUrl: environment !== 'dev' ? gitRepoUrl : undefined,
  targetRevision: 'HEAD',
  
  // Destination configuration
  project: 'default',
  destinationNamespace: 'my-app',
  destinationServer: 'https://kubernetes.default.svc',
  
  // Labels
  labels: {
    example: 'basic',
  },
  
  // Sync policy
  automatedSync: true,
  selfHeal: true,
  createNamespace: true,
});

// Synthesize the Kubernetes manifests
app.synth();