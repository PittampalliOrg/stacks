import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';

/**
 * KGatewayHTTPGatewayChart creates a simple HTTP Gateway for testing
 * This is separate from the MCP Gateway and follows the kgateway documentation example
 */
export class KGatewayHTTPGatewayChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    const namespace = 'kgateway-system';

    // Create HTTP Gateway following kgateway documentation
    new ApiObject(this, 'http-gateway', {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'Gateway',
      metadata: {
        name: 'http',
        namespace: namespace,
        labels: {
          'app.kubernetes.io/name': 'http-gateway',
          'app.kubernetes.io/component': 'gateway',
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
                from: 'All',
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
  }
}