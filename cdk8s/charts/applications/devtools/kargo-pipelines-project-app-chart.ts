import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { Application } from '../../../imports/argoproj.io';

/**
 * ArgoCD Application for Kargo Pipelines Project
 * This creates the central Kargo project that contains all pipelines
 */
export class KargoPipelinesProjectAppChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    new Application(this, 'kargo-pipelines-project-app', {
      metadata: {
        name: 'kargo-pipelines-project',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/name': 'kargo-pipelines-project',
          'app.kubernetes.io/part-of': 'kargo',
          'app.kubernetes.io/component': 'project',
          'argocd.argoproj.io/instance': 'kargo-pipelines-project'
        },
        finalizers: [
          'resources-finalizer.argocd.argoproj.io'
        ],
        annotations: {
          'argocd.argoproj.io/sync-wave': '24' // Before pipelines (25)
        }
      },
      spec: {
        project: 'platform',
        source: {
          repoUrl: 'https://github.com/PittampalliOrg/cdk8s-project.git',
          targetRevision: process.env.ENVIRONMENT || 'dev',
          path: 'dist',
          directory: {
            include: '[0-9][0-9][0-9][0-9]-kargo-pipelines-project.k8s.yaml'
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