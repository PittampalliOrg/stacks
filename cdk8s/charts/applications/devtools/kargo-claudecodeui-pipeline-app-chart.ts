import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * ArgoCD Application for Kargo Claude Code UI Pipeline
 */
export class KargoClaudeCodeUiPipelineAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.createApplication('kargo-claudecodeui-pipeline', {
      resourcePath: 'kargo-claudecodeui-pipeline',
      namespace: 'gitops-pipelines',
      project: 'default',
      syncWave: '25',
      repoURL: 'https://github.com/PittampalliOrg/cdk8s-project.git',
      targetRevision: process.env.ENVIRONMENT || 'dev',
      labels: {
        'app.kubernetes.io/name': 'kargo-claudecodeui-pipeline',
        'app.kubernetes.io/part-of': 'kargo-pipelines',
        'app.kubernetes.io/component': 'pipeline',
        'argocd.argoproj.io/instance': 'kargo-claudecodeui-pipeline'
      },
      ignoreDifferences: undefined,
      syncOptions: [
        'CreateNamespace=true',
        'ServerSideApply=true',
        'ApplyOutOfSyncOnly=true'
      ]
    });
  }
}