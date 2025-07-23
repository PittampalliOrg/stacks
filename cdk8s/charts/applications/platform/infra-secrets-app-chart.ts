import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for infrastructure secrets
 * This application manages all External Secrets for infrastructure components
 */
export class InfraSecretsAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // NextJS infrastructure secrets (ACR credentials)
    this.createApplication('infra-secrets', {
      resourcePath: 'infra-secrets', // ACR credentials for NextJS
      namespace: 'nextjs',
      project: 'default',
      syncWave: '15', // After platform secrets but before most services
      labels: {
        'app.kubernetes.io/component': 'secrets',
        'app.kubernetes.io/part-of': 'infrastructure',
        'external-secrets.io/managed': 'true'
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
        group: 'external-secrets.io',
        kind: 'ExternalSecret',
        jsonPointers: [
          '/status',
          '/metadata/annotations/argocd.argoproj.io~1tracking-id', // ArgoCD tracking annotation
          '/spec/refreshInterval', // Refresh interval might be adjusted
          '/spec/data/[*]/remoteRef/conversionStrategy', // CRD default value
          '/spec/data/[*]/remoteRef/decodingStrategy', // CRD default value
          '/spec/data/[*]/remoteRef/metadataPolicy' // CRD default value
        ]
      }, {
        group: 'external-secrets.io',
        kind: 'SecretStore',
        jsonPointers: [
          '/status',
          '/metadata/annotations'
        ]
      }, {
        group: '',
        kind: 'Secret',
        jsonPointers: [
          '/metadata/annotations',
          '/metadata/labels/controller.external-secrets.io~1version',
          '/data' // Secret data is dynamic
        ]
      }, {
        group: 'generators.external-secrets.io',
        kind: 'ACRAccessToken',
        jsonPointers: [
          '/status',
          '/metadata/annotations'
        ]
      }, {
        group: '',
        kind: 'ServiceAccount',
        jsonPointers: [
          '/metadata/annotations/kubectl.kubernetes.io~1last-applied-configuration'
        ]
      }]
    });
    
    // Crossplane provider secrets
    // REMOVED: No crossplane-specific secrets in infra-secrets.k8s.yaml
    /*
    this.createApplication('crossplane-secrets', {
      resourcePath: 'infra-secrets', // Crossplane provider configs
      namespace: 'crossplane-system',
      project: 'default',
      syncWave: '18', // After infra-secrets
      labels: {
        'app.kubernetes.io/component': 'provider-secrets',
        'app.kubernetes.io/part-of': 'crossplane',
        'crossplane.io/managed': 'true'
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
          'SkipDryRunOnMissingResource=true' // Crossplane CRDs might not be ready
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
        group: 'pkg.crossplane.io',
        kind: 'ProviderConfig',
        jsonPointers: [
          '/status',
          '/spec/credentials/secretRef/key' // Secret key references might change
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
    */
  }
}