import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';
import { Quantity } from '../imports/k8s';

export class KGatewayMCPServersChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    const namespace = 'mcp-servers';
    const kgatewayNamespace = 'kgateway-system';

    // Create namespace for MCP servers
    // TEMPORARY: Commenting out due to ArgoCD sync issues
    // new k8s.KubeNamespace(this, 'namespace', {
    //   metadata: {
    //     name: namespace,
    //     labels: {
    //       'app.kubernetes.io/name': 'mcp-servers',
    //       'app.kubernetes.io/part-of': 'kgateway',
    //     },
    //   },
    // });

    // Create ExternalSecret for GitHub token (reuse existing)
    new ApiObject(this, 'github-token-secret', {
      apiVersion: 'external-secrets.io/v1',
      kind: 'ExternalSecret',
      metadata: {
        name: 'github-token',
        namespace: namespace,
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore',
        },
        target: {
          name: 'github-token',
          creationPolicy: 'Owner',
        },
        dataFrom: [
          {
            find: {
              name: {
                regexp: '^GITHUB-PAT$',
              },
            },
            rewrite: [
              {
                regexp: {
                  source: '^GITHUB-PAT$',
                  target: 'token',
                },
              },
            ],
          },
        ],
      },
    });

    // Markdown MCP Tool Deployment - Working SSE example from KGateway docs
    // TEMPORARILY DISABLED: Image not accessible
    /*
    new k8s.KubeDeployment(this, 'markdown-mcp-deployment', {
      metadata: {
        name: 'mcp-tool',
        namespace: namespace,
        labels: {
          'app': 'mcp-tool',
        },
      },
      spec: {
        replicas: 2,
        selector: {
          matchLabels: {
            'app': 'mcp-tool',
          },
        },
        template: {
          metadata: {
            labels: {
              'app': 'mcp-tool',
            },
          },
          spec: {
            containers: [{
              name: 'mcp-tool',
              image: 'us-docker.pkg.dev/developers-369321/gloo-platform-dev/markitdown-mcp:2.0.0-mcpdemo',
              args: [
                '--sse',
                '--host=0.0.0.0',
                '--port=8080',
              ],
              ports: [{
                containerPort: 8080,
                protocol: 'TCP',
              }],
              resources: {
                requests: {
                  cpu: Quantity.fromString('100m'),
                  memory: Quantity.fromString('128Mi'),
                },
                limits: {
                  cpu: Quantity.fromString('500m'),
                  memory: Quantity.fromString('256Mi'),
                },
              },
            }],
          },
        },
      },
    });
    */

    // MCP Tool Service - Working SSE example from KGateway docs
    // TEMPORARILY DISABLED: Corresponding deployment disabled
    /*
    new k8s.KubeService(this, 'mcp-tool-service', {
      metadata: {
        name: 'mcp-tool',
        namespace: namespace,
        labels: {
          'app': 'mcp-tool',
        },
      },
      spec: {
        selector: {
          'app': 'mcp-tool',
        },
        type: 'ClusterIP',
        ports: [{
          protocol: 'TCP',
          port: 8080,
          targetPort: k8s.IntOrString.fromNumber(8080),
          appProtocol: 'kgateway.dev/mcp',
        }],
      },
    });
    */

    // Everything MCP Server Deployment - Commented out as it uses stdio
    /*
    new k8s.KubeDeployment(this, 'everything-mcp-deployment', {
      metadata: {
        name: 'everything-mcp',
        namespace: namespace,
        labels: {
          'app.kubernetes.io/name': 'everything-mcp',
          'app.kubernetes.io/component': 'mcp-server',
          'mcp.kgateway.dev/enabled': 'true',
        },
      },
      spec: {
        replicas: 2,
        selector: {
          matchLabels: {
            'app.kubernetes.io/name': 'everything-mcp',
          },
        },
        template: {
          metadata: {
            labels: {
              'app.kubernetes.io/name': 'everything-mcp',
              'app.kubernetes.io/component': 'mcp-server',
            },
          },
          spec: {
            containers: [{
              name: 'everything-mcp',
              image: 'mcp/filesystem:latest',
              stdin: true, // MCP servers typically need stdin
              tty: true,
              env: [
                { name: 'HOME', value: '/workspace' },
                { name: 'MCP_FILESYSTEM_ROOT', value: '/workspace' },
              ],
              command: ['/workspace'], // Path to allowed directory
              ports: [{
                name: 'mcp',
                containerPort: 3000, // Default MCP port
                protocol: 'TCP',
              }],
              resources: {
                requests: {
                  cpu: Quantity.fromString('100m'),
                  memory: Quantity.fromString('128Mi'),
                },
                limits: {
                  cpu: Quantity.fromString('500m'),
                  memory: Quantity.fromString('512Mi'),
                },
              },
              volumeMounts: [{
                name: 'workspace',
                mountPath: '/workspace',
              }],
            }],
            volumes: [{
              name: 'workspace',
              emptyDir: {},
            }],
          },
        },
      },
    });
    */

    // Everything MCP Service - Commented out as it uses stdio
    /*
    new k8s.KubeService(this, 'everything-mcp-service', {
      metadata: {
        name: 'everything-mcp',
        namespace: namespace,
        labels: {
          'app.kubernetes.io/name': 'everything-mcp',
          'app.kubernetes.io/component': 'mcp-server',
        },
        annotations: {
          'mcp.kgateway.dev/tools': 'everything_*',
          'mcp.kgateway.dev/discovery': 'enabled',
        },
      },
      spec: {
        selector: {
          'app.kubernetes.io/name': 'everything-mcp',
        },
        type: 'ClusterIP',
        ports: [{
          protocol: 'TCP',
          port: 3000,
          targetPort: k8s.IntOrString.fromNumber(3000),
          appProtocol: 'kgateway.dev/mcp',
        }],
      },
    });
    */

    // Grafana MCP Server Deployment
    new k8s.KubeDeployment(this, 'grafana-mcp-deployment', {
      metadata: {
        name: 'grafana-mcp',
        namespace: namespace,
        labels: {
          'app.kubernetes.io/name': 'grafana-mcp',
          'app.kubernetes.io/component': 'mcp-server',
          'mcp.kgateway.dev/enabled': 'true',
        },
      },
      spec: {
        replicas: 2,
        selector: {
          matchLabels: {
            'app.kubernetes.io/name': 'grafana-mcp',
          },
        },
        template: {
          metadata: {
            labels: {
              'app.kubernetes.io/name': 'grafana-mcp',
              'app.kubernetes.io/component': 'mcp-server',
            },
          },
          spec: {
            containers: [{
              name: 'grafana-mcp',
              image: 'mcp/grafana:latest',
              args: [
                '--transport', 'sse', // Use SSE mode for HTTP server
                '--base-path', '/',
                '--endpoint-path', '/mcp',
                '--address', '0.0.0.0:8080', // Listen on all interfaces on port 8080
              ],
              env: [
                {
                  name: 'GRAFANA_URL',
                  value: 'http://grafana.monitoring.svc.cluster.local:80',
                },
                {
                  name: 'GRAFANA_API_KEY',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'grafana-mcp-secrets',
                      key: 'api-key',
                      optional: true,  // Make it optional to allow pod to start
                    },
                  },
                },
              ],
              ports: [{
                name: 'http',
                containerPort: 8080,
                protocol: 'TCP',
              }],
              resources: {
                requests: {
                  cpu: Quantity.fromString('100m'),
                  memory: Quantity.fromString('128Mi'),
                },
                limits: {
                  cpu: Quantity.fromString('500m'),
                  memory: Quantity.fromString('256Mi'),
                },
              },
              // Health checks commented out - Grafana MCP doesn't have a /health endpoint
              // TODO: Check with upstream if there's a health endpoint or use TCP probes
              /*
              livenessProbe: {
                httpGet: {
                  path: '/health',
                  port: k8s.IntOrString.fromNumber(8080),
                },
                initialDelaySeconds: 10,
                periodSeconds: 30,
              },
              readinessProbe: {
                httpGet: {
                  path: '/health',
                  port: k8s.IntOrString.fromNumber(8080),
                },
                initialDelaySeconds: 5,
                periodSeconds: 10,
              },
              startupProbe: {
                httpGet: {
                  path: '/health',
                  port: k8s.IntOrString.fromNumber(8080),
                },
                initialDelaySeconds: 10,
                periodSeconds: 5,
                failureThreshold: 30, // Allow up to 150 seconds for startup
              },
              */
            }],
          },
        },
      },
    });

    // Grafana MCP Service
    new k8s.KubeService(this, 'grafana-mcp-service', {
      metadata: {
        name: 'grafana-mcp',
        namespace: namespace,
        labels: {
          'app.kubernetes.io/name': 'grafana-mcp',
          'app.kubernetes.io/component': 'mcp-server',
        },
        annotations: {
          'mcp.kgateway.dev/tools': 'grafana_*',
          'mcp.kgateway.dev/discovery': 'enabled',
        },
      },
      spec: {
        selector: {
          'app.kubernetes.io/name': 'grafana-mcp',
        },
        type: 'ClusterIP',
        ports: [{
          protocol: 'TCP',
          port: 8080,
          targetPort: k8s.IntOrString.fromNumber(8080),
          appProtocol: 'kgateway.dev/mcp',
        }],
      },
    });

    // Playwright MCP Server Deployment - Commented out for now as there's no official MCP server
    // TODO: Find or build a playwright MCP server
    /*
    new k8s.KubeDeployment(this, 'playwright-mcp-deployment', {
      metadata: {
        name: 'playwright-mcp',
        namespace: namespace,
        labels: {
          'app.kubernetes.io/name': 'playwright-mcp',
          'app.kubernetes.io/component': 'mcp-server',
          'mcp.kgateway.dev/enabled': 'true',
        },
      },
      spec: {
        replicas: 1, // Single instance due to browser resource usage
        selector: {
          matchLabels: {
            'app.kubernetes.io/name': 'playwright-mcp',
          },
        },
        template: {
          metadata: {
            labels: {
              'app.kubernetes.io/name': 'playwright-mcp',
              'app.kubernetes.io/component': 'mcp-server',
            },
          },
          spec: {
            containers: [{
              name: 'playwright-mcp',
              image: 'mcr.microsoft.com/playwright:v1.47.0-jammy',
              command: ['npx'],
              args: [
                '-y',
                '@playwright/mcp@latest',
                '--sse',
                '--host=0.0.0.0',
                '--port=8080',
                '--headless',
              ],
              env: [
                { name: 'HOME', value: '/tmp' },
                { name: 'PLAYWRIGHT_BROWSERS_PATH', value: '/ms-playwright' },
                { name: 'PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD', value: '0' },
                // Chrome arguments for container environment
                { name: 'CHROME_ARGS', value: '--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu' },
              ],
              ports: [{
                name: 'mcp',
                containerPort: 8080,
                protocol: 'TCP',
              }],
              resources: {
                requests: {
                  cpu: Quantity.fromString('500m'),
                  memory: Quantity.fromString('1Gi'),
                },
                limits: {
                  cpu: Quantity.fromString('2000m'),
                  memory: Quantity.fromString('2Gi'),
                },
              },
              volumeMounts: [
                {
                  name: 'playwright-cache',
                  mountPath: '/ms-playwright',
                },
                {
                  name: 'tmp',
                  mountPath: '/tmp',
                },
              ],
              securityContext: {
                runAsUser: 1000,
                runAsGroup: 1000,
              },
            }],
            securityContext: {
              fsGroup: 1000,
            },
            volumes: [
              {
                name: 'playwright-cache',
                emptyDir: {},
              },
              {
                name: 'tmp',
                emptyDir: {},
              },
            ],
          },
        },
      },
    });

    // Playwright MCP Service
    new k8s.KubeService(this, 'playwright-mcp-service', {
      metadata: {
        name: 'playwright-mcp',
        namespace: namespace,
        labels: {
          'app.kubernetes.io/name': 'playwright-mcp',
          'app.kubernetes.io/component': 'mcp-server',
        },
        annotations: {
          'mcp.kgateway.dev/tools': 'playwright_*',
          'mcp.kgateway.dev/discovery': 'enabled',
        },
      },
      spec: {
        selector: {
          'app.kubernetes.io/name': 'playwright-mcp',
        },
        type: 'ClusterIP',
        ports: [{
          protocol: 'TCP',
          port: 8080,
          targetPort: k8s.IntOrString.fromNumber(8080),
          appProtocol: 'kgateway.dev/mcp',
        }],
      },
    });
    */

    // REMOVED: HTTPRoute for Grafana MCP - already defined in kgateway-mcp-routes-chart.ts

    // Create HTTPRoute for Markdown MCP tool as well
    // TEMPORARILY DISABLED: Corresponding service disabled
    /*
    new ApiObject(this, 'markdown-mcp-route', {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'HTTPRoute',
      metadata: {
        name: 'markdown-mcp-route',
        namespace: namespace,
      },
      spec: {
        parentRefs: [
          {
            name: 'mcp-gateway',
            namespace: kgatewayNamespace,
          },
        ],
        rules: [
          {
            matches: [
              {
                path: {
                  type: 'PathPrefix',
                  value: '/markdown',
                },
              },
            ],
            backendRefs: [
              {
                name: 'mcp-tool',
                port: 8080,
              },
            ],
          },
        ],
      },
    });
    */

    // Note: Since we're using kgateway's MCP protocol, we might need MCPRoute instead of HTTPRoute
    // For now, keeping HTTPRoute but this may need to be changed based on kgateway's requirements

    // HTTPRoute for Everything MCP server through kgateway
    // TEMPORARILY DISABLED: Everything MCP uses stdio and isn't compatible with SSE/HTTP transport
    /*
    new ApiObject(this, 'everything-route', {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'HTTPRoute',
      metadata: {
        name: 'everything-mcp-route',
        namespace: namespace,
      },
      spec: {
        parentRefs: [
          {
            name: 'mcp-gateway',
            namespace: kgatewayNamespace,
          },
        ],
        rules: [
          {
            matches: [
              {
                path: {
                  type: 'PathPrefix',
                  value: '/everything',
                },
              },
            ],
            backendRefs: [
              {
                name: 'everything-mcp',
                port: 8080,
              },
            ],
          },
        ],
      },
    });
    */

    // Playwright route commented out until server is deployed
    /*
    new ApiObject(this, 'playwright-route', {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'HTTPRoute',
      metadata: {
        name: 'playwright-mcp-route',
        namespace: namespace,
      },
      spec: {
        parentRefs: [
          {
            name: 'mcp-gateway',
            namespace: kgatewayNamespace,
          },
        ],
        rules: [
          {
            matches: [
              {
                path: {
                  type: 'PathPrefix',
                  value: '/mcp/playwright',
                },
              },
            ],
            backendRefs: [
              {
                name: 'playwright-mcp',
                port: 8080,
              },
            ],
          },
        ],
      },
    });
    */

    // Create ReferenceGrant to allow HTTPRoute to reference services in mcp-servers namespace
    new ApiObject(this, 'mcp-servers-reference-grant', {
      apiVersion: 'gateway.networking.k8s.io/v1beta1',
      kind: 'ReferenceGrant',
      metadata: {
        name: 'allow-kgateway-routes',
        namespace: namespace, // mcp-servers namespace
      },
      spec: {
        from: [
          {
            group: 'gateway.networking.k8s.io',
            kind: 'HTTPRoute',
            namespace: namespace, // Allow HTTPRoutes from same namespace
          },
          {
            group: 'gateway.networking.k8s.io',
            kind: 'HTTPRoute',
            namespace: kgatewayNamespace, // Also allow from kgateway-system namespace
          },
        ],
        to: [
          {
            group: '',
            kind: 'Service',
          },
        ],
      },
    });

    // Create Ingress for Grafana MCP server to make it accessible from MCP Inspector
    new k8s.KubeIngress(this, 'grafana-mcp-ingress', {
      metadata: {
        name: 'grafana-mcp',
        namespace: namespace,
        annotations: {
          'nginx.ingress.kubernetes.io/proxy-body-size': '10m',
          'nginx.ingress.kubernetes.io/proxy-read-timeout': '600',
          'nginx.ingress.kubernetes.io/proxy-send-timeout': '600',
          'nginx.ingress.kubernetes.io/proxy-http-version': '1.1',
          // Enable WebSocket/SSE support
          'nginx.ingress.kubernetes.io/proxy-buffering': 'off',
          'nginx.ingress.kubernetes.io/configuration-snippet': `
            proxy_set_header Accept-Encoding "";
            proxy_set_header Connection "";
            proxy_cache off;
            proxy_set_header X-Accel-Buffering no;
          `,
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [
          {
            host: `grafana-mcp.${process.env.INGRESS_HOST || 'localtest.me'}`,
            http: {
              paths: [{
                path: '/',
                pathType: 'Prefix',
                backend: {
                  service: {
                    name: 'grafana-mcp',
                    port: {
                      number: 8080,
                    },
                  },
                },
              }],
            },
          },
        ],
      },
    });

    // Create Ingress for MCP Tool server as well
    // TEMPORARILY DISABLED: Corresponding service disabled
    /*
    new k8s.KubeIngress(this, 'mcp-tool-ingress', {
      metadata: {
        name: 'mcp-tool',
        namespace: namespace,
        annotations: {
          'nginx.ingress.kubernetes.io/proxy-body-size': '10m',
          'nginx.ingress.kubernetes.io/proxy-read-timeout': '600',
          'nginx.ingress.kubernetes.io/proxy-send-timeout': '600',
          'nginx.ingress.kubernetes.io/proxy-http-version': '1.1',
          // Enable WebSocket/SSE support
          'nginx.ingress.kubernetes.io/proxy-buffering': 'off',
          'nginx.ingress.kubernetes.io/configuration-snippet': `
            proxy_set_header Accept-Encoding "";
            proxy_set_header Connection "";
            proxy_cache off;
            proxy_set_header X-Accel-Buffering no;
          `,
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [
          {
            host: `mcp-tool.${process.env.INGRESS_HOST || 'localtest.me'}`,
            http: {
              paths: [{
                path: '/',
                pathType: 'Prefix',
                backend: {
                  service: {
                    name: 'mcp-tool',
                    port: {
                      number: 8080,
                    },
                  },
                },
              }],
            },
          },
        ],
      },
    });
    */
  }
}