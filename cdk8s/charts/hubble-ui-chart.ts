import { Chart } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

export class HubbleUIChart extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const namespace = 'kube-system'; // Cilium is installed in kube-system

    // Create Ingress for Hubble UI
    new k8s.KubeIngress(this, 'hubble-ui-ingress', {
      metadata: {
        name: 'hubble-ui',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '5',
        }
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [{
          host: `hubble.${process.env.INGRESS_HOST || 'localtest.me'}`,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: 'hubble-ui',
                  port: {
                    number: 80
                  }
                }
              }
            }]
          }
        }]
      }
    });

    // Create a Service if Cilium doesn't expose Hubble UI by default
    new k8s.KubeService(this, 'hubble-ui-service', {
      metadata: {
        name: 'hubble-ui',
        namespace,
        labels: {
          'k8s-app': 'hubble-ui'
        }
      },
      spec: {
        type: 'ClusterIP',
        selector: {
          'k8s-app': 'hubble-ui'
        },
        ports: [{
          name: 'http',
          port: 80,
          targetPort: k8s.IntOrString.fromNumber(8081),
          protocol: 'TCP'
        }]
      }
    });
  }
}