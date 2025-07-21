import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for MCP Inspector
 * This application manages the MCP Inspector UI for debugging Model Context Protocol servers
 */
export class McpInspectorAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.createApplication('mcp-inspector', {
      resourcePath: 'mcp-inspector', // MCP Inspector deployment with ingress
      namespace: 'mcp-tools',
      project: 'ai-platform',
      syncWave: '90', // After MCP gateway
      labels: {
        'app.kubernetes.io/component': 'debugging-tool',
        'app.kubernetes.io/part-of': 'mcp-infrastructure',
        'app.kubernetes.io/name': 'mcp-inspector'
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