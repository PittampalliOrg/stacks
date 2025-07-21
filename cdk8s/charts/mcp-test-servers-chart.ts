import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';

/**
 * MCPTestServersChart - Reserved for future MCP test server implementations
 * 
 * Note: The echo-mcp server has been moved to mcp-echo-server-chart.ts
 * to avoid resource conflicts in ArgoCD.
 * 
 * This chart can be used for additional test servers in the future,
 * such as:
 * - Time server
 * - Weather server
 * - Mock API servers
 * - Other MCP protocol test implementations
 */
export class MCPTestServersChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    // Currently empty - reserved for future test servers
    // The echo-mcp server is now in mcp-echo-server-chart.ts
  }
}