import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../../imports/k8s';

export interface AiPlatformEngineeringIngressChartProps extends ChartProps {
  namespace?: string;
}

export class AiPlatformEngineeringIngressChart extends Chart {
  constructor(scope: Construct, id: string, props: AiPlatformEngineeringIngressChartProps = {}) {
    super(scope, id, props);

    const namespace = props.namespace || 'ai-platform-engineering';

    new k8s.KubeIngress(this, 'ingress', {
      metadata: {
        name: 'ai-platform-engineering-ingress',
        namespace: namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '0',
          'nginx.ingress.kubernetes.io/rewrite-target': '/$2',
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [
          {
            host: 'localhost',
            http: {
              paths: [
                {
                  path: '/ai-platform-engineering(/|$)(.*)',
                  pathType: 'ImplementationSpecific',
                  backend: {
                    service: {
                      name: 'ai-platform-engineering',
                      port: {
                        number: 8000,
                      },
                    },
                  },
                },
              ],
            },
          },
          {
            host: 'cnoe.localtest.me',
            http: {
              paths: [
                {
                  path: '/ai-platform-engineering(/|$)(.*)',
                  pathType: 'ImplementationSpecific',
                  backend: {
                    service: {
                      name: 'ai-platform-engineering',
                      port: {
                        number: 8000,
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