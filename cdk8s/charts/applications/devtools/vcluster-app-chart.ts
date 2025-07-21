import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for vCluster management
 * This application manages the vCluster ApplicationSet and related resources
 */
export class VClusterAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.createApplication('vcluster-management', {
      resourcePath: 'vcluster-applicationset', // vCluster ApplicationSet and RBAC
      namespace: 'argocd', // ApplicationSet lives in ArgoCD namespace
      project: 'devtools',
      syncWave: '35', // After Argo Workflows
      labels: {
        'app.kubernetes.io/component': 'vcluster',
        'app.kubernetes.io/part-of': 'multi-tenancy',
        'app.kubernetes.io/name': 'vcluster'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true,
          allowEmpty: false
        },
        syncOptions: [
          'CreateNamespace=true',
          'ServerSideApply=true',
          'RespectIgnoreDifferences=true'
        ],
        retry: {
          limit: 5,
          backoff: {
            duration: '10s',
            factor: 2,
            maxDuration: '3m'
          }
        }
      },
      ignoreDifferences: [{
        group: 'argoproj.io',
        kind: 'ApplicationSet',
        jsonPointers: [
          '/status',
          '/spec/template/metadata', // ApplicationSet might modify template metadata
          '/spec/generators/*/requeueAfterSeconds' // Timing fields
        ]
      }, {
        group: 'batch',
        kind: 'Job',
        jsonPointers: [
          '/status',
          '/spec/completions',
          '/spec/parallelism'
        ]
      }, {
        group: '',
        kind: 'ConfigMap',
        name: 'vcluster-configs',
        jsonPointers: [
          '/data/clusters' // Dynamic cluster list
        ]
      }]
    });
  }
}