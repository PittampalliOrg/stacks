import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';
import { Quantity } from '../imports/k8s';

export class McpInspectorChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    const namespace = 'mcp-tools';
    const appName = 'mcp-inspector';

    // Create namespace
    // TEMPORARY: Commenting out due to ArgoCD sync issues
    // new k8s.KubeNamespace(this, 'mcp-tools-namespace', {
    //   metadata: {
    //     name: namespace,
    //     labels: {
    //       'app.kubernetes.io/managed-by': 'cdk8s',
    //     },
    //   },
    // });

    // ConfigMap for startup script
    new k8s.KubeConfigMap(this, 'mcp-inspector-scripts', {
      metadata: {
        name: 'mcp-inspector-scripts',
        namespace: namespace,
      },
      data: {
        'start.sh': `#!/bin/bash
set -e

echo "Starting MCP Inspector..."

# Set environment variables
export HOST=0.0.0.0
export CLIENT_PORT=6274
export SERVER_PORT=6277

# Disable auth for internal cluster use (secured by ingress/network policies)
export DANGEROUSLY_OMIT_AUTH=true

# Allow origins from our ingress domains
export ALLOWED_ORIGINS="http://mcp-inspector.localtest.me,http://localhost:6274"

# Start the inspector proxy
echo "Starting MCP Inspector on ports $CLIENT_PORT (UI) and $SERVER_PORT (proxy)..."
exec npx @modelcontextprotocol/inspector
`,
        'healthcheck.sh': `#!/bin/bash
# Simple health check for the proxy server
curl -f http://localhost:6277/health || exit 1
`,
      },
    });

    // Deployment
    const deployment = new k8s.KubeDeployment(this, 'mcp-inspector-deployment', {
      metadata: {
        name: appName,
        namespace: namespace,
        labels: {
          'app.kubernetes.io/name': appName,
          'app.kubernetes.io/component': 'debugger',
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: appName,
          },
        },
        template: {
          metadata: {
            labels: {
              app: appName,
              'app.kubernetes.io/name': appName,
              'app.kubernetes.io/component': 'debugger',
            },
          },
          spec: {
            containers: [{
              name: 'mcp-inspector',
              image: 'node:22-alpine',
              command: ['/bin/sh'],
              args: ['/scripts/start.sh'],
              ports: [
                {
                  name: 'ui',
                  containerPort: 6274,
                  protocol: 'TCP',
                },
                {
                  name: 'proxy',
                  containerPort: 6277,
                  protocol: 'TCP',
                },
              ],
              env: [
                {
                  name: 'NODE_ENV',
                  value: 'production',
                },
                {
                  name: 'LOG_LEVEL',
                  value: 'info',
                },
              ],
              resources: {
                requests: {
                  cpu: Quantity.fromString('100m'),
                  memory: Quantity.fromString('256Mi'),
                },
                limits: {
                  cpu: Quantity.fromString('500m'),
                  memory: Quantity.fromString('512Mi'),
                },
              },
              // Health checks disabled - MCP Inspector doesn't have a /health endpoint
              // TODO: Consider implementing TCP probes or custom health check script
              volumeMounts: [
                {
                  name: 'scripts',
                  mountPath: '/scripts',
                },
              ],
            }],
            volumes: [
              {
                name: 'scripts',
                configMap: {
                  name: 'mcp-inspector-scripts',
                  defaultMode: 0o755,
                },
              },
            ],
          },
        },
      },
    });

    // Service for UI
    new k8s.KubeService(this, 'mcp-inspector-ui-service', {
      metadata: {
        name: `${appName}-ui`,
        namespace: namespace,
        labels: {
          'app.kubernetes.io/name': appName,
          'app.kubernetes.io/component': 'ui',
        },
      },
      spec: {
        type: 'ClusterIP',
        selector: {
          app: appName,
        },
        ports: [{
          name: 'http',
          port: 80,
          targetPort: k8s.IntOrString.fromNumber(6274),
          protocol: 'TCP',
        }],
      },
    });

    // Service for Proxy
    new k8s.KubeService(this, 'mcp-inspector-proxy-service', {
      metadata: {
        name: `${appName}-proxy`,
        namespace: namespace,
        labels: {
          'app.kubernetes.io/name': appName,
          'app.kubernetes.io/component': 'proxy',
        },
      },
      spec: {
        type: 'ClusterIP',
        selector: {
          app: appName,
        },
        ports: [{
          name: 'http',
          port: 80,
          targetPort: k8s.IntOrString.fromNumber(6277),
          protocol: 'TCP',
        }],
      },
    });

    // Note: Ingress is created by mcp-inspector-ui-chart.ts to avoid duplication
    // and to include proper WebSocket configuration

    // NetworkPolicy for security
    new k8s.KubeNetworkPolicy(this, 'mcp-inspector-network-policy', {
      metadata: {
        name: appName,
        namespace: namespace,
      },
      spec: {
        podSelector: {
          matchLabels: {
            app: appName,
          },
        },
        policyTypes: ['Ingress', 'Egress'],
        ingress: [
          {
            from: [
              {
                namespaceSelector: {
                  matchLabels: {
                    'kubernetes.io/metadata.name': 'ingress-nginx',
                  },
                },
              },
              {
                podSelector: {
                  matchLabels: {
                    'app.kubernetes.io/component': 'mcp-server',
                  },
                },
              },
            ],
            ports: [
              {
                protocol: 'TCP',
                port: k8s.IntOrString.fromNumber(6274),
              },
              {
                protocol: 'TCP',
                port: k8s.IntOrString.fromNumber(6277),
              },
            ],
          },
        ],
        egress: [
          {
            // Allow DNS
            to: [{
              namespaceSelector: {
                matchLabels: {
                  'kubernetes.io/metadata.name': 'kube-system',
                },
              },
            }],
            ports: [{
              protocol: 'UDP',
              port: k8s.IntOrString.fromNumber(53),
            }],
          },
          {
            // Allow connections to MCP servers
            to: [{
              namespaceSelector: {
                matchLabels: {
                  'kubernetes.io/metadata.name': 'mcp-servers',
                },
              },
            }],
            ports: [{
              protocol: 'TCP',
              port: k8s.IntOrString.fromNumber(8080),
            }],
          },
          {
            // Allow connections to MCP Gateway in kgateway-system
            to: [{
              namespaceSelector: {
                matchLabels: {
                  'kubernetes.io/metadata.name': 'kgateway-system',
                },
              },
            }],
            ports: [{
              protocol: 'TCP',
              port: k8s.IntOrString.fromNumber(8080),
            }],
          },
          {
            // Allow HTTPS for npm packages
            ports: [{
              protocol: 'TCP',
              port: k8s.IntOrString.fromNumber(443),
            }],
          },
        ],
      },
    });

    // PodDisruptionBudget
    new k8s.KubePodDisruptionBudget(this, 'mcp-inspector-pdb', {
      metadata: {
        name: appName,
        namespace: namespace,
      },
      spec: {
        minAvailable: k8s.IntOrString.fromNumber(1),
        selector: {
          matchLabels: {
            app: appName,
          },
        },
      },
    });
  }
}