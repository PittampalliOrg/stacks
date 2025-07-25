import { App, Chart } from 'cdk8s';
import { ApplicationConstruct } from './lib/application-construct';
import { ArgoCDFactories } from './lib/argocd-environment-factory';

class TestChart extends Chart {
  constructor(scope: App, id: string) {
    super(scope, id);

    // Example 1: Local development with cnoe://
    new ApplicationConstruct(this, 'cnoe-app', {
      name: 'my-cnoe-app',
      environment: 'local',
      useCnoePrefix: true,
      path: '../manifests',
      destinationNamespace: 'my-app',
      createNamespace: true,
      automatedSync: true,
      repository: {},
    });

    // Example 2: Local development with Gitea
    new ApplicationConstruct(this, 'gitea-app', {
      name: 'my-gitea-app',
      environment: 'local',
      gitProvider: 'gitea',
      path: 'k8s/overlays/dev',
      destinationNamespace: 'my-app',
      createNamespace: true,
      automatedSync: true,
      repository: {
        organization: 'platform-team',
        name: 'my-application',
      },
    });

    // Example 3: Production with GitHub
    new ApplicationConstruct(this, 'prod-app', {
      name: 'my-prod-app',
      environment: 'production',
      gitProvider: 'github',
      path: 'k8s/overlays/production',
      destinationNamespace: 'my-app-prod',
      createNamespace: true,
      automatedSync: true,
      selfHeal: true,
      targetRevision: 'v1.0.0',
      repository: {
        organization: 'mycompany',
        name: 'my-application',
      },
    });

    // Example 4: Using factory pattern
    const localFactory = ArgoCDFactories.createLocalFactory({
      giteaOrganization: 'dev-team',
    });

    const prodFactory = ArgoCDFactories.createProductionFactory({
      githubOrganization: 'mycompany',
    });

    // Create local app with factory
    localFactory.createApplication(this, 'local-factory-app', {
      name: 'microservice-local',
      path: 'k8s/base',
      destinationNamespace: 'microservices',
      repository: {
        name: 'microservice-a',
      },
      automatedSync: true,
    });

    // Create production app with factory
    prodFactory.createApplication(this, 'prod-factory-app', {
      name: 'microservice-prod',
      path: 'k8s/overlays/prod',
      destinationNamespace: 'production',
      repository: {
        name: 'microservice-a',
        isPrivate: true,
        credentialsSecret: 'github-pat',
      },
      targetRevision: 'v2.0.0',
      automatedSync: false,
    });
  }
}

const app = new App();
new TestChart(app, 'test-argocd-constructs');
app.synth();