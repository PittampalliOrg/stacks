import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates ArgoCD Applications for Grafana-related resources
 * Note: The main Grafana deployment is managed by Helm in monitoring-helm-app-chart.ts
 * This chart manages supplementary resources like dashboards and the flagd-ui
 */
export class GrafanaAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // Core Grafana deployment - DISABLED to avoid conflict with Helm-based Grafana
    // The Grafana deployment is now managed by the Helm chart in monitoring-helm-app-chart.ts
    // which deploys to the 'monitoring' namespace instead of 'observability'
    
    // Grafana dashboards and datasources
    this.createApplication('grafana-dashboards', {
      resourcePath: 'grafana-setup', // Grafana setup resources including token job
      namespace: 'monitoring', // Changed to monitoring namespace where Grafana is deployed
      project: 'observability',
      syncWave: '55', // After Grafana core
      labels: {
        'app.kubernetes.io/component': 'dashboards',
        'app.kubernetes.io/part-of': 'grafana',
        'grafana.com/managed': 'true'
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
          'SkipDryRunOnMissingResource=true', // In case Grafana CRDs aren't ready
          'Replace=true' // Allow replacing resources during sync
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
        group: '',
        kind: 'ConfigMap',
        jsonPointers: [
          '/metadata/annotations',
          '/metadata/labels/grafana_dashboard_revision' // Dashboard revisions
        ]
      }]
    });
  }
}