import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { Application } from '../../../imports/argoproj.io';

/**
 * ArgoCD Application for Kargo Pipelines Credentials
 * This creates image registry credentials for Kargo warehouses
 */
export class KargoPipelinesCredentialsAppChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    new Application(this, 'kargo-pipelines-credentials-app', {
      metadata: {
        name: 'kargo-pipelines-credentials',
        namespace: 'argocd',
        finalizers: ['resources-finalizer.argocd.argoproj.io'],
        labels: {
          'app.kubernetes.io/name': 'kargo-pipelines-credentials',
          'app.kubernetes.io/part-of': 'gitops-pipelines',
          'app.kubernetes.io/component': 'credentials'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-15' // Deploy before pipelines
        }
      },
      spec: {
        project: 'default',
        source: {
          repoUrl: 'https://github.com/PittampalliOrg/cdk8s-project.git',
          targetRevision: process.env.ENVIRONMENT || 'dev',
          path: 'dist',
          directory: {
            include: '[0-9][0-9][0-9][0-9]-kargo-pipelines-credentials.k8s.yaml'
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
          retry: {
            limit: 10,
            backoff: {
              duration: '5s',
              factor: 2,
              maxDuration: '5m'
            }
          },
          syncOptions: [
            'CreateNamespace=false', // Namespace created by project
            'ServerSideApply=true',
            'RespectIgnoreDifferences=true',
            'ApplyOutOfSyncOnly=true',
            'PrunePropagationPolicy=background',
            'PruneLast=true'
          ]
        },
        ignoreDifferences: [
          {
            group: 'generators.external-secrets.io',
            kind: 'ACRAccessToken',
            jsonPointers: [
              '/status'
            ]
          }
        ]
      }
    });
  }
}