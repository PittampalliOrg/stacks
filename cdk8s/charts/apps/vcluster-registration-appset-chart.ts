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
            repoUrl: 'cnoe://vcluster-registration-resources/manifests',
            targetRevision: 'HEAD',
            path: '.',
            kustomize: {
              patches: [
                {
                  target: { kind: 'ClusterSecretStore', name: 'unpatched-kubernetes-vcluster' },
                  patch: `- op: replace\n  path: /metadata/name\n  value: kubernetes-{{.name}}-vcluster\n- op: replace\n  path: /spec/provider/kubernetes/remoteNamespace\n  value: {{.name}}-vcluster`,
                },
                {
                  target: { kind: 'ExternalSecret', name: 'unpatched-vcluster-secret' },
                  patch: `- op: replace\n  path: /metadata/name\n  value: {{.name}}-vcluster-secret\n- op: replace\n  path: /spec/secretStoreRef/name\n  value: kubernetes-{{.name}}-vcluster\n- op: replace\n  path: /spec/target/name\n  value: {{.name}}-vcluster-secret\n- op: replace\n  path: /spec/target/template/data/name\n  value: {{.name}}-vcluster\n- op: replace\n  path: /spec/target/template/data/server\n  value: https://{{.name}}-vcluster-helm.{{.name}}-vcluster.svc:443\n- op: replace\n  path: /spec/data/0/remoteRef/key\n  value: vc-{{.name}}-vcluster-helm\n- op: replace\n  path: /spec/data/1/remoteRef/key\n  value: vc-{{.name}}-vcluster-helm\n- op: replace\n  path: /spec/data/2/remoteRef/key\n  value: vc-{{.name}}-vcluster-helm`,
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