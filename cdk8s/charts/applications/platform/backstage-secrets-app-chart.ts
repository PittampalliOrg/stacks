import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Backstage Secrets Application
 * Manages external secrets for Backstage authentication and integrations
 */
export class BackstageSecretsAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.createApplication('backstage-secrets', {
      resourcePath: 'backstage-secrets',
      namespace: 'backstage',
      project: 'platform',
      syncWave: '80', // Before Backstage deployment
      labels: {
        'app.kubernetes.io/component': 'secrets',
        'app.kubernetes.io/part-of': 'backstage'
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
      ignoreDifferences: [
        {
          group: 'external-secrets.io',
          kind: 'ExternalSecret',
          jsonPointers: [
            '/spec/dataFrom/0/extract/conversionStrategy',
            '/spec/dataFrom/0/extract/decodingStrategy',
            '/spec/dataFrom/0/extract/metadataPolicy',
            '/spec/target/deletionPolicy'
          ]
        }
      ]
    });
  }
}