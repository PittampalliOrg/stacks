import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { KubeIngress } from '../imports/k8s';

export class KagentIngressChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    // Create Ingress for kagent UI
    new KubeIngress(this, 'kagent-ui-ingress', {
      metadata: {
        name: 'kagent-ui',
        namespace: 'kagent',
        annotations: {
          'nginx.ingress.kubernetes.io/proxy-body-size': '100m',
          'nginx.ingress.kubernetes.io/proxy-connect-timeout': '600',
          'nginx.ingress.kubernetes.io/proxy-send-timeout': '600',
          'nginx.ingress.kubernetes.io/proxy-read-timeout': '600',
          'nginx.ingress.kubernetes.io/proxy-http-version': '1.1',
          'nginx.ingress.kubernetes.io/configuration-snippet': `proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Accept-Encoding "";
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`,
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [
          {
            host: `kagent.${process.env.INGRESS_HOST || 'localtest.me'}`,
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: 'kagent',
                      port: {
                        number: 80,
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