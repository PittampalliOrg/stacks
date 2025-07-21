import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for MCP Servers
 * Deploys MCP tool servers including mcp-tool and grafana-mcp
 */
export class MCPServersAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // MCP Servers (mcp-tool, grafana-mcp, etc.)
    this.createApplication('mcp-servers', {
      resourcePath: 'kgateway-mcp-servers',
      namespace: 'mcp-servers',
      project: 'ai-platform',
      syncWave: '85',
      labels: {
        'app.kubernetes.io/component': 'mcp-servers',
        'app.kubernetes.io/part-of': 'kgateway',
        'app.kubernetes.io/name': 'mcp-servers'
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