import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';
import { ApiObject } from 'cdk8s';

export class MCPRoutesAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // MCP Routes - HTTPRoute resources for routing to MCP servers
    this.createApplication('mcp-routes', {
      resourcePath: 'kgateway-mcp-routes',
      namespace: 'mcp-servers',
      project: 'ai-platform',
      syncWave: '82',
      repoURL: 'https://github.com/PittampalliOrg/cdk8s-project.git',
      targetRevision: process.env.ENVIRONMENT || 'dev',
      syncOptions: [
        'CreateNamespace=true',
        'ServerSideApply=true',
      ],
    });
  }
}