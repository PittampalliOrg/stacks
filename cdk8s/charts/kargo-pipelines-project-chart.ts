import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { Project, ProjectConfig } from '../imports/kargo.akuity.io';

/**
 * Kargo Pipelines Project Chart
 * Creates a central Kargo project that contains all image promotion pipelines
 */
export class KargoPipelinesProjectChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    // Create the namespace first with the required Kargo label
    // This ensures Kargo recognizes it as a project namespace
    new ApiObject(this, 'pipelines-namespace', {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: 'kargo-pipelines',
        labels: {
          'app.kubernetes.io/name': 'kargo-pipelines',
          'app.kubernetes.io/part-of': 'kargo',
          'app.kubernetes.io/component': 'namespace',
          'kargo.akuity.io/project': 'true'  // Required by Kargo
        }
      }
    });

    // Create the central Kargo Project
    // This will adopt the namespace we just created
    new Project(this, 'pipelines-project', {
      metadata: {
        name: 'kargo-pipelines',
        labels: {
          'app.kubernetes.io/name': 'kargo-pipelines',
          'app.kubernetes.io/part-of': 'kargo',
          'app.kubernetes.io/component': 'project'
        }
      },
      spec: {}
    });

    // Create ProjectConfig for promotion policies
    new ProjectConfig(this, 'pipelines-project-config', {
      metadata: {
        name: 'kargo-pipelines',
        namespace: 'kargo-pipelines',
        labels: {
          'app.kubernetes.io/name': 'kargo-pipelines-config',
          'app.kubernetes.io/part-of': 'kargo',
          'app.kubernetes.io/component': 'project-config'
        }
      },
      spec: {
        promotionPolicies: [
          // Auto-promote to dev stages for all pipelines
          {
            stageSelector: {
              name: 'glob:*-dev'
            },
            autoPromotionEnabled: true
          },
          // Manual promotion for production
          {
            stageSelector: {
              name: 'glob:*-prod'
            },
            autoPromotionEnabled: false
          }
        ]
      }
    });

    // Create shared RBAC resources for Git operations
    // Each pipeline will have its own service account but share common roles
    new ApiObject(this, 'kargo-git-role', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'Role',
      metadata: {
        name: 'kargo-git-promoter',
        namespace: 'kargo-pipelines'
      },
      rules: [
        {
          apiGroups: ['kargo.akuity.io'],
          resources: ['freights', 'stages', 'warehouses', 'promotions', 'projectconfigs'],
          verbs: ['get', 'list', 'watch', 'create', 'update', 'patch']
        },
        {
          apiGroups: [''],
          resources: ['secrets', 'serviceaccounts'],
          verbs: ['get', 'list']
        }
      ]
    });

    // Create a shared ClusterRole for ArgoCD operations
    new ApiObject(this, 'kargo-argocd-updater-role', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRole',
      metadata: {
        name: 'kargo-pipelines-argocd-updater',
        labels: {
          'app.kubernetes.io/name': 'kargo-pipelines-argocd-updater',
          'app.kubernetes.io/part-of': 'kargo-pipelines'
        }
      },
      rules: [
        {
          apiGroups: ['argoproj.io'],
          resources: ['applications'],
          verbs: ['get', 'list', 'patch', 'update']
        }
      ]
    });

    // Create a shared ClusterRoleBinding for all pipeline service accounts
    new ApiObject(this, 'kargo-argocd-updater-binding', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRoleBinding',
      metadata: {
        name: 'kargo-pipelines-argocd-updater',
        labels: {
          'app.kubernetes.io/name': 'kargo-pipelines-argocd-updater-binding',
          'app.kubernetes.io/part-of': 'kargo-pipelines'
        }
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: 'kargo-pipelines-argocd-updater'
      },
      subjects: [
        // Service accounts for each pipeline
        {
          kind: 'ServiceAccount',
          name: 'kargo-nextjs-git',
          namespace: 'kargo-pipelines'
        },
        {
          kind: 'ServiceAccount',
          name: 'kargo-backstage-git',
          namespace: 'kargo-pipelines'
        },
        // Kargo controller needs access too
        {
          kind: 'ServiceAccount',
          name: 'kargo-controller',
          namespace: 'kargo'
        }
      ]
    });

    // Create RBAC for Kargo UI access
    // This allows authenticated users to view and manage the project
    new ApiObject(this, 'kargo-admin-binding', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRoleBinding',
      metadata: {
        name: 'kargo-admin-kargo-pipelines',
        labels: {
          'app.kubernetes.io/name': 'kargo-admin-binding',
          'app.kubernetes.io/part-of': 'kargo-pipelines'
        }
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: 'kargo-admin'
      },
      subjects: [
        {
          kind: 'User',
          name: 'system:serviceaccount:kargo:kargo-api'
        },
        {
          kind: 'Group',
          name: 'system:authenticated'
        }
      ]
    });

    // Create project-level admin binding
    new ApiObject(this, 'kargo-project-admin-binding', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: {
        name: 'kargo-project-admin',
        namespace: 'kargo-pipelines',
        labels: {
          'app.kubernetes.io/name': 'kargo-project-admin-binding',
          'app.kubernetes.io/part-of': 'kargo-pipelines'
        }
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: 'kargo-project-admin'
      },
      subjects: [
        {
          kind: 'Group',
          name: 'system:authenticated'
        }
      ]
    });
  }
}