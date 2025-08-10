import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import {
  ApplicationSet,
  ApplicationSetSpec,
  ApplicationSpecSyncPolicy,
} from '../../imports/argoproj.io';

/**
 * Creates ApplicationSet for deploying Backstage to multiple vclusters
 * Each environment gets its own pre-generated manifests with appropriate images
 */
export class BackstageMultiEnvApplicationSetChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const envs = ['dev', 'staging'];

    const appsetSpec: ApplicationSetSpec = {
      goTemplate: true,
      goTemplateOptions: ['missingkey=error'],
      generators: [
        { list: { elements: envs.map((e) => ({ name: e })) } },
      ],
      template: {
        metadata: {
          name: 'backstage-{{.name}}',
          namespace: 'argocd',
          annotations: { 
            'argocd.argoproj.io/sync-wave': '20',
            'kargo.akuity.io/authorized-stage': 'kargo-pipelines:backstage-{{.name}}'
          },
          labels: {
            'app.kubernetes.io/managed-by': 'cdk8s',
            'app.kubernetes.io/name': 'backstage',
            'app.kubernetes.io/instance': 'backstage-{{.name}}',
            'app.kubernetes.io/component': 'developer-portal',
            'app.kubernetes.io/part-of': 'platform',
            'environment': '{{.name}}',
          },
          finalizers: ['resources-finalizer.argocd.argoproj.io'],
        },
        spec: {
          project: 'default',
          destination: {
            name: '{{.name}}-vcluster',  // This will match the cluster names registered by the job
            namespace: 'backstage',
          },
          syncPolicy: {
            automated: { prune: true, selfHeal: true },
            syncOptions: [
              'CreateNamespace=true', 
              'ServerSideApply=true',
              'SkipDryRunOnMissingResource=true'
            ],
            retry: {
              limit: 5,
              backoff: {
                duration: '10s',
                factor: 2,
                maxDuration: '5m'
              }
            }
          } as ApplicationSpecSyncPolicy,
          source: {
            // Each environment has its own dedicated manifests repository
            repoUrl: 'https://gitea.cnoe.localtest.me:8443/giteaAdmin/idpbuilder-localdev-backstage-{{.name}}-manifests.git',
            targetRevision: 'HEAD',
            path: '.',
          },
          // Ignore certain differences that are expected between environments
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
              group: 'apps',
              kind: 'StatefulSet',
              jsonPointers: [
                '/spec/replicas',
                '/spec/volumeClaimTemplates'
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
        },
      },
    } as any;

    new ApplicationSet(this, 'backstage-multi-env-appset', {
      metadata: { 
        name: 'backstage-multi-env', 
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'app.kubernetes.io/name': 'backstage-multi-env',
        }
      },
      spec: appsetSpec,
    });
  }
}