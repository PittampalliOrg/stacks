import { App, Chart } from 'cdk8s';
import { ApplicationConstruct } from './lib/application-construct';

/**
 * This chart recreates the exact ArgoCD Application from
 * /home/vscode/stacks/basic/package1/app.yaml
 */
class BasicPackage1Chart extends Chart {
  constructor(scope: App, id: string) {
    super(scope, id);

    new ApplicationConstruct(this, 'my-app', {
      name: 'my-app',
      namespace: 'argocd',
      environment: 'local',
      useCnoePrefix: true,
      path: 'manifests',  // This becomes cnoe://manifests
      destinationNamespace: 'my-app',
      destinationServer: 'https://kubernetes.default.svc',
      project: 'default',
      createNamespace: true,
      automatedSync: true,
      selfHeal: true,
      prune: false,  // Explicitly set to false to match original
      repository: {},  // Empty for cnoe:// URLs
      labels: {
        'example': 'basic',
      },
    });
  }
}

// Create and synthesize the app
const app = new App();
new BasicPackage1Chart(app, 'basic-package1');
app.synth();