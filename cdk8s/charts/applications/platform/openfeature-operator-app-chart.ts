import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as argo from '@opencdk8s/cdk8s-argocd-resources';
import { HelmOptions } from '@opencdk8s/cdk8s-argocd-resources';

/**
 * OpenFeature Operator Application Chart
 * Installs OpenFeature Operator which provides FeatureFlag CRDs
 */
export class OpenFeatureOperatorAppChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const helmOptions: HelmOptions = {
      releaseName: 'openfeature-operator',
      values: JSON.stringify({
        controllerManager: {
          manager: {
            image: {
              repository: 'ghcr.io/open-feature/open-feature-operator',
              tag: 'v0.8.0'
            }
          }
        }
      }, null, 2) as any  // Type assertion needed due to incorrect type definition
    };

    new argo.ArgoCdApplication(this, 'openfeature-operator', {
      metadata: {
        name: 'openfeature-operator',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-280'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'platform',
        source: {
          repoURL: 'https://open-feature.github.io/open-feature-operator',
          targetRevision: 'v0.8.0',
          chart: 'open-feature-operator',
          helm: helmOptions
        },
        destination: {
          name: 'in-cluster',
          namespace: 'open-feature-operator-system'
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
              duration: '5s',
              factor: 2,
              maxDuration: '3m'
            }
          }
        }
      }
    });
  }
}