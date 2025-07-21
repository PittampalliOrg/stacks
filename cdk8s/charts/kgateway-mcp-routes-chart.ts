import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';

/**
 * KGatewayMCPRoutesChart creates HTTPRoute resources to route traffic
 * from the MCP Gateway to individual MCP servers.
 */
export class KGatewayMCPRoutesChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    const kgatewayNamespace = 'kgateway-system';
    const mcpServersNamespace = 'mcp-servers';

    // Create HTTPRoute for echo-mcp server
    new ApiObject(this, 'echo-mcp-route', {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'HTTPRoute',
      metadata: {
        name: 'echo-mcp',
        namespace: mcpServersNamespace,
        labels: {
          'app.kubernetes.io/name': 'echo-mcp',
          'app.kubernetes.io/part-of': 'mcp-servers',
        },
      },
      spec: {
        parentRefs: [{
          group: 'gateway.networking.k8s.io',
          kind: 'Gateway',
          name: 'mcp-gateway',
          namespace: kgatewayNamespace,
        }],
        hostnames: ['echo.mcp-gateway.localtest.me'],
        rules: [{
          matches: [{
            path: {
              type: 'PathPrefix',
              value: '/',
            },
          }],
          backendRefs: [{
            group: '',
            kind: 'Service',
            name: 'echo-mcp',
            port: 8080,
            weight: 1,
          }],
        }],
      },
    });

    // Create HTTPRoute for grafana-mcp server
    new ApiObject(this, 'grafana-mcp-route', {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'HTTPRoute',
      metadata: {
        name: 'grafana-mcp',
        namespace: mcpServersNamespace,
        labels: {
          'app.kubernetes.io/name': 'grafana-mcp',
          'app.kubernetes.io/part-of': 'mcp-servers',
        },
      },
      spec: {
        parentRefs: [{
          group: 'gateway.networking.k8s.io',
          kind: 'Gateway',
          name: 'mcp-gateway',
          namespace: kgatewayNamespace,
        }],
        hostnames: ['grafana.mcp-gateway.localtest.me'],
        rules: [{
          matches: [{
            path: {
              type: 'PathPrefix',
              value: '/',
            },
          }],
          backendRefs: [{
            group: '',
            kind: 'Service',
            name: 'grafana-mcp',
            port: 8080,
            weight: 1,
          }],
        }],
      },
    });

    // REMOVED: HTTPRoute for mcp-tool server - no corresponding service exists

    // Create HTTPRoute for mcp-text-tools server
    new ApiObject(this, 'mcp-text-tools-route', {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'HTTPRoute',
      metadata: {
        name: 'mcp-text-tools',
        namespace: mcpServersNamespace,
        labels: {
          'app.kubernetes.io/name': 'mcp-text-tools',
          'app.kubernetes.io/part-of': 'mcp-servers',
        },
      },
      spec: {
        parentRefs: [{
          group: 'gateway.networking.k8s.io',
          kind: 'Gateway',
          name: 'mcp-gateway',
          namespace: kgatewayNamespace,
        }],
        hostnames: ['text-tools.mcp-gateway.localtest.me'],
        rules: [{
          matches: [{
            path: {
              type: 'PathPrefix',
              value: '/',
            },
          }],
          backendRefs: [{
            group: '',
            kind: 'Service',
            name: 'mcp-text-tools',
            port: 8080,
            weight: 1,
          }],
        }],
      },
    });

    // Create HTTPRoute for context7-mcp server
    new ApiObject(this, 'context7-mcp-route', {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'HTTPRoute',
      metadata: {
        name: 'context7-mcp',
        namespace: mcpServersNamespace,
        labels: {
          'app.kubernetes.io/name': 'context7-mcp',
          'app.kubernetes.io/part-of': 'mcp-servers',
        },
      },
      spec: {
        parentRefs: [{
          group: 'gateway.networking.k8s.io',
          kind: 'Gateway',
          name: 'mcp-gateway',
          namespace: kgatewayNamespace,
        }],
        hostnames: ['context7.mcp-gateway.localtest.me'],
        rules: [{
          matches: [{
            path: {
              type: 'PathPrefix',
              value: '/',
            },
          }],
          backendRefs: [{
            group: '',
            kind: 'Service',
            name: 'context7-mcp',
            port: 8080,
            weight: 1,
          }],
        }],
      },
    });

    // Create HTTPRoute for neon-mcp server
    new ApiObject(this, 'neon-mcp-route', {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'HTTPRoute',
      metadata: {
        name: 'neon-mcp',
        namespace: mcpServersNamespace,
        labels: {
          'app.kubernetes.io/name': 'neon-mcp',
          'app.kubernetes.io/part-of': 'mcp-servers',
        },
      },
      spec: {
        parentRefs: [{
          group: 'gateway.networking.k8s.io',
          kind: 'Gateway',
          name: 'mcp-gateway',
          namespace: kgatewayNamespace,
        }],
        hostnames: ['neon.mcp-gateway.localtest.me'],
        rules: [{
          matches: [{
            path: {
              type: 'PathPrefix',
              value: '/',
            },
          }],
          backendRefs: [{
            group: '',
            kind: 'Service',
            name: 'neon-mcp',
            port: 8080,
            weight: 1,
          }],
        }],
      },
    });

    // Create HTTPRoute for argocd-mcp server
    new ApiObject(this, 'argocd-mcp-route', {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'HTTPRoute',
      metadata: {
        name: 'argocd-mcp',
        namespace: mcpServersNamespace,
        labels: {
          'app.kubernetes.io/name': 'argocd-mcp',
          'app.kubernetes.io/part-of': 'mcp-servers',
        },
      },
      spec: {
        parentRefs: [{
          group: 'gateway.networking.k8s.io',
          kind: 'Gateway',
          name: 'mcp-gateway',
          namespace: kgatewayNamespace,
        }],
        hostnames: ['argocd.mcp-gateway.localtest.me'],
        rules: [{
          matches: [{
            path: {
              type: 'PathPrefix',
              value: '/',
            },
          }],
          backendRefs: [{
            group: '',
            kind: 'Service',
            name: 'argocd-mcp',
            port: 8080,
            weight: 1,
          }],
        }],
      },
    });
  }
}