import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';

/**
 * KGatewayMCPGatewayChart creates the Gateway API resources needed for exposing
 * MCP servers through kgateway's MCP protocol support.
 * 
 * This enables:
 * - Centralized MCP endpoint with multiplexing
 * - Authentication/authorization through kgateway
 * - Observability and metrics for MCP calls
 * - Discovery of all MCP tools through a single endpoint
 */
export class KGatewayMCPGatewayChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    const kgatewayNamespace = 'kgateway-system';

    // Create MCP Gateway using the standard kgateway GatewayClass
    // Use HTTP protocol instead of custom protocol to avoid supportedKinds issues
    new ApiObject(this, 'mcp-gateway', {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'Gateway',
      metadata: {
        name: 'mcp-gateway',
        namespace: kgatewayNamespace,
        labels: {
          'app.kubernetes.io/name': 'mcp-gateway',
          'app.kubernetes.io/part-of': 'kgateway',
        },
      },
      spec: {
        gatewayClassName: 'kgateway',
        listeners: [
          {
            name: 'http',
            protocol: 'HTTP',
            port: 8080,
            allowedRoutes: {
              namespaces: {
                from: 'All', // Allow routes from all namespaces
              },
              kinds: [{
                group: 'gateway.networking.k8s.io',
                kind: 'HTTPRoute',
              }],
            },
          },
        ],
      },
    });

    // Note: Since we're using the standard kgateway GatewayClass,
    // kgateway will automatically create the proxy deployment and service.
    // We don't need to create them manually.
  }
}