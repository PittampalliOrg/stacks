import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates an ArgoCD Application for Argo Workflows
 * This application manages the Argo Workflows UI and workflow templates
 */
export class ArgoWorkflowsAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // Argo Workflows UI and ingress
    this.createApplication('argo-workflows-ui', {
      resourcePath: 'argo-workflows-ui', // UI ingress configuration
      namespace: 'argo',
      project: 'devtools',
      syncWave: '30', // After platform services
      labels: {
        'app.kubernetes.io/component': 'workflow-ui',
        'app.kubernetes.io/part-of': 'argo-workflows',
        'app.kubernetes.io/name': 'argo-workflows'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true,
          allowEmpty: false
        },
        syncOptions: [
          'CreateNamespace=true',
          'ServerSideApply=true'
        ],
        retry: {
          limit: 5,
          backoff: {
            duration: '10s',
            factor: 2,
            maxDuration: '3m'
          }
        }
      }
    });
    
    // Workflow templates
    this.createApplication('argo-workflow-templates', {
      resourcePath: 'argo-workflow-templates', // Reusable workflow templates
      namespace: 'argo',
      project: 'devtools',
      syncWave: '35', // After UI
      labels: {
        'app.kubernetes.io/component': 'workflow-templates',
        'app.kubernetes.io/part-of': 'argo-workflows'
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
          'SkipDryRunOnMissingResource=true' // In case Argo CRDs aren't ready
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
        kind: 'WorkflowTemplate',
        jsonPointers: [
          '/metadata/annotations',
          '/status'
        ]
      }, {
        group: 'argoproj.io',
        kind: 'ClusterWorkflowTemplate',
        jsonPointers: [
          '/metadata/annotations',
          '/status'
        ]
      }]
    });
    
    // Dagger infrastructure (RBAC for Argo Workflows)
    this.createApplication('dagger-infra', {
      resourcePath: 'dagger-infra', // Dagger RBAC for workflows
      namespace: 'argo',
      project: 'devtools',
      syncWave: '32', // Between UI and templates
      labels: {
        'app.kubernetes.io/component': 'dagger-rbac',
        'app.kubernetes.io/part-of': 'argo-workflows'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true,
          allowEmpty: false
        },
        syncOptions: [
          'CreateNamespace=true',
          'ServerSideApply=true'
        ],
        retry: {
          limit: 5,
          backoff: {
            duration: '10s',
            factor: 2,
            maxDuration: '3m'
          }
        }
      }
    });
  }
}