import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import {
  ApplicationSet,
  ApplicationSetSpec,
  ApplicationSpecSyncPolicy,
} from '../../imports/argoproj.io';

/**
 * Creates ApplicationSet for registering vclusters with ArgoCD
 * Each environment gets its own pre-generated manifests (no kustomize patches)
 */
export class VclusterRegistrationSimplifiedAppSetChart extends Chart {
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
          project: 'default',
          destination: {
            server: 'https://kubernetes.default.svc',
            namespace: 'argocd',
          },
          syncPolicy: {
            automated: { prune: true, selfHeal: true },
            syncOptions: ['CreateNamespace=true', 'ServerSideApply=true'],
          } as ApplicationSpecSyncPolicy,
          source: {
            // Each environment gets its own dedicated manifests folder
            repoUrl: 'https://gitea.cnoe.localtest.me:8443/giteaAdmin/idpbuilder-localdev-vcluster-registration-{{.name}}-manifests.git',
            targetRevision: 'HEAD',
            path: '.',
          },
        },
      },
    } as any;

    new ApplicationSet(this, 'vclusters-registration-appset', {
      metadata: { 
        name: 'vclusters-registration', 
        namespace: 'argocd' 
      },
      spec: appsetSpec,
    });
  }
}