import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for MCP Test Servers
 * Deploys test MCP servers including Everything and Time servers
 */
export class MCPTestServersAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // MCP Test Servers (everything-mcp, time-mcp)
    this.createApplication('mcp-test-servers', {
      resourcePath: 'mcp-test-servers',
      namespace: 'mcp-servers',
      project: 'ai-platform',
      syncWave: '86', // After mcp-servers (85)
      labels: {
        'app.kubernetes.io/component': 'mcp-test-servers',
        'app.kubernetes.io/part-of': 'mcp-tools',
        'app.kubernetes.io/name': 'mcp-test-servers'
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