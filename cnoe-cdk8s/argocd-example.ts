import { Construct } from 'constructs';
import { App, Chart } from 'cdk8s';
import { Application, AppProject, ApplicationSet } from './imports/argoproj.io';

export class ArgoCDExample extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Create an ArgoCD AppProject
    new AppProject(this, 'my-project', {
      metadata: {
        name: 'my-project',
        namespace: 'argocd',
      },
      spec: {
        description: 'Example ArgoCD Project',
        sourceRepos: ['https://github.com/myorg/*'],
        destinations: [{
          namespace: '*',
          server: 'https://kubernetes.default.svc',
        }],
      },
    });

    // Create an ArgoCD Application
    new Application(this, 'my-app', {
      metadata: {
        name: 'my-app',
        namespace: 'argocd',
      },
      spec: {
        project: 'my-project',
        source: {
          repoUrl: 'https://github.com/myorg/myapp',
          path: 'k8s',
          targetRevision: 'main',
        },
        destination: {
          server: 'https://kubernetes.default.svc',
          namespace: 'default',
        },
        syncPolicy: {
          automated: {
            prune: true,
            selfHeal: true,
          },
        },
      },
    });

    // Create an ApplicationSet for multiple environments
    new ApplicationSet(this, 'my-appset', {
      metadata: {
        name: 'my-appset',
        namespace: 'argocd',
      },
      spec: {
        generators: [{
          list: {
            elements: [
              { env: 'dev', namespace: 'dev' },
              { env: 'staging', namespace: 'staging' },
              { env: 'prod', namespace: 'prod' },
            ],
          },
        }],
        template: {
          metadata: {
            name: '{{env}}-app',
          },
          spec: {
            project: 'my-project',
            source: {
              repoUrl: 'https://github.com/myorg/myapp',
              path: 'k8s/{{env}}',
              targetRevision: 'main',
            },
            destination: {
              server: 'https://kubernetes.default.svc',
              namespace: '{{namespace}}',
            },
          },
        },
      },
    });
  }
}

const app = new App();
new ArgoCDExample(app, 'argocd-example');
app.synth();