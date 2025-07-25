import { App, Chart } from 'cdk8s';
import { Application } from './imports/argoproj.io';

/**
 * This chart recreates the exact ArgoCD Application from
 * /home/vscode/stacks/basic/package1/app.yaml using direct Application construct
 */
class BasicPackage1DirectChart extends Chart {
  constructor(scope: App, id: string) {
    super(scope, id);

    new Application(this, 'my-app', {
      metadata: {
        name: 'my-app',
        namespace: 'argocd',
        labels: {
          'example': 'basic',
        },
      },
      spec: {
        destination: {
          namespace: 'my-app',
          server: 'https://kubernetes.default.svc',
        },
        source: {
          // cnoe:// indicates we want to sync from a local directory.
          // values after cnoe:// is treated as a relative path from this file.
          repoUrl: 'cnoe://manifests',
          targetRevision: 'HEAD',
          // with path set to '.' and cnoe://manifests. we are wanting ArgoCD to sync from the ./manifests directory.
          path: '.',
        },
        project: 'default',
        syncPolicy: {
          automated: {
            selfHeal: true,
          },
          syncOptions: ['CreateNamespace=true'],
        },
      },
    });
  }
}

// Create and synthesize the app
const app = new App();
new BasicPackage1DirectChart(app, 'basic-package1-direct');
app.synth();