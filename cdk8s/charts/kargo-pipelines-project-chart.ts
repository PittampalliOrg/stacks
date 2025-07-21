import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { Project, ProjectConfig } from '../imports/kargo.akuity.io';
import { 
  ExternalSecret,
  ExternalSecretSpecTargetCreationPolicy,
  ExternalSecretSpecSecretStoreRefKind,
  ExternalSecretSpecDataRemoteRefConversionStrategy,
  ExternalSecretSpecDataRemoteRefDecodingStrategy,
  ExternalSecretSpecDataRemoteRefMetadataPolicy
} from '../imports/external-secrets.io';

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
        name: 'gitops-pipelines',
        labels: {
          'app.kubernetes.io/name': 'gitops-pipelines',
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
        name: 'gitops-pipelines',
        labels: {
          'app.kubernetes.io/name': 'gitops-pipelines',
          'app.kubernetes.io/part-of': 'kargo',
          'app.kubernetes.io/component': 'project'
        }
      },
      spec: {}
    });

    // Create External Secret for GitHub webhook validation
    // This fetches the webhook secret from Azure Key Vault
    new ExternalSecret(this, 'github-webhook-secret-external', {
      metadata: {
        name: 'github-webhook-secret-external',
        namespace: 'gitops-pipelines',
        labels: {
          'app.kubernetes.io/name': 'github-webhook-secret',
          'app.kubernetes.io/part-of': 'gitops-pipelines'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-15', // Create before ProjectConfig
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'github-webhook-secret',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
        },
        data: [{
          secretKey: 'secret',
          remoteRef: {
            key: 'GITHUB-WEBHOOK-SECRET',
            conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
            decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
            metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
          }
        }]
      }
    });

    // Create ProjectConfig for promotion policies
    new ProjectConfig(this, 'pipelines-project-config', {
      metadata: {
        name: 'gitops-pipelines',
        namespace: 'gitops-pipelines',
        labels: {
          'app.kubernetes.io/name': 'gitops-pipelines-config',
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
          // Manual promotion for staging
          {
            stageSelector: {
              name: 'glob:*-staging'
            },
            autoPromotionEnabled: false
          },
          // Auto-promotion for production (safe with environment-specific images)
          {
            stageSelector: {
              name: 'glob:*-prod'
            },
            autoPromotionEnabled: true
          }
        ],
        webhookReceivers: [
          {
            name: 'github-receiver',
            github: {
              secretRef: {
                name: 'github-webhook-secret'
                // The secret is expected to have a 'secret' key
              }
            }
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
        namespace: 'gitops-pipelines'
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
          'app.kubernetes.io/part-of': 'gitops-pipelines'
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
          'app.kubernetes.io/part-of': 'gitops-pipelines'
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
          namespace: 'gitops-pipelines'
        },
        {
          kind: 'ServiceAccount',
          name: 'kargo-backstage-git',
          namespace: 'gitops-pipelines'
        },
        {
          kind: 'ServiceAccount',
          name: 'kargo-flagd-ui-git',
          namespace: 'gitops-pipelines'
        },
        {
          kind: 'ServiceAccount',
          name: 'kargo-claudecodeui-git',
          namespace: 'gitops-pipelines'
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
        name: 'kargo-admin-gitops-pipelines',
        labels: {
          'app.kubernetes.io/name': 'kargo-admin-binding',
          'app.kubernetes.io/part-of': 'gitops-pipelines'
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
        namespace: 'gitops-pipelines',
        labels: {
          'app.kubernetes.io/name': 'kargo-project-admin-binding',
          'app.kubernetes.io/part-of': 'gitops-pipelines'
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