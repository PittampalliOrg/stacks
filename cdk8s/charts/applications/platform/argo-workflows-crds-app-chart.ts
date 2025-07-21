import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as argo from '@opencdk8s/cdk8s-argocd-resources';
import { HelmOptions } from '@opencdk8s/cdk8s-argocd-resources';

/**
 * Argo Workflows CRDs Application Chart
 * Installs Argo Workflows which provides WorkflowTemplate and ClusterWorkflowTemplate CRDs
 */
export class ArgoWorkflowsCrdsAppChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const helmOptions: HelmOptions = {
      releaseName: 'argo-workflows',
      values: JSON.stringify({
        namespace: 'argo',
        createNamespace: true,
        singleNamespace: false,
        workflow: {
          serviceAccount: {
            create: true,
            name: 'argo-workflow'
          }
        },
        controller: {
          workflowNamespaces: ['argo'],
          containerRuntimeExecutor: 'k8sapi',
          resourceRateLimit: {
            limit: 10,
            burst: 1
          }
        },
        server: {
          enabled: true,
          authMode: 'server',
          extraArgs: [
            '--auth-mode=server',
            '--x-frame-options='
          ],
          service: {
            type: 'ClusterIP',
            port: 2746
          }
        }
      }, null, 2) as any  // Type assertion needed due to incorrect type definition
    };

    new argo.ArgoCdApplication(this, 'argo-workflows-crds', {
      metadata: {
        name: 'argo-workflows-crds',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-290'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'platform',
        source: {
          repoURL: 'https://argoproj.github.io/argo-helm',
          targetRevision: '0.41.1',
          chart: 'argo-workflows',
          helm: helmOptions
        },
        destination: {
          name: 'in-cluster',
          namespace: 'argo'
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