import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for application stack secrets
 * This manages ExternalSecrets for NextJS, Redis, and Postgres
 */
export class AppStackSecretsAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.createApplication('app-stack-secrets', {
      resourcePath: 'app-stack-secrets',
      namespace: 'nextjs', // Deploy secrets to the application namespace
      project: 'platform', // Platform project allows ExternalSecret resources
      syncWave: '-30', // Deploy early, before applications
      labels: {
        'app.kubernetes.io/component': 'secrets',
        'app.kubernetes.io/part-of': 'application-stack',
        'app.kubernetes.io/name': 'app-stack-secrets'
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
      },
      ignoreDifferences: [{
        group: 'external-secrets.io',
        kind: 'ExternalSecret',
        jsonPointers: [
          '/status',
          '/metadata/annotations/argocd.argoproj.io~1tracking-id', // ArgoCD tracking annotation
          '/spec/data/[*]/remoteRef/conversionStrategy', // CRD default value
          '/spec/data/[*]/remoteRef/decodingStrategy', // CRD default value
          '/spec/data/[*]/remoteRef/metadataPolicy' // CRD default value
        ]
      }, {
        group: '',
        kind: 'Secret',
        jsonPointers: [
          '/data',
          '/metadata/annotations',
          '/metadata/labels/controller.external-secrets.io~1version'
        ]
      }]
    });
  }
}