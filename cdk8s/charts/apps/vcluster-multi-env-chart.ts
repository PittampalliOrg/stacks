import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { KubeIngress } from '../../imports/k8s';
import {
  Application,
  ApplicationSet,
  ApplicationSpec,
  ApplicationSpecDestination,
  ApplicationSpecSource,
  ApplicationSpecSourceHelm,
  ApplicationSpecSourceKustomize,
  ApplicationSetSpec,
} from '../../imports/argoproj.io';

/**
 * Base resources used by the vcluster ApplicationSet template.
 * Generates an Ingress and an ArgoCD Application that are later patched per env.
 * These are written into the package manifests folder and consumed via cnoe:// by idpbuilder.
 */
export class VclusterMultiEnvChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    // Labels to target with kustomize patches from the ApplicationSet
    const baseLabels = {
      'cnoe.io/stackName': 'vcluster-multi-env',
    };

    // Ingress exposing the vcluster endpoint via SSL passthrough (nginx)
    new KubeIngress(this, 'vcluster-ingress', {
      metadata: {
        name: 'vcluster-ingress',
        labels: baseLabels,
        annotations: {
          'nginx.ingress.kubernetes.io/backend-protocol': 'HTTPS',
          'nginx.ingress.kubernetes.io/ssl-passthrough': 'true',
          'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [
          {
            host: 'unpatched-vcluster-hostname.cnoe.localtest.me',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'ImplementationSpecific',
                  backend: {
                    service: {
                      name: 'unpatched-vcluster-services',
                      port: { number: 443 },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    });

    // ArgoCD Application that installs the vcluster Helm chart in the target namespace
    const helmValues: NonNullable<ApplicationSpecSourceHelm>['valuesObject'] = {
      sync: {
        fromHost: { nodes: { enabled: true } },
      },
      controlPlane: {
        advanced: { virtualScheduler: { enabled: true } },
        proxy: { extraSANs: ['unpatched-vcluster-hostname.cnoe.localtest.me'] },
        statefulSet: { scheduling: { podManagementPolicy: 'OrderedReady' } },
      },
      exportKubeConfig: {
        server: 'https://unpatched-vcluster-hostname.cnoe.localtest.me:443',
      },
      // Enable generic sync so ExternalSecret objects created in the vcluster are
      // exported to the host cluster, and resulting Secrets are imported back.
      experimental: {
        multiNamespaceMode: { enabled: true },
        genericSync: {
          clusterRole: {
            extraRules: [
              {
                apiGroups: ['apiextensions.k8s.io'],
                resources: ['customresourcedefinitions'],
                verbs: ['get', 'list', 'watch'],
              },
            ],
          },
          role: {
            extraRules: [
              {
                apiGroups: ['external-secrets.io'],
                resources: ['externalsecrets'],
                verbs: ['create', 'delete', 'patch', 'update', 'get', 'list', 'watch'],
              },
            ],
          },
          export: [
            { apiVersion: 'external-secrets.io/v1', kind: 'ExternalSecret' },
          ],
          import: [
            { apiVersion: 'v1', kind: 'Secret' },
          ],
          version: 'v1',
        },
      },
    } as any;

    new Application(this, 'vcluster-helm-app', {
      metadata: {
        name: 'unpatched-vcluster',
        namespace: 'argocd',
        labels: {
          ...baseLabels,
          'cnoe.io/applicationName': 'vcluster-helm',
        },
      },
      spec: {
        project: 'default',
        source: {
          repoUrl: 'https://charts.loft.sh',
          chart: 'vcluster',
          targetRevision: '0.20.0',
          helm: {
            valuesObject: helmValues,
          },
        } as ApplicationSpecSource,
        destination: {
          server: 'https://kubernetes.default.svc',
          namespace: 'unpatched-vcluster',
        } as ApplicationSpecDestination,
        syncPolicy: {
          automated: {},
          syncOptions: ['CreateNamespace=true'],
        },
      } as ApplicationSpec,
    });
  }
}

/**
 * ApplicationSet that patches the base resources for each environment
 * and deploys the vclusters (staging, production) into the host cluster.
 */
export class VclusterMultiEnvApplicationSetChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const kustomizePatches: NonNullable<ApplicationSpecSourceKustomize['patches']> = [
      {
        target: { kind: 'Ingress', labelSelector: 'cnoe.io/stackName=vcluster-multi-env' },
        patch: `- op: replace\n  path: /spec/rules/0/host\n  value: {{.name}}-vcluster.cnoe.localtest.me`,
      },
      {
        target: { kind: 'Application', labelSelector: 'cnoe.io/stackName=vcluster-multi-env' },
        patch: `- op: add\n  path: /spec/source/helm/valuesObject/controlPlane/proxy/extraSANs/1\n  value: {{.name}}-vcluster.cnoe.localtest.me`,
      },
      {
        target: { kind: 'Ingress', labelSelector: 'cnoe.io/stackName=vcluster-multi-env' },
        patch: `- op: replace\n  path: /spec/rules/0/http/paths/0/backend/service/name\n  value: {{.name}}-vcluster-helm`,
      },
      {
        target: { kind: 'Application', labelSelector: 'cnoe.io/stackName=vcluster-multi-env' },
        patch: `- op: replace\n  path: /metadata/name\n  value: {{.name}}-vcluster-helm`,
      },
      {
        target: { kind: 'Application', labelSelector: 'cnoe.io/stackName=vcluster-multi-env' },
        patch: `- op: replace\n  path: /spec/source/helm/valuesObject/controlPlane/proxy/extraSANs/0
  value: {{.name}}-vcluster-helm.{{.name}}-vcluster.svc`,
      },
      {
        target: { kind: 'Application', labelSelector: 'cnoe.io/stackName=vcluster-multi-env' },
        patch: `- op: add\n  path: /spec/source/helm/valuesObject/controlPlane/proxy/extraSANs/1\n  value: {{.name}}-vcluster.cnoe.localtest.me`,
      },
      {
        target: { kind: 'Application', labelSelector: 'cnoe.io/stackName=vcluster-multi-env' },
        patch: `- op: replace\n  path: /spec/source/helm/valuesObject/exportKubeConfig/server
  value: https://{{.name}}-vcluster-helm.{{.name}}-vcluster.svc:443`,
      },
      {
        target: { kind: 'Application', labelSelector: 'cnoe.io/stackName=vcluster-multi-env' },
        patch: `- op: replace\n  path: /spec/destination/namespace\n  value: {{.name}}-vcluster\n- op: add\n  path: /metadata/annotations\n  value: {"argocd.argoproj.io/sync-wave":"10"}`,
      },
      // No ExternalSecret/ClusterSecretStore patches

    ];

    const appsetSpec: ApplicationSetSpec = {
      goTemplate: true,
      goTemplateOptions: ['missingkey=error'],
      generators: [
        {
          list: {
            elements: [{ name: 'staging' }, { name: 'production' }],
          },
        },
      ],
      template: {
        metadata: {
          name: '{{.name}}-vcluster',
          labels: {
            'cnoe.io/stackName': 'vcluster-multi-env',
            'cnoe.io/applicationName': 'vcluster-package',
          },
          finalizers: ['resources-finalizer.argocd.argoproj.io'],
        },
        spec: {
          project: 'default',
          source: {
            // Use cnoe://<package>/manifests so idpbuilder maps correctly to the package directory
            repoUrl: 'cnoe://vcluster-multi-env/manifests',
            targetRevision: 'HEAD',
            path: '.',
            kustomize: { patches: kustomizePatches },
          },
          destination: {
            server: 'https://kubernetes.default.svc',
            namespace: '{{.name}}-vcluster',
          },
          syncPolicy: {
            automated: {},
            syncOptions: ['CreateNamespace=true'],
          },
        },
      },
    } as any;

    new ApplicationSet(this, 'vclusters-appset', {
      metadata: {
        name: 'vclusters',
        namespace: 'argocd',
      },
      spec: appsetSpec,
    });
  }
}
