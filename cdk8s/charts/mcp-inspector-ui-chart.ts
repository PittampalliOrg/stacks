import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

export class McpInspectorUiChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    const namespace = 'mcp-tools';

    // Consolidated Ingress for MCP Inspector (UI + Proxy)
    new k8s.KubeIngress(this, 'mcp-inspector-ingress', {
      metadata: {
        name: 'mcp-inspector',
        namespace: namespace,
        annotations: {
          'nginx.ingress.kubernetes.io/proxy-body-size': '10m',
          'nginx.ingress.kubernetes.io/proxy-read-timeout': '600',
          'nginx.ingress.kubernetes.io/proxy-send-timeout': '600',
          'nginx.ingress.kubernetes.io/websocket-services': 'mcp-inspector-ui,mcp-inspector-proxy',
          'nginx.ingress.kubernetes.io/proxy-http-version': '1.1',
          // Enable regex for path matching
          'nginx.ingress.kubernetes.io/use-regex': 'true',
          // Rewrite target for proxy paths
          'nginx.ingress.kubernetes.io/rewrite-target': '/$2',
          'nginx.ingress.kubernetes.io/configuration-snippet': `
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Accel-Buffering no;
          `,
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [
          {
            host: `mcp-inspector.${process.env.INGRESS_HOST || 'localtest.me'}`,
            http: {
              paths: [
                {
                  // Proxy path - must come first due to regex matching
                  path: '/proxy(/|$)(.*)',
                  pathType: 'ImplementationSpecific',
                  backend: {
                    service: {
                      name: 'mcp-inspector-proxy',
                      port: {
                        number: 80,
                      },
                    },
                  },
                },
                {
                  // Message endpoint for proxy session management
                  path: '/message',
                  pathType: 'Prefix', // Changed from Exact to allow query parameters
                  backend: {
                    service: {
                      name: 'mcp-inspector-proxy',
                      port: {
                        number: 80,
                      },
                    },
                  },
                },
                {
                  // UI path - catch all remaining
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: 'mcp-inspector-ui',
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

    // Note: The separate proxy ingress has been removed and consolidated into the main ingress
    // The proxy is now accessible at http://mcp-inspector.localtest.me/proxy/
  }
}