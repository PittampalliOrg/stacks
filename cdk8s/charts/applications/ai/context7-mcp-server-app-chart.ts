import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for Context-7 MCP Server
 */
export class Context7MCPServerAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // Context-7 MCP server deployment
    this.createApplication('context7-mcp-server', {
      resourcePath: 'context7-mcp-server',
      namespace: 'mcp-servers',
      project: 'ai-platform',
      syncWave: '75', // After other MCP servers
      labels: {
        'app.kubernetes.io/component': 'mcp-server',
        'app.kubernetes.io/part-of': 'mcp-servers',
        'app.kubernetes.io/name': 'context7-mcp'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true,
          allowEmpty: false
        },
        syncOptions: [
          'CreateNamespace=true',
          'ServerSideApply=true'
        ],
        retry: {
          limit: 5,
          backoff: {
            duration: '10s',
            factor: 2,
            maxDuration: '3m'
          }
        }
      }
    });
  }
}