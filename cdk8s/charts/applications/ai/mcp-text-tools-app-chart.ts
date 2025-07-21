import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for MCP Text Tools Server
 * Deploys TypeScript-based MCP server with text manipulation tools
 */
export class MCPTextToolsAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // MCP Text Tools Server
    this.createApplication('mcp-text-tools', {
      resourcePath: 'mcp-text-tools',
      namespace: 'mcp-servers',
      project: 'ai-platform',
      syncWave: '88', // After mcp-echo-server (87)
      labels: {
        'app.kubernetes.io/component': 'mcp-text-tools',
        'app.kubernetes.io/part-of': 'mcp-tools',
        'app.kubernetes.io/name': 'mcp-text-tools'
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