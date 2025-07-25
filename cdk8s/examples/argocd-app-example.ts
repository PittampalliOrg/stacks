import { App, Chart } from 'cdk8s';
import { ApplicationConstruct } from '../lib/application-construct';
import { GitRepositoryHelper } from '../lib/git-repository-construct';
import { ArgoCDEnvironmentFactory, ArgoCDFactories } from '../lib/argocd-environment-factory';

/**
 * Example 1: Simple local development with cnoe:// prefix
 * This is the simplest approach for local development when your manifests
 * are in the same repository as your cdk8s code
 */
class LocalCnoeExample extends Chart {
  constructor(scope: App, id: string) {
    super(scope, id);

    new ApplicationConstruct(this, 'my-local-app', {
      name: 'my-local-app',
      environment: 'local',
      useCnoePrefix: true,
      path: '../manifests', // Relative path from this file to manifests
      destinationNamespace: 'my-app',
      createNamespace: true,
      automatedSync: true,
      repository: {}, // Empty repository config for cnoe://
    });
  }
}

/**
 * Example 2: Local development with Gitea repository
 * This approach uses idpbuilder's GitRepository CRD to manage a Gitea repository
 */
class LocalGiteaExample extends Chart {
  constructor(scope: App, id: string) {
    super(scope, id);

    // Create an application that references a Gitea repository
    const app = new ApplicationConstruct(this, 'gitea-app', {
      name: 'my-gitea-app',
      environment: 'local',
      gitProvider: 'gitea',
      path: 'k8s/overlays/dev',
      destinationNamespace: 'my-app',
      createNamespace: true,
      automatedSync: true,
      targetRevision: 'main',
      repository: {
        organization: 'platform-team',
        name: 'my-application',
      },
    });

    // The ApplicationConstruct automatically creates a GitRepository resource
    // when using Gitea in local environment
  }
}

/**
 * Example 3: Production deployment with public GitHub repository
 */
class ProductionPublicExample extends Chart {
  constructor(scope: App, id: string) {
    super(scope, id);

    new ApplicationConstruct(this, 'prod-app', {
      name: 'my-prod-app',
      environment: 'production',
      gitProvider: 'github',
      path: 'k8s/overlays/production',
      destinationNamespace: 'my-app-prod',
      createNamespace: true,
      automatedSync: true,
      selfHeal: true,
      prune: true,
      targetRevision: 'v1.2.3', // Using a specific tag for production
      repository: {
        url: 'https://github.com/myorg/my-app.git',
        // OR you can use organization + name:
        // organization: 'myorg',
        // name: 'my-app',
      },
      labels: {
        'env': 'production',
        'team': 'platform',
      },
    });
  }
}

/**
 * Example 4: Production deployment with private GitHub repository
 */
class ProductionPrivateExample extends Chart {
  constructor(scope: App, id: string) {
    super(scope, id);

    // For private repositories, you need to create a secret with credentials
    // This would typically be done separately or through a secrets management system
    // The secret should have 'username' and 'password' fields
    // For GitHub, use a personal access token as the password

    new ApplicationConstruct(this, 'private-app', {
      name: 'my-private-app',
      environment: 'production',
      gitProvider: 'github',
      path: 'deploy/k8s',
      destinationNamespace: 'my-private-app',
      createNamespace: true,
      automatedSync: false, // Manual sync for production
      targetRevision: 'main',
      repository: {
        organization: 'myorg',
        name: 'private-app',
        isPrivate: true,
        credentialsSecret: 'github-credentials', // This secret must exist
      },
      syncOptions: [
        'CreateNamespace=true',
        'PrunePropagationPolicy=foreground',
        'PruneLast=true',
      ],
    });
  }
}

/**
 * Example 5: Using the Environment Factory for consistent configuration
 */
