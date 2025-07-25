import { App, Chart } from 'cdk8s';
import { CustomPackage, CustomPackageSpecArgoCdType } from './imports/idpbuilder.cnoe.io';

export class Package1CustomPackage extends Chart {
  constructor(scope: App, id: string) {
    super(scope, id);

    new CustomPackage(this, 'my-app-package', {
      metadata: {
        name: 'my-app-package',
        namespace: 'default',
      },
      spec: {
        // ArgoCD configuration
        argoCd: {
          applicationFile: '/home/vscode/stacks/basic/package1/app.yaml',
          name: 'my-app',
          namespace: 'argocd',
          type: CustomPackageSpecArgoCdType.APPLICATION,
        },
        
        // Git server configuration
        gitServerAuthSecretRef: {
          name: 'gitea-credentials',
          namespace: 'gitea',
        },
        
        gitServerUrl: 'https://gitea.cnoe.localtest.me:8443',
        internalGitServeUrl: 'http://my-gitea-http.gitea.svc.cluster.local:3000',
        
        // Enable replication from local to Gitea
        replicate: true,
        
        // Remote repository configuration (pointing to local directory)
        remoteRepository: {
          url: 'file:///home/vscode/stacks/basic/package1',
          path: '.',
          ref: 'main',
          cloneSubmodules: false,
        },
      },
    });
  }
}

const app = new App();
new Package1CustomPackage(app, 'package1-custompackage');
app.synth();