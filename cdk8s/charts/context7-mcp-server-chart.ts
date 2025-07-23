import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

/**
 * Chart for deploying the Context-7 MCP server
 * This provides up-to-date documentation retrieval capabilities through MCP
 */
export class Context7MCPServerChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    const namespace = 'mcp-servers';
    const appName = 'context7-mcp';

    // The mcp/context7 image should support HTTP transport natively
    // If it's stdio-only, we would need the Smithery API endpoint instead
    
    // Deployment
    new k8s.KubeDeployment(this, 'context7-deployment', {
      metadata: {
        name: appName,
        namespace,
        labels: {
          'app.kubernetes.io/name': appName,
          'app.kubernetes.io/component': 'mcp-server',
          'app.kubernetes.io/part-of': 'mcp-servers',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            'app.kubernetes.io/name': appName,
          },
        },
        template: {
          metadata: {
            labels: {
              'app.kubernetes.io/name': appName,
              'app.kubernetes.io/component': 'mcp-server',
            },
          },
          spec: {
            containers: [
              {
                name: 'context7',
                image: 'mcp/context7:1.0.0',
                imagePullPolicy: 'IfNotPresent',
                ports: [
                  {
                    name: 'http',
                    containerPort: 8080,
                    protocol: 'TCP',
                  },
                ],
                env: [
                  {
                    name: 'PORT',
                    value: '8080',
                  },
                  {
                    name: 'MCP_TRANSPORT',
                    value: 'http',
                  },
                ],
                livenessProbe: {
                  httpGet: {
                    path: '/ping',
                    port: k8s.IntOrString.fromNumber(8080),
                  },
                  initialDelaySeconds: 30,
                  periodSeconds: 10,
                },
                readinessProbe: {
                  httpGet: {
                    path: '/ping',
                    port: k8s.IntOrString.fromNumber(8080),
                  },
                  initialDelaySeconds: 5,
                  periodSeconds: 5,
                },
                resources: {
                  requests: {
                    cpu: k8s.Quantity.fromString('100m'),
                    memory: k8s.Quantity.fromString('256Mi'),
                  },
                  limits: {
                    cpu: k8s.Quantity.fromString('500m'),
                    memory: k8s.Quantity.fromString('512Mi'),
                  },
                },
              },
            ],
          },
        },
      },
    });

    // Service
    new k8s.KubeService(this, 'context7-service', {
      metadata: {
        name: appName,
        namespace,
        labels: {
          'app.kubernetes.io/name': appName,
          'app.kubernetes.io/component': 'mcp-server',
          'app.kubernetes.io/part-of': 'mcp-servers',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
      },
      spec: {
        type: 'ClusterIP',
        selector: {
          'app.kubernetes.io/name': appName,
        },
        ports: [
          {
            name: 'http',
            port: 8080,
            targetPort: k8s.IntOrString.fromNumber(8080),
            protocol: 'TCP',
          },
        ],
      },
    });
  }
}