class FactoryExample extends Chart {
  constructor(scope: App, id: string) {
    super(scope, id);

    // Create a factory for local development
    const localFactory = ArgoCDFactories.createLocalFactory({
      argoCDNamespace: 'argocd',
      giteaOrganization: 'platform-team',
    });

    // Create multiple applications with consistent settings
    localFactory.createApplication(this, 'app1', {
      name: 'microservice-a',
      path: 'k8s/base',
      destinationNamespace: 'microservices',
      repository: {
        name: 'microservice-a',
      },
      automatedSync: true,
    });

    localFactory.createApplication(this, 'app2', {
      name: 'microservice-b',
      path: 'k8s/base',
      destinationNamespace: 'microservices',
      repository: {
        name: 'microservice-b',
      },
      automatedSync: true,
    });

    // Create a factory for production
    const prodFactory = ArgoCDFactories.createProductionFactory({
      argoCDNamespace: 'argocd',
      githubOrganization: 'mycompany',
    });

    // Create production application
    prodFactory.createApplication(this, 'prod-app', {
      name: 'main-app',
      path: 'k8s/overlays/prod',
      destinationNamespace: 'production',
      repository: {
        name: 'main-app',
        isPrivate: true,
        credentialsSecret: 'github-pat',
      },
      targetRevision: 'v2.0.0',
      automatedSync: false,
    });
  }
}

/**
 * Example 6: Complete example with credential management
 */
class CompleteExample extends Chart {
  constructor(scope: App, id: string) {
    super(scope, id);

    // Create factory for production
    const factory = ArgoCDFactories.createProductionFactory({
      githubOrganization: 'acme-corp',
    });

    // Create application with repository and credentials in one call
    const { application, credentialsSecret } = factory.createApplicationWithRepository(
      this,
      'complete-app',
      {
        name: 'enterprise-app',
        path: 'kubernetes/production',
        destinationNamespace: 'enterprise',
        repository: {
          name: 'enterprise-app',
          isPrivate: true,
          credentials: {
            username: 'git',
            password: process.env.GITHUB_TOKEN || 'your-github-pat',
          },
        },
        targetRevision: 'release-1.0',
        automatedSync: false,
        createNamespace: true,
        labels: {
          'app.kubernetes.io/part-of': 'enterprise-suite',
          'app.kubernetes.io/component': 'backend',
        },
      },
    );

    console.log(`Created application: ${application.application.name}`);
    if (credentialsSecret) {
      console.log(`Created credentials secret: ${credentialsSecret.name}`);
    }
  }
}

/**
 * Example 7: Helm application
 */
class HelmExample extends Chart {
  constructor(scope: App, id: string) {
    super(scope, id);

    new ApplicationConstruct(this, 'helm-app', {
      name: 'prometheus',
      environment: 'production',
      gitProvider: 'github',
      path: 'charts/prometheus',
      destinationNamespace: 'monitoring',
      createNamespace: true,
      repository: {
        url: 'https://github.com/prometheus-community/helm-charts.git',
      },
      targetRevision: 'main',
      helm: {
        releaseName: 'prometheus',
        valueFiles: ['values.yaml', 'values-prod.yaml'],
      },
      automatedSync: true,
      selfHeal: true,
    });
  }
}

/**
 * Example 8: Kustomize application
 */
class KustomizeExample extends Chart {
  constructor(scope: App, id: string) {
    super(scope, id);

    new ApplicationConstruct(this, 'kustomize-app', {
      name: 'my-kustomized-app',
      environment: 'local',
      gitProvider: 'gitea',
      path: 'k8s/overlays/dev',
      destinationNamespace: 'development',
      createNamespace: true,
      repository: {
        organization: 'dev-team',
        name: 'kustomized-app',
      },
      kustomize: {
        images: ['myapp=myregistry/myapp:dev-latest'],
      },
      automatedSync: true,
    });
  }
}

// Create the app and instantiate all examples
const app = new App();

// Choose which example to run
new LocalCnoeExample(app, 'local-cnoe-example');
new LocalGiteaExample(app, 'local-gitea-example');
new ProductionPublicExample(app, 'production-public-example');
new ProductionPrivateExample(app, 'production-private-example');
new FactoryExample(app, 'factory-example');
new CompleteExample(app, 'complete-example');
new HelmExample(app, 'helm-example');
new KustomizeExample(app, 'kustomize-example');

app.synth();