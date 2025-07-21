import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';

export class KGatewayKagentToolServersChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    const namespace = 'kagent';

    // Markdown MCP Tool - Streamable HTTP
    new ApiObject(this, 'markdown-toolserver', {
      apiVersion: 'kagent.dev/v1alpha1',
      kind: 'ToolServer',
      metadata: {
        name: 'markdown-mcp-tools',
        namespace: namespace,
        labels: {
          'app.kubernetes.io/name': 'kagent-toolserver',
          'app.kubernetes.io/instance': 'markdown-mcp',
          'app.kubernetes.io/component': 'toolserver',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
      },
      spec: {
        description: 'Markdown conversion tools via MCP',
        config: {
          streamableHttp: {
            url: 'http://mcp-tool.mcp-servers.svc.cluster.local:8080/',
            timeout: '30s',
          },
        },
      },
    });

    // Grafana MCP Tool - Streamable HTTP
    new ApiObject(this, 'grafana-toolserver', {
      apiVersion: 'kagent.dev/v1alpha1',
      kind: 'ToolServer',
      metadata: {
        name: 'grafana-mcp-tools',
        namespace: namespace,
        labels: {
          'app.kubernetes.io/name': 'kagent-toolserver',
          'app.kubernetes.io/instance': 'grafana-mcp',
          'app.kubernetes.io/component': 'toolserver',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
      },
      spec: {
        description: 'Grafana dashboard and monitoring tools via MCP',
        config: {
          streamableHttp: {
            url: 'http://grafana-mcp.mcp-servers.svc.cluster.local:8080/',
            timeout: '30s',
          },
        },
      },
    });

    // REMOVED: Grafana MCP Tool via KGateway - duplicate of direct grafana-mcp-tools

    // Everything MCP Server - Streamable HTTP
    // NOTE: This will be activated once the Everything MCP server is deployed
    new ApiObject(this, 'everything-toolserver', {
      apiVersion: 'kagent.dev/v1alpha1',
      kind: 'ToolServer',
      metadata: {
        name: 'everything-mcp-tools',
        namespace: 'kagent',
        labels: {
          'app.kubernetes.io/name': 'kagent-toolserver',
          'app.kubernetes.io/instance': 'everything-mcp',
          'app.kubernetes.io/component': 'toolserver',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
      },
      spec: {
        description: 'General purpose tools including file system, web fetch, and more',
        config: {
          streamableHttp: {
            // Direct connection to Everything MCP server
            url: 'http://everything-mcp.mcp-servers.svc.cluster.local:8080/',
            timeout: '30s',
          },
        },
      },
    });

    // Echo MCP Server - Testing tool
    new ApiObject(this, 'echo-toolserver', {
      apiVersion: 'kagent.dev/v1alpha1',
      kind: 'ToolServer',
      metadata: {
        name: 'echo-mcp-tools',
        namespace: namespace,
        labels: {
          'app.kubernetes.io/name': 'kagent-toolserver',
          'app.kubernetes.io/instance': 'echo-mcp',
          'app.kubernetes.io/component': 'toolserver',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
      },
      spec: {
        description: 'Echo tools for testing MCP integration - returns input text',
        config: {
          streamableHttp: {
            url: 'http://echo-mcp.mcp-servers.svc.cluster.local:8080/',
            timeout: '30s',
          },
        },
      },
    });

    // Text Tools MCP Server - Text manipulation utilities
    new ApiObject(this, 'text-tools-toolserver', {
      apiVersion: 'kagent.dev/v1alpha1',
      kind: 'ToolServer',
      metadata: {
        name: 'text-tools-mcp',
        namespace: namespace,
        labels: {
          'app.kubernetes.io/name': 'kagent-toolserver',
          'app.kubernetes.io/instance': 'text-tools-mcp',
          'app.kubernetes.io/component': 'toolserver',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
      },
      spec: {
        description: 'Text manipulation tools - uppercase, lowercase, reverse, word count, base64 encode/decode',
        config: {
          streamableHttp: {
            url: 'http://mcp-text-tools.mcp-servers.svc.cluster.local:8080/',
            timeout: '30s',
          },
        },
      },
    });

    // Context-7 MCP Server - Documentation retrieval
    new ApiObject(this, 'context7-toolserver', {
      apiVersion: 'kagent.dev/v1alpha1',
      kind: 'ToolServer',
      metadata: {
        name: 'context7-mcp-tools',
        namespace: namespace,
        labels: {
          'app.kubernetes.io/name': 'kagent-toolserver',
          'app.kubernetes.io/instance': 'context7-mcp',
          'app.kubernetes.io/component': 'toolserver',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
      },
      spec: {
        description: 'Context7 documentation retrieval - fetches up-to-date docs and code examples',
        config: {
          streamableHttp: {
            url: 'http://context7-mcp.mcp-servers.svc.cluster.local:8080/mcp',
            timeout: '30s',
            headers: {
              'Accept': 'application/json, text/event-stream',
            },
          },
        },
      },
    });


    // NOTE: The following MCP servers were removed because they are CLI-based tools
    // that don't support HTTP transport:
    // - kubernetes-mcp-tools: CLI tool for kubectl operations
    // - notion-mcp-tools: CLI tool for Notion API
    // - playwright-mcp-tools: CLI tool for browser automation
    // - github-mcp-tools: CLI tool for GitHub API (runs on stdio)
    // Only MCP servers that support HTTP transport (like context7) will work with Kagent
    

    // DEPRECATED: Removed kgateway-mcp-config ConfigMap
    // We're now using direct service endpoints instead of routing through kgateway
    // Each ToolServer specifies its MCP server endpoint directly
  }
}