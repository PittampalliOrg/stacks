import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import {
  ApplicationSet,
  ApplicationSetSpec,
  ApplicationSpecSyncPolicy,
} from '../../imports/argoproj.io';
import { ClusterSecretStore, ExternalSecret, ExternalSecretSpecSecretStoreRefKind, ClusterSecretStoreSpecProviderKubernetesServerCaProviderType } from '../../imports/external-secrets.io';

/**
 * Creates base resources and ApplicationSet for registering vclusters with ArgoCD
 */
export class VclusterRegistrationApplicationSetChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    // Create base ClusterSecretStore that will be patched by ApplicationSet
    new ClusterSecretStore(this, 'base-cluster-secret-store', {
      metadata: {
        name: 'unpatched-kubernetes-vcluster',
        annotations: {
          'argocd.argoproj.io/sync-wave': '15', // Before ExternalSecret
        },
      },
      spec: {
        provider: {
          kubernetes: {
            remoteNamespace: 'unpatched-namespace', // Will be patched to actual namespace
            auth: {
              serviceAccount: {
                name: 'external-secrets',
                namespace: 'external-secrets',
              },
            },
            server: {
              url: 'https://kubernetes.default.svc',
              caProvider: {
                type: ClusterSecretStoreSpecProviderKubernetesServerCaProviderType.CONFIG_MAP,
                name: 'kube-root-ca.crt',
                namespace: 'external-secrets',
                key: 'ca.crt',
              },
            },
          },
        },
      },
    });

    // Create base ExternalSecret that will be patched by ApplicationSet
    new ExternalSecret(this, 'base-external-secret', {
      metadata: {
        name: 'unpatched-vcluster-secret',
        namespace: 'argocd',
        annotations: {
          'argocd.argoproj.io/sync-wave': '20', // After ClusterSecretStore
        },
      },
      spec: {
        secretStoreRef: {
          name: 'unpatched-kubernetes-vcluster', // Will be patched
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'unpatched-vcluster-secret', // Will be patched
          template: {
            metadata: {
              labels: {
                'argocd.argoproj.io/secret-type': 'cluster',
              },
            },
            data: {
              name: 'unpatched-name', // Will be patched to actual vcluster name
              server: 'unpatched-server', // Will be patched to actual server URL
              config: '{"tlsClientConfig":{"caData":"{{ .ca | b64enc }}","certData":"{{ .cert | b64enc }}","keyData":"{{ .key | b64enc }}"}}',
            },
          },
        },
        data: [
          {
            secretKey: 'ca',
            remoteRef: {
              key: 'unpatched-key', // Will be patched to actual secret name
              property: 'certificate-authority',
            },
          },
          {
            secretKey: 'cert',
            remoteRef: {
              key: 'unpatched-key', // Will be patched to actual secret name
              property: 'client-certificate',
            },
          },
          {
            secretKey: 'key',
            remoteRef: {
              key: 'unpatched-key', // Will be patched to actual secret name
              property: 'client-key',
            },
          },
        ],
      },
    });

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
            repoUrl: 'cnoe://vcluster-registration/manifests',
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
