import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for bootstrap secrets
 * This manages GitHub repository credentials and the Azure KeyVault ClusterSecretStore
 */
export class BootstrapSecretsAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.createApplication('bootstrap-secrets', {
      resourcePath: 'bootstrap-secrets',
      namespace: 'argocd', // GitHub creds go in argocd namespace
      project: 'platform',
      syncWave: '-92', // After ArgoCD config but before other secrets
      labels: {
        'app.kubernetes.io/component': 'bootstrap-secrets',
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
          limit: 10,
          backoff: {
            duration: '30s',
            factor: 2,
            maxDuration: '5m'
          }
        }
      },
      // Ignore changes to generated secrets
      ignoreDifferences: [{
        group: '',
        kind: 'Secret',
        jsonPointers: [
          '/data',
          '/metadata/annotations/kubectl.kubernetes.io~1last-applied-configuration'
        ]
      }, {
        group: 'external-secrets.io',
        kind: 'ClusterSecretStore',
        jsonPointers: [
          '/status'
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