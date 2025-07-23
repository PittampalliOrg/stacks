import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { Application } from '../../../imports/argoproj.io';

/**
 * ArgoCD Application for Kargo Backstage Pipeline
 */
export class KargoBackstagePipelineAppChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    new Application(this, 'kargo-backstage-pipeline-app', {
      metadata: {
        name: 'kargo-backstage-pipeline',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/name': 'kargo-backstage-pipeline',
          'app.kubernetes.io/part-of': 'kargo-pipelines',
          'app.kubernetes.io/component': 'pipeline',
          'argocd.argoproj.io/instance': 'kargo-backstage-pipeline'
        },
        finalizers: [
          'resources-finalizer.argocd.argoproj.io'
        ],
        annotations: {
          'argocd.argoproj.io/sync-wave': '25',
          'argocd.argoproj.io/sync-options': 'CreateNamespace=true'
        }
      },
      spec: {
        project: 'default',
        source: {
          repoUrl: 'https://github.com/PittampalliOrg/cdk8s-project.git',
          targetRevision: process.env.ENVIRONMENT || 'dev',
          path: 'dist',
          directory: {
            include: '[0-9][0-9][0-9][0-9]-kargo-backstage-pipeline.k8s.yaml'
          }
        },
        destination: {
          server: 'https://kubernetes.default.svc',
          namespace: 'gitops-pipelines'
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
            'ApplyOutOfSyncOnly=true'
          ],
          retry: {
            limit: 5,
            backoff: {
              duration: '5s',
              factor: 2,
              maxDuration: '5m'
            }
          }
        },
        revisionHistoryLimit: 10
      }
    });
  }
}