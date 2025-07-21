import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for Kagent AI platform core components
 * This application manages the Kagent deployment, agents, and toolservers
 */
export class KagentCoreAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // Kagent core deployment
    this.createApplication('kagent-core', {
      resourcePath: 'kagent-core', // Kagent namespace and secrets
      namespace: 'kagent',
      project: 'ai-platform',
      syncWave: '70', // After platform services
      labels: {
        'app.kubernetes.io/component': 'ai-agents',
        'app.kubernetes.io/part-of': 'kagent-platform',
        'app.kubernetes.io/name': 'kagent'
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
          'RespectIgnoreDifferences=true',
          'SkipDryRunOnMissingResource=true' // Kagent CRDs might not be ready
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
          '/spec/template/spec/containers/*/resources', // Resource limits might be adjusted
          '/spec/template/metadata/annotations' // Deployment annotations
        ]
      }, {
        group: 'kagent.ai',
        kind: 'Agent',
        jsonPointers: [
          '/status',
          '/spec/model/parameters' // Model parameters might be tuned
        ]
      }, {
        group: 'kagent.ai',
        kind: 'ToolServer',
        jsonPointers: [
          '/status',
          '/spec/replicas' // ToolServer replicas might scale
        ]
      }, {
        group: 'external-secrets.io',
        kind: 'ExternalSecret',
        jsonPointers: [
          '/status',
          '/metadata/annotations/argocd.argoproj.io~1tracking-id', // ArgoCD tracking annotation
          '/spec/data/[*]/remoteRef/conversionStrategy', // CRD default value
          '/spec/data/[*]/remoteRef/decodingStrategy', // CRD default value
          '/spec/data/[*]/remoteRef/metadataPolicy' // CRD default value
        ]
      }]
    });
    
    // Kagent ingress and resources
    this.createApplication('kagent-ingress', {
      resourcePath: 'kagent-ingress', // Contains ingress
      namespace: 'kagent',
      project: 'ai-platform',
      syncWave: '75', // After Kagent core
      labels: {
        'app.kubernetes.io/component': 'ingress',
        'app.kubernetes.io/part-of': 'kagent-platform'
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