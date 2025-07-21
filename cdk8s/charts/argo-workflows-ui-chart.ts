import { Chart } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

export class ArgoWorkflowsUiChart extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const namespace = 'argo';
    
    // Argo Workflows is deployed via Helm
    // We only add an Ingress for web access
    new k8s.KubeIngress(this, 'argo-workflows-ingress', {
      metadata: {
        name: 'argo-workflows-ingress',
        namespace,
        annotations: {
          'nginx.ingress.kubernetes.io/configuration-snippet': `
            more_clear_headers "X-Frame-Options";
            more_clear_headers "Content-Security-Policy";
            add_header Content-Security-Policy "default-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self' http://localhost:7007 http://localhost:3000 http://backstage.localtest.me https://backstage.ai401kchat.com;" always;
          `,
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [{
          host: `argo.${process.env.INGRESS_HOST || 'localtest.me'}`,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: 'argo-workflows-server',
                  port: {
                    number: 2746,
                  },
                },
              },
            }],
          },
        }],
      },
    });
  }
}