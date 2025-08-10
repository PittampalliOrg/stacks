import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import {
  ApplicationSet,
  ApplicationSetSpec,
  ApplicationSpecSyncPolicy,
} from '../../imports/argoproj.io';

/**
 * Creates ApplicationSet for registering vclusters with ArgoCD
 * This ApplicationSet will generate Applications that patch the base resources
 */
export class VclusterRegistrationAppSetChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const envs = ['staging', 'production'];

    const templateSpec: any = {
      project: 'default',
      destination: {
        server: 'https://kubernetes.default.svc',
        namespace: 'argocd',
      },
      syncPolicy: ((): ApplicationSpecSyncPolicy => ({
        automated: { prune: true, selfHeal: true },
        syncOptions: ['CreateNamespace=true', 'ServerSideApply=true']
      }))(),
    };

    const appsetSpec: ApplicationSetSpec = {
      goTemplate: true,
      goTemplateOptions: ['missingkey=error'],
      generators: [
        { list: { elements: envs.map((e) => ({ name: e })) } },
      ],
      template: {
        metadata: {
          name: '{{.name}}-vcluster-registration',
          namespace: 'argocd',
          annotations: { 'argocd.argoproj.io/sync-wave': '20' },
          labels: {
            'app.kubernetes.io/managed-by': 'cdk8s',
            'cnoe.io/stackName': 'vcluster-registration',
          },
          finalizers: ['resources-finalizer.argocd.argoproj.io'],
        },
        spec: {
          ...templateSpec,
          source: {
            repoUrl: 'https://gitea.cnoe.localtest.me:8443/giteaAdmin/idpbuilder-localdev-vcluster-registration-resources-manifests.git',
            targetRevision: 'HEAD',
            path: '.',
            kustomize: {
              patches: [
                {
                  patch: `[
  {"op": "replace", "path": "/metadata/name", "value": "kubernetes-{{.name}}-vcluster"},
  {"op": "replace", "path": "/spec/provider/kubernetes/remoteNamespace", "value": "{{.name}}-vcluster"}
]`,
                  target: {
                    kind: 'ClusterSecretStore',
                    name: 'unpatched-kubernetes-vcluster',
                  },
                },
                {
                  patch: `[
  {"op": "replace", "path": "/metadata/name", "value": "{{.name}}-vcluster-secret"},
  {"op": "replace", "path": "/spec/secretStoreRef/name", "value": "kubernetes-{{.name}}-vcluster"},
  {"op": "replace", "path": "/spec/target/name", "value": "{{.name}}-vcluster-secret"},
  {"op": "replace", "path": "/spec/target/template/data/name", "value": "{{.name}}-vcluster"},
  {"op": "replace", "path": "/spec/target/template/data/server", "value": "https://{{.name}}-vcluster-helm.{{.name}}-vcluster.svc:443"},
  {"op": "replace", "path": "/spec/data/0/remoteRef/key", "value": "vc-{{.name}}-vcluster-helm"},
  {"op": "replace", "path": "/spec/data/1/remoteRef/key", "value": "vc-{{.name}}-vcluster-helm"},
  {"op": "replace", "path": "/spec/data/2/remoteRef/key", "value": "vc-{{.name}}-vcluster-helm"}
]`,
                  target: {
                    kind: 'ExternalSecret',
                    name: 'unpatched-vcluster-secret',
                  },
                },
              ],
            },
          },
        },
      },
    } as any;

    new ApplicationSet(this, 'vclusters-registration-appset', {
      metadata: { name: 'vclusters-registration', namespace: 'argocd' },
      spec: appsetSpec,
    });
  }
}