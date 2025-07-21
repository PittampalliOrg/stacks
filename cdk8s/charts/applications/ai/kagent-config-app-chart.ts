import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for Kagent AI platform configuration
 * This application manages ModelConfig resources and ai-related secrets
 */
export class KagentConfigAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // Kagent ModelConfig resources
    this.createApplication('kagent-modelconfig', {
      resourcePath: 'kagent-models', // ModelConfig for AI models
      namespace: 'kagent',
      project: 'ai-platform',
      syncWave: '80', // After Kagent core deployment
      labels: {
        'app.kubernetes.io/component': 'model-config',
        'app.kubernetes.io/part-of': 'kagent-platform',
        'kagent.ai/config-type': 'models'
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
          'SkipDryRunOnMissingResource=true' // ModelConfig CRD might not be ready
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
        group: 'kagent.ai',
        kind: 'ModelConfig',
        jsonPointers: [
          '/status',
          '/spec/parameters/temperature', // Model parameters might be tuned
          '/spec/parameters/max_tokens',
          '/spec/parameters/top_p',
          '/metadata/annotations'
        ]
      }]
    });
    
    // REMOVED: ai-secrets application - these resources are already managed by kagent-core application
    // The kagent-core application manages the namespace and ExternalSecrets for AI providers
  }
}