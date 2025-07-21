import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as argo from '@opencdk8s/cdk8s-argocd-resources';
import { HelmOptions } from '@opencdk8s/cdk8s-argocd-resources';

/**
 * Cert Manager Application Chart
 * Installs cert-manager which provides Certificate CRDs required by Kargo and other components
 */
export class CertManagerAppChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const helmOptions: HelmOptions = {
      releaseName: 'cert-manager',
      values: JSON.stringify({
        installCRDs: true,
        namespace: 'cert-manager',
        global: {
          leaderElection: {
            namespace: 'cert-manager'
          }
        }
      }, null, 2) as any  // Type assertion needed due to incorrect type definition
    };

    new argo.ArgoCdApplication(this, 'cert-manager', {
      metadata: {
        name: 'cert-manager',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-295'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'platform',
        source: {
          repoURL: 'https://charts.jetstack.io',
          targetRevision: 'v1.15.1',
          chart: 'cert-manager',
          helm: helmOptions
        },
        destination: {
          name: 'in-cluster',
          namespace: 'cert-manager'
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
              duration: '5s',
              factor: 2,
              maxDuration: '3m'
            }
          }
        },
        ignoreDifferences: [
          {
            group: 'admissionregistration.k8s.io',
            kind: 'ValidatingWebhookConfiguration',
            jsonPointers: [
              '/webhooks/0/clientConfig/caBundle',
              '/webhooks/1/clientConfig/caBundle',
              '/webhooks/2/clientConfig/caBundle',
              '/webhooks/3/clientConfig/caBundle'
            ]
          },
          {
            group: 'admissionregistration.k8s.io',
            kind: 'MutatingWebhookConfiguration',
            jsonPointers: [
              '/webhooks/0/clientConfig/caBundle'
            ]
          }
        ]
      }
    });
  }
}