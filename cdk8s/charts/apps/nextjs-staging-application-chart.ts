import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { Application, ApplicationSpec } from '../../imports/argoproj.io';

/**
 * Creates ArgoCD Application for NextJS Staging environment
 * Points to pre-generated manifests in Gitea repository
 */
export class NextJsStagingApplicationChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    new Application(this, 'nextjs-staging', {
      metadata: {
        name: 'nextjs-staging',
        namespace: 'argocd',
        annotations: {
          'argocd.argoproj.io/sync-wave': '50',
          'kargo.akuity.io/authorized-stage': 'kargo-pipelines:nextjs-staging'
        },
        labels: {
          'app.kubernetes.io/name': 'nextjs',
          'app.kubernetes.io/instance': 'nextjs-staging',
          'app.kubernetes.io/component': 'frontend',
          'app.kubernetes.io/part-of': 'application-stack',
          'app.kubernetes.io/managed-by': 'cdk8s',
          'environment': 'staging'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        destination: {
          name: 'staging-vcluster',  // This will be registered by enrollment job
          namespace: 'nextjs'
        },
        source: {
          repoUrl: 'cnoe://nextjs-staging/manifests',
          targetRevision: 'HEAD',
          path: '.'
        },
        syncPolicy: {
          automated: {
            prune: true,
            selfHeal: true
          },
          syncOptions: [
            'CreateNamespace=true',
            'ServerSideApply=true',
            'ApplyOutOfSyncOnly=true'
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
            group: 'apps',
            kind: 'Deployment',
            jsonPointers: [
              '/spec/replicas',
              '/spec/template/metadata/annotations'
            ]
          },
          {
            kind: 'Service',
            jsonPointers: ['/spec/clusterIP']
          },
          {
            group: 'networking.k8s.io',
            kind: 'Ingress',
            jsonPointers: ['*']
          }
        ]
      } as ApplicationSpec
    });
  }
}