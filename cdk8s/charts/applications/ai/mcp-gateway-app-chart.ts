import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for MCP (Model Context Protocol) gateway
 * This application manages the kgateway deployment for AI agent connectivity
 */
export class McpGatewayAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.createApplication('mcp-gateway', {
      resourcePath: 'kgateway-mcp-gateway', // MCP gateway deployment with ingress
      namespace: 'mcp-servers',
      project: 'ai-platform',
      syncWave: '85', // After AI platform core
      labels: {
        'app.kubernetes.io/component': 'mcp-gateway',
        'app.kubernetes.io/part-of': 'ai-infrastructure',
        'app.kubernetes.io/name': 'kgateway'
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
        group: 'apps',
        kind: 'Deployment',
        jsonPointers: [
          '/spec/replicas',
          '/spec/template/spec/containers/*/env/*/value', // Environment values might be injected
          '/spec/template/metadata/annotations/kubectl.kubernetes.io~1restartedAt'
        ]
      }, {
        group: '',
        kind: 'Service',
        jsonPointers: [
          '/spec/clusterIP',
          '/spec/clusterIPs',
          '/spec/sessionAffinity' // Session affinity might be managed externally
        ]
      }, {
        group: 'networking.k8s.io',
        kind: 'NetworkPolicy',
        jsonPointers: [
          '/metadata/annotations'
        ]
      }]
    });
  }
}