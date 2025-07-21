import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for MCP Echo Server
 * Deploys TypeScript-based echo MCP server
 */
export class MCPEchoServerAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // MCP Echo Server
    this.createApplication('mcp-echo-server', {
      resourcePath: 'mcp-echo-server',
      namespace: 'mcp-servers',
      project: 'ai-platform',
      syncWave: '87', // After mcp-test-servers (86)
      labels: {
        'app.kubernetes.io/component': 'mcp-echo-server',
        'app.kubernetes.io/part-of': 'mcp-tools',
        'app.kubernetes.io/name': 'mcp-echo-server'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true,
          allowEmpty: false
        },
        syncOptions: [
          'CreateNamespace=true',
          'ServerSideApply=true',
          'RespectIgnoreDifferences=true'
        ],
        retry: {
          limit: 5,
          backoff: {
            duration: '10s',
            factor: 2,
            maxDuration: '3m'
          }
        }
      },
      ignoreDifferences: [{
        group: '',
        kind: 'Service',
        jsonPointers: [
          '/spec/clusterIP',
          '/spec/clusterIPs'
        ]
      }]
    });
  }
}