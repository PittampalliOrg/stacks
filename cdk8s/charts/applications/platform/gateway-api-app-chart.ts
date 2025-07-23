import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as argo from '@opencdk8s/cdk8s-argocd-resources';

/**
 * Gateway API Application Chart
 * Installs Gateway API CRDs (Gateway, HTTPRoute, etc.)
 */
export class GatewayApiAppChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    new argo.ArgoCdApplication(this, 'gateway-api', {
      metadata: {
        name: 'gateway-api',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-285'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
          repoURL: 'https://github.com/kubernetes-sigs/gateway-api',
          targetRevision: 'v1.2.1',
          path: 'config/crd/standard'
        },
        destination: {
          name: 'in-cluster'
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
            'Replace=true'
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