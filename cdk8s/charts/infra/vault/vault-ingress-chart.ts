import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../../../imports/k8s';

export interface VaultIngressChartProps extends ChartProps {
  namespace?: string;
}

export class VaultIngressChart extends Chart {
  constructor(scope: Construct, id: string, props: VaultIngressChartProps = {}) {
    super(scope, id, props);

    const namespace = props.namespace || 'vault';

    new k8s.KubeIngress(this, 'ingress', {
      metadata: {
        name: 'vault-ingress',
        namespace: namespace,
        annotations: {
          'nginx.ingress.kubernetes.io/backend-protocol': 'HTTP',
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [
          {
            host: 'vault.cnoe.localtest.me',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: 'vault',
                      port: {
                        number: 8200,
                      },
                    },
                  },
                },
              ],
            },
          },
          {
            host: 'localhost',
            http: {
              paths: [
                {
                  path: '/vault(/|$)(.*)',
                  pathType: 'ImplementationSpecific',
                  backend: {
                    service: {
                      name: 'vault',
                      port: {
                        number: 8200,
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    });
  }
}