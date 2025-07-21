import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for platform secrets
 * This application manages all ExternalSecrets from all-secrets chart
 */
export class PlatformSecretsAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.createApplication('platform-secrets', {
      resourcePath: 'all-secrets', // Contains all ExternalSecrets
      namespace: 'nextjs', // The all-secrets file contains nextjs namespace resources
      project: 'platform',
      syncWave: '-50', // After namespaces but before apps that need secrets
      labels: {
        'app.kubernetes.io/component': 'secrets',
        'app.kubernetes.io/part-of': 'platform-foundation'
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
          limit: 10, // More retries for secrets that may need time
          backoff: {
            duration: '30s',
            factor: 2,
            maxDuration: '5m'
          }
        }
      },
      // Ignore secret data changes (managed by External Secrets Operator)
      ignoreDifferences: [{
        group: '',
        kind: 'Secret',
        jsonPointers: [
          '/data',
          '/metadata/annotations/kubectl.kubernetes.io~1last-applied-configuration'
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
  }
}