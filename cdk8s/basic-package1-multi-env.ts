import { App, Chart } from 'cdk8s';
import { ApplicationConstruct } from './lib/application-construct';
import { ArgoCDFactories } from './lib/argocd-environment-factory';

/**
 * This example shows how the same application from
 * /home/vscode/stacks/basic/package1/app.yaml
 * can be deployed to different environments
 */
class BasicPackage1MultiEnvChart extends Chart {
  constructor(scope: App, id: string, environment: 'local' | 'production') {
    super(scope, id);

    if (environment === 'local') {
      // Local version - same as original app.yaml
      new ApplicationConstruct(this, 'my-app-local', {
        name: 'my-app',
        namespace: 'argocd',
        environment: 'local',
        useCnoePrefix: true,
        path: 'manifests',
        destinationNamespace: 'my-app',
        destinationServer: 'https://kubernetes.default.svc',
        project: 'default',
        createNamespace: true,
        automatedSync: true,
        selfHeal: true,
        prune: false,
        repository: {},
        labels: {
          'example': 'basic',
          'environment': 'local',
        },
      });
    } else {
      // Production version - using GitHub
      new ApplicationConstruct(this, 'my-app-prod', {
        name: 'my-app',
        namespace: 'argocd',
        environment: 'production',
        gitProvider: 'github',
        path: 'manifests',
        destinationNamespace: 'my-app',
        destinationServer: 'https://kubernetes.default.svc',
        project: 'default',
        createNamespace: true,
        automatedSync: false,  // Manual sync for production
        selfHeal: true,
        targetRevision: 'main',
        repository: {
          organization: 'mycompany',
          name: 'my-app',
        },
        labels: {
          'example': 'basic',
          'environment': 'production',
        },
      });
    }
  }
}

/**
 * Alternative approach using factories
 */
class BasicPackage1FactoryChart extends Chart {
  constructor(scope: App, id: string) {
    super(scope, id);

    // Create a local factory
    const localFactory = ArgoCDFactories.createLocalFactory();

    // Create the application with factory
    localFactory.createApplication(this, 'my-app-factory', {
      name: 'my-app',
      path: 'manifests',
      destinationNamespace: 'my-app',
      destinationServer: 'https://kubernetes.default.svc',
      project: 'default',
      createNamespace: true,
      automatedSync: true,
      selfHeal: true,
      prune: false,
      useCnoePrefix: true,
      repository: {},
      labels: {
        'example': 'basic',
        'created-by': 'factory',
      },
    });
  }
}

// Create and synthesize apps
const app = new App();

// Create local environment version
new BasicPackage1MultiEnvChart(app, 'basic-package1-local', 'local');

// Create production environment version
new BasicPackage1MultiEnvChart(app, 'basic-package1-prod', 'production');

// Create factory version
new BasicPackage1FactoryChart(app, 'basic-package1-factory');

app.synth();