import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';
import { Quantity } from '../imports/k8s';

export class McpInspectorDockerChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    const namespace = 'mcp-tools';
    const appName = 'mcp-inspector';

    // Create namespace if not exists
    // TEMPORARY: Commenting out due to ArgoCD sync issues
    // new k8s.KubeNamespace(this, 'mcp-tools-namespace', {
    //   metadata: {
    //     name: namespace,
    //     labels: {
    //       'app.kubernetes.io/managed-by': 'cdk8s',
    //     },
    //   },
    // });

    // Deployment using Docker image
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
            imagePullSecrets: [{
              name: 'vpittamp-acr-dockercfg',
            }],
            containers: [{
              name: 'mcp-inspector',
              image: 'vpittamp.azurecr.io/inspector:0.15.0', // Private ACR image
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
                  name: 'HOST',
                  value: '0.0.0.0',
                },
                {
                  name: 'CLIENT_PORT',
                  value: '6274',
                },
                {
                  name: 'SERVER_PORT',
                  value: '6277',
                },
                {
                  name: 'DANGEROUSLY_OMIT_AUTH',
                  value: 'true', // Disable auth for internal use
                },
                {
                  name: 'ALLOWED_ORIGINS',
                  value: 'http://mcp-inspector.localtest.me,http://localhost:6274',
                },
                {
                  name: 'NODE_ENV',
                  value: 'production',
                },
                {
                  name: 'MCP_PROXY_FULL_ADDRESS',
                  value: 'http://mcp-inspector.localtest.me/proxy',
                },
                {
                  name: 'MCP_AUTO_OPEN_ENABLED',
                  value: 'false', // Disable browser auto-open in containerized environment
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
              readinessProbe: {
                httpGet: {
                  path: '/',
                  port: k8s.IntOrString.fromNumber(6274),
                },
                initialDelaySeconds: 10,
                periodSeconds: 5,
                timeoutSeconds: 3,
                failureThreshold: 3,
              },
              livenessProbe: {
                httpGet: {
                  path: '/',
                  port: k8s.IntOrString.fromNumber(6274),
                },
                initialDelaySeconds: 30,
                periodSeconds: 30,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
            }],
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

    // Service for Proxy (internal use)
    new k8s.KubeService(this, 'mcp-inspector-proxy-service', {
      metadata: {
        name: `${appName}-proxy`,
        namespace: namespace,
        labels: {
          'app.kubernetes.io/name': appName,
          'app.kubernetes.io/component': 'proxy',
        },
        annotations: {
          'service.kubernetes.io/topology-aware-hints': 'auto',
        },
      },
      spec: {
        type: 'ClusterIP',
        selector: {
          app: appName,
        },
        ports: [{
          name: 'http',
          port: 6277,
          targetPort: k8s.IntOrString.fromNumber(6277),
          protocol: 'TCP',
        }],
      },
    });

    // Ingress for UI access (without rewrite rules)
    new k8s.KubeIngress(this, 'mcp-inspector-ui-ingress', {
      metadata: {
        name: `${appName}-ui`,
        namespace: namespace,
        annotations: {
          'nginx.ingress.kubernetes.io/proxy-body-size': '10m',
          'nginx.ingress.kubernetes.io/proxy-read-timeout': '600',
          'nginx.ingress.kubernetes.io/proxy-send-timeout': '600',
          'nginx.ingress.kubernetes.io/websocket-services': `${appName}-ui`,
          'nginx.ingress.kubernetes.io/proxy-http-version': '1.1',
          'nginx.ingress.kubernetes.io/server-snippet': `
            if ($request_uri = "/") {
              return 302 /?MCP_PROXY_FULL_ADDRESS=http%3A%2F%2Fmcp-inspector.localtest.me%2Fproxy&_t=$msec;
            }
          `,
          'nginx.ingress.kubernetes.io/configuration-snippet': `
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
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
                  // UI path - serves the inspector interface
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: `${appName}-ui`,
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

    // Separate ingress for proxy with rewrite rules
    new k8s.KubeIngress(this, 'mcp-inspector-proxy-ingress', {
      metadata: {
        name: `${appName}-proxy`,
        namespace: namespace,
        annotations: {
          'nginx.ingress.kubernetes.io/proxy-body-size': '10m',
          'nginx.ingress.kubernetes.io/proxy-read-timeout': '600',
          'nginx.ingress.kubernetes.io/proxy-send-timeout': '600',
          'nginx.ingress.kubernetes.io/websocket-services': `${appName}-proxy`,
          'nginx.ingress.kubernetes.io/proxy-http-version': '1.1',
          'nginx.ingress.kubernetes.io/use-regex': 'true',
          'nginx.ingress.kubernetes.io/rewrite-target': '/$2',
          'nginx.ingress.kubernetes.io/configuration-snippet': `
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
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
                  // Proxy path with regex and rewrite
                  path: '/proxy(/|$)(.*)',
                  pathType: 'ImplementationSpecific',
                  backend: {
                    service: {
                      name: `${appName}-proxy`,
                      port: {
                        number: 6277,
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

    // HorizontalPodAutoscaler (disabled for local development)
    // Note: HPA requires metrics-server to be installed in the cluster
    // Uncomment the following block if you have metrics-server installed
    /*
    new k8s.KubeHorizontalPodAutoscaler(this, 'mcp-inspector-hpa', {
      metadata: {
        name: appName,
        namespace: namespace,
      },
      spec: {
        scaleTargetRef: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          name: appName,
        },
        minReplicas: 1,
        maxReplicas: 3,
        targetCpuUtilizationPercentage: 70,
      },
    });
    */
  }
}