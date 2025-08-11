import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { Application, ApplicationSpec } from '../../imports/argoproj.io';

/**
 * Direct ArgoCD Application for staging vcluster
 * Uses Helm chart directly from loft.sh repository
 */
export class VclusterStagingChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const helmValues = {
      sync: {
        fromHost: {
          nodes: { enabled: true },
          // Enable ingress class syncing to use host cluster's nginx ingress controller
          ingressClasses: { enabled: true },
          // Sync secrets from host namespaces to virtual cluster
          secrets: {
            enabled: true,
            mappings: {
              byName: {
                // Sync all secrets from nextjs namespace
                'nextjs/*': 'nextjs/*',
                // Sync all secrets from backstage namespace
                'backstage/*': 'backstage/*',
              },
            },
          },
        },
        toHost: {
          // Sync service accounts to host for Azure Workload Identity
          serviceAccounts: { enabled: true },
          // Disable ingress syncing - we manage the API ingress separately
          ingresses: { enabled: false },
        },
      },
      controlPlane: {
        advanced: { virtualScheduler: { enabled: true } },
        proxy: {
          extraSANs: [
            'vcluster-staging-helm.staging-vcluster.svc',
            'staging-vcluster.cnoe.localtest.me',
          ],
        },
        statefulSet: { scheduling: { podManagementPolicy: 'OrderedReady' } },
      },
      exportKubeConfig: {
        server: 'https://vcluster-staging-helm.staging-vcluster.svc:443',
      },
    };

    new Application(this, 'vcluster-staging-helm', {
      metadata: {
        name: 'vcluster-staging-helm',
        namespace: 'argocd',
        annotations: {
          'argocd.argoproj.io/sync-wave': '10',
        },
        labels: {
          'app.kubernetes.io/name': 'vcluster-staging',
          'app.kubernetes.io/component': 'vcluster',
          'app.kubernetes.io/instance': 'staging',
          'app.kubernetes.io/part-of': 'platform',
        },
      },
      spec: {
        project: 'default',
        source: {
          repoUrl: 'https://charts.loft.sh',
          chart: 'vcluster',
          targetRevision: '0.26.0',
          helm: {
            valuesObject: helmValues,
          },
        },
        destination: {
          server: 'https://kubernetes.default.svc',
          namespace: 'staging-vcluster',
        },
        syncPolicy: {
          automated: {
            prune: true,
            selfHeal: true,
          },
          syncOptions: ['CreateNamespace=true'],
        },
      } as ApplicationSpec,
    });
  }
}