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

    // Updated for domain-based routing
    new k8s.KubeIngress(this, 'ingress', {
      metadata: {
        name: 'ai-platform-engineering-ingress',
        namespace: namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '0',
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [
          {
            host: 'ai-platform-engineering.cnoe.localtest.me',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
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