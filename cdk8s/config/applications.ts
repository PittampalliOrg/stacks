import { ApplicationConfig } from '../lib/idpbuilder-types';

/**
 * IDPBuilder application configurations
 * Add new applications here to have them automatically synthesized
 */
export const applicationConfigs: ApplicationConfig[] = [

  {
    name: 'vcluster-registration-resources',
    namespace: 'argocd',
    chart: { type: 'VclusterRegistrationResourcesChart' },
    argocd: {
      syncWave: '20',
      labels: {
        'app.kubernetes.io/component': 'vcluster-registration-resources',
        'app.kubernetes.io/part-of': 'vcluster',
        'app.kubernetes.io/name': 'vcluster-registration-resources'
      },
      syncPolicy: {
        automated: { prune: true, selfHeal: true },
        syncOptions: ['CreateNamespace=true']
      }
    }
  },
  {
    name: 'vcluster-registration-appset',
    namespace: 'argocd',
    chart: { type: 'VclusterRegistrationAppSetChart' },
    argocd: {
      syncWave: '25',
      labels: {
        'app.kubernetes.io/component': 'vcluster-registration-appset',
        'app.kubernetes.io/part-of': 'vcluster',
        'app.kubernetes.io/name': 'vcluster-registration-appset'
      },
      syncPolicy: {
        automated: { prune: true, selfHeal: true },
        syncOptions: ['CreateNamespace=true']
      }
    }
  },
  {
    name: 'nextjs-namespace',
    namespace: 'nextjs',
    chart: {
      type: 'NamespaceChart',
      props: { name: 'nextjs' }
    },
    argocd: {
      syncWave: '45',
      labels: {
        'app.kubernetes.io/component': 'namespace',
        'app.kubernetes.io/part-of': 'application-stack',
        'app.kubernetes.io/name': 'nextjs-namespace',
        'app.kubernetes.io/environment': 'staging'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: ['CreateNamespace=true'],
        retry: {
          limit: 15,
          backoff: {
            duration: '10s',
            factor: 2,
            maxDuration: '5m'
          }
        }
      }
    }
  },
  {
    name: 'external-secrets-workload-identity',
    namespace: 'external-secrets',
    chart: {
      type: 'ExternalSecretsWorkloadIdentityChart'
    },
    argocd: {
      syncWave: '-90',  // After external-secrets operator installation
      labels: {
        'app.kubernetes.io/component': 'security',
        'app.kubernetes.io/part-of': 'platform',
        'app.kubernetes.io/name': 'external-secrets-workload-identity'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: ['ServerSideApply=true']
      }
    }
  },
  {
    name: 'vcluster-multi-env',
    namespace: 'argocd',
    chart: {
      type: 'VclusterMultiEnvChart'
    },
    argocd: {
      // Labels to identify resulting Applications for registration
      labels: {
        'cnoe.io/stackName': 'vcluster-multi-env',
        'cnoe.io/applicationName': 'vcluster-package'
      },
      syncWave: '30',
      syncPolicy: {
        automated: { prune: true, selfHeal: true },
        syncOptions: ['CreateNamespace=true']
      }
    }
  },
  
  {
    name: 'bootstrap-secrets',
    namespace: 'argocd',
    chart: {
      type: 'BootstrapSecretsChart'
    },
    dependencies: {
      externalSecretsWorkloadIdentity: {
        type: 'ExternalSecretsWorkloadIdentityChart'
      }
    },
    argocd: {
      syncWave: '-100',
      labels: {
        'app.kubernetes.io/component': 'secrets',
        'app.kubernetes.io/part-of': 'platform',
        'app.kubernetes.io/name': 'bootstrap-secrets'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: ['CreateNamespace=true']
      }
    }
  },
  {
    name: 'nextjs-secrets',
    namespace: 'nextjs',
    chart: {
      type: 'NextJsSecretsChart'
    },
    argocd: {
      syncWave: '80',
      labels: {
        'app.kubernetes.io/component': 'secrets',
        'app.kubernetes.io/part-of': 'application-stack',
        'app.kubernetes.io/name': 'nextjs-secrets',
        'app.kubernetes.io/environment': 'staging'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: ['CreateNamespace=true', 'SkipDryRunOnMissingResource=true'],
        retry: {
          limit: 10,
          backoff: { duration: '10s', factor: 2, maxDuration: '5m' }
        }
      }
    }
  },
  {
    name: 'nextjs',
    namespace: 'nextjs',
    chart: {
      type: 'NextJsChart',
      props: {
        // Chart-specific properties can be added here
      }
    },
    argocd: {
      syncWave: '115',
      labels: {
        'app.kubernetes.io/component': 'frontend',
        'app.kubernetes.io/part-of': 'application-stack',
        'app.kubernetes.io/name': 'nextjs',
        'app.kubernetes.io/environment': 'staging'
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
          'ApplyOutOfSyncOnly=true'
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
      ignoreDifferences: [
        {
          group: 'apps',
          kind: 'Deployment',
          jsonPointers: [
            '/spec/replicas',
            '/spec/template/metadata/annotations'
          ]
        },
        {
          group: '',
          kind: 'Service',
          jsonPointers: [
            '/spec/clusterIP',
            '/spec/clusterIPs'
          ]
        }
      ]
    }
  },
  {
    name: 'postgres',
    namespace: 'nextjs',
    chart: {
      type: 'PostgresChart'
    },
    argocd: {
      syncWave: '50',
      labels: {
        'app.kubernetes.io/component': 'database',
        'app.kubernetes.io/part-of': 'data-layer',
        'app.kubernetes.io/name': 'postgres',
        'app.kubernetes.io/environment': 'staging'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: ['CreateNamespace=true']
      }
    }
  },
  {
    name: 'redis',
    namespace: 'nextjs',
    chart: {
      type: 'RedisChart',
      props: {
        replicas: 1
      }
    },
    argocd: {
      syncWave: '60',
      labels: {
        'app.kubernetes.io/component': 'cache',
        'app.kubernetes.io/part-of': 'data-layer',
        'app.kubernetes.io/name': 'redis',
        'app.kubernetes.io/environment': 'staging'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: ['CreateNamespace=true']
      }
    }
  },
  {
    name: 'keycloak-headlamp-client',
    namespace: 'keycloak',
    chart: {
      type: 'KeycloakHeadlampClientChart'
    },
    argocd: {
      syncWave: '40',  // Before headlamp-keycloak-secrets
      labels: {
        'app.kubernetes.io/component': 'oidc-client',
        'app.kubernetes.io/part-of': 'keycloak',
        'app.kubernetes.io/name': 'keycloak-headlamp-client'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: ['CreateNamespace=true', 'SkipDryRunOnMissingResource=true']
      }
    }
  },
  {
    name: 'headlamp-keycloak-secrets',
    namespace: 'headlamp',
    chart: {
      type: 'HeadlampKeycloakSecretsChart'
    },
    dependencies: {
      keycloakHeadlampClient: {
        type: 'KeycloakHeadlampClientChart'
      }
    },
    argocd: {
      syncWave: '45',  // Before Headlamp deployment
      labels: {
        'app.kubernetes.io/component': 'secrets',
        'app.kubernetes.io/part-of': 'headlamp',
        'app.kubernetes.io/name': 'headlamp-keycloak-secrets'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: ['CreateNamespace=true']
      }
    }
  },
  {
    name: 'headlamp',
    namespace: 'headlamp',
    chart: {
      type: 'HeadlampChart',
      props: {
        enablePluginManager: true,
        plugins: [
          {
            name: 'external-secrets-operator',
            source: 'https://github.com/magohl/external-secrets-operator-headlamp-plugin/releases/download/0.1.0-beta7/external-secrets-operator-headlamp-plugin-0.1.0-beta7.tar.gz',
            version: '0.1.0-beta7'
          }
        ]
      }
    },
    dependencies: {
      headlampKeycloakSecrets: {
        type: 'HeadlampKeycloakSecretsChart'
      }
    },
    argocd: {
      syncWave: '60',  // After secrets, with other apps
      labels: {
        'app.kubernetes.io/component': 'dashboard',
        'app.kubernetes.io/part-of': 'headlamp',
        'app.kubernetes.io/name': 'headlamp'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: ['CreateNamespace=true', 'ServerSideApply=true']
      }
    }
  },
  {
    name: 'kargo-secrets',
    namespace: 'kargo',
    chart: {
      type: 'KargoSecretsChart'
    },
    argocd: {
      syncWave: '-50',  // Deploy secrets before Kargo
      labels: {
        'app.kubernetes.io/component': 'secrets',
        'app.kubernetes.io/part-of': 'kargo',
        'app.kubernetes.io/name': 'kargo-secrets'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: ['CreateNamespace=true']
      }
    }
  },
  {
    name: 'kargo',
    namespace: 'kargo',
    chart: {
      type: 'KargoHelmChart'
    },
    dependencies: {
      kargoSecrets: {
        type: 'KargoSecretsChart'
      }
    },
    argocd: {
      syncWave: '70',  // Deploy after ArgoCD Helm app
      labels: {
        'app.kubernetes.io/component': 'continuous-delivery',
        'app.kubernetes.io/part-of': 'platform',
        'app.kubernetes.io/name': 'kargo',
        'app.kubernetes.io/instance': 'kargo',
        'app.kubernetes.io/version': '1.6.1'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: ['CreateNamespace=true', 'ServerSideApply=true', 'Replace=true']
      },
      ignoreDifferences: [
        {
          group: 'cert-manager.io',
          kind: 'Certificate'
        },
        {
          group: 'cert-manager.io',
          kind: 'Issuer'
        },
        {
          group: 'batch',
          kind: 'Job',
          jsonPointers: [
            '/spec/podReplacementPolicy',
            '/status/terminating'
          ]
        }
      ]
    }
  },
  {
    name: 'backstage',
    namespace: 'backstage',
    chart: {
      type: 'BackstageChart'
    },
    argocd: {
      syncWave: '20',
      annotations: {
        'kargo.akuity.io/authorized-stage': 'kargo-pipelines:backstage-dev'
      },
      labels: {
        'app.kubernetes.io/component': 'developer-portal',
        'app.kubernetes.io/part-of': 'platform',
        'app.kubernetes.io/name': 'backstage'
      },
      // Use default cnoe:// pattern like other applications
      syncPolicy: {
        automated: {
          prune: false,
          selfHeal: false
        },
        syncOptions: ['CreateNamespace=true']
      }
    }
  },
  {
    name: 'kargo-pipelines-project',
    namespace: 'kargo-pipelines',
    chart: {
      type: 'KargoPipelinesProjectChart'
    },
    dependencies: {
      kargo: {
        type: 'KargoHelmChart'
      }
    },
    argocd: {
      syncWave: '75',  // After Kargo installation
      labels: {
        'app.kubernetes.io/component': 'project',
        'app.kubernetes.io/part-of': 'kargo-pipelines',
        'app.kubernetes.io/name': 'kargo-pipelines-project'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: [
          'CreateNamespace=true', 
          'ServerSideApply=true',  // Ensures idempotent Project creation
          'Replace=true',          // Force replace if resources exist
          'RespectIgnoreDifferences=true',  // Respect the ignore differences below
          'PruneLast=true'         // Don't delete namespace until end
        ]
      },
      ignoreDifferences: [
        // Kargo controllers may mutate metadata (owner refs, labels/annotations)
        { group: 'kargo.akuity.io', kind: 'Project', jsonPointers: ['/metadata'] },
        { group: 'kargo.akuity.io', kind: 'ProjectConfig', jsonPointers: ['/metadata'] },
        // Namespace labels/annotations may be injected by controllers
        { group: '', kind: 'Namespace', name: 'kargo-pipelines', jsonPointers: ['/metadata/labels', '/metadata/annotations'] },
        // Secret stringData becomes data; ignore data drift for this static helper secret
        { group: '', kind: 'Secret', name: 'kargo-gitea-webhook-secret', jsonPointers: ['/data'] },
        // RBAC resources may receive owner refs/labels
        { group: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'kargo-pipelines-argocd-updater', jsonPointers: ['/metadata'] },
        { group: 'rbac.authorization.k8s.io', kind: 'ClusterRoleBinding', name: 'kargo-pipelines-argocd-updater', jsonPointers: ['/metadata'] },
        { group: 'rbac.authorization.k8s.io', kind: 'ClusterRoleBinding', name: 'kargo-admin-kargo-pipelines', jsonPointers: ['/metadata'] },
        { group: 'rbac.authorization.k8s.io', kind: 'RoleBinding', name: 'kargo-project-admin', jsonPointers: ['/metadata'] },
      ]
    }
  },
  {
    name: 'kargo-pipelines-credentials',
    namespace: 'kargo-pipelines',
    chart: {
      type: 'KargoPipelinesCredentialsChart'
    },
    dependencies: {
      kargoPipelinesProject: {
        type: 'KargoPipelinesProjectChart'
      }
    },
    argocd: {
      syncWave: '76',  // After project creation
      labels: {
        'app.kubernetes.io/component': 'credentials',
        'app.kubernetes.io/part-of': 'kargo-pipelines',
        'app.kubernetes.io/name': 'kargo-pipelines-credentials'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: ['CreateNamespace=true']
      }
    }
  },
  {
    name: 'kargo-ca-certificates',
    namespace: 'kargo',
    chart: {
      type: 'KargoCACertificatesChart'
    },
    argocd: {
      syncWave: '35',  // Before Kargo Helm chart (which is at 40)
      labels: {
        'app.kubernetes.io/component': 'certificates',
        'app.kubernetes.io/part-of': 'kargo',
        'app.kubernetes.io/name': 'kargo-ca-certificates'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: ['CreateNamespace=false']  // Namespace exists
      }
    }
  },
  {
    name: 'kargo-nextjs-pipeline',
    namespace: 'kargo-pipelines',
    chart: {
      type: 'KargoNextjsPipelineChart'
    },
    dependencies: {
      kargoPipelinesCredentials: {
        type: 'KargoPipelinesCredentialsChart'
      }
    },
    argocd: {
      syncWave: '80',  // After credentials
      labels: {
        'app.kubernetes.io/component': 'pipeline',
        'app.kubernetes.io/part-of': 'kargo-pipelines',
        'app.kubernetes.io/name': 'kargo-nextjs-pipeline',
        'app.kubernetes.io/managed-by': 'argocd'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: ['CreateNamespace=true']
      }
    }
  },
  {
    name: 'kargo-backstage-pipeline',
    namespace: 'kargo-pipelines',
    chart: {
      type: 'KargoBackstagePipelineChart'
    },
    dependencies: {
      kargoPipelinesCredentials: {
        type: 'KargoPipelinesCredentialsChart'
      }
    },
    argocd: {
      syncWave: '80',  // After credentials
      labels: {
        'app.kubernetes.io/component': 'pipeline',
        'app.kubernetes.io/part-of': 'kargo-pipelines',
        'app.kubernetes.io/name': 'kargo-backstage-pipeline',
        'app.kubernetes.io/managed-by': 'argocd'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: ['CreateNamespace=true']
      }
    }
  },
  {
    name: 'kargo-gitea-webhook-setup',
    namespace: 'kargo-pipelines',
    chart: {
      type: 'KargoGiteaWebhookSetupChart'
    },
    dependencies: {
      kargoPipelinesProject: {
        type: 'KargoPipelinesProjectChart'
      }
    },
    argocd: {
      syncWave: '85',  // After pipelines are created
      labels: {
        'app.kubernetes.io/component': 'webhook-setup',
        'app.kubernetes.io/part-of': 'kargo-pipelines',
        'app.kubernetes.io/name': 'kargo-gitea-webhook-setup',
        'app.kubernetes.io/managed-by': 'argocd'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: ['CreateNamespace=true']
      }
    }
  },
  {
    name: 'dagger-infra',
    namespace: 'argo',
    chart: {
      type: 'DaggerInfraChart'
    },
    argocd: {
      syncWave: '-80',  // Deploy before Argo Workflows
      labels: {
        'app.kubernetes.io/component': 'rbac',
        'app.kubernetes.io/part-of': 'argo-workflows',
        'app.kubernetes.io/name': 'dagger-infra'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: ['CreateNamespace=true']
      }
    }
  },
  // Removed: Custom CoreDNS configuration is not needed
  // The *.localtest.me domain already resolves to 127.0.0.1 globally
  // Custom DNS rewriting was causing conflicts with IDPBuilder setup
  // Original configuration attempted to rewrite cnoe.localtest.me to ingress controller
  // {
  //   name: 'cluster-config',
  //   namespace: 'kube-system',
  //   chart: {
  //     type: 'ClusterConfigChart'
  //   },
  //   argocd: {
  //     syncWave: '-200',  // Very early, cluster configuration
  //     labels: {
  //       'app.kubernetes.io/component': 'cluster-config',
  //       'app.kubernetes.io/part-of': 'platform',
  //       'app.kubernetes.io/name': 'cluster-config'
  //     },
  //     syncPolicy: {
  //       automated: {
  //         prune: true,
  //         selfHeal: true
  //     },
  //       syncOptions: ['CreateNamespace=true']
  //     }
  //   }
  // },
  {
    name: 'vault',
    namespace: 'vault',
    chart: {
      type: 'VaultChart'
    },
    argocd: {
      syncWave: '-150',  // Early, before external secrets
      labels: {
        'app.kubernetes.io/component': 'secrets-management',
        'app.kubernetes.io/part-of': 'platform',
        'app.kubernetes.io/name': 'vault'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: ['CreateNamespace=true']
      },
      // Multi-source configuration for Vault
      sources: [
        {
          repoURL: 'https://helm.releases.hashicorp.com',
          chart: 'vault',
          targetRevision: '0.27.0',
          helm: {
            valueFiles: ['$values/values.yaml']
          }
        },
        {
          repoURL: 'cnoe://vault',
          targetRevision: 'HEAD',
          ref: 'values'
        }
      ],
      ignoreDifferences: [
        {
          group: 'admissionregistration.k8s.io',
          kind: 'MutatingWebhookConfiguration',
          jsonPointers: ['/webhooks']
        }
      ]
    }
  },
  {
    name: 'ai-platform-engineering',
    namespace: 'ai-platform-engineering',
    chart: {
      type: 'AiPlatformEngineeringAzureChart'
    },
    argocd: {
      syncWave: '100',  // After most platform components
      labels: {
        'app.kubernetes.io/component': 'ai-platform',
        'app.kubernetes.io/part-of': 'platform',
        'app.kubernetes.io/name': 'ai-platform-engineering'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: ['CreateNamespace=true', 'PrunePropagationPolicy=foreground', 'PruneLast=true'],
        retry: {
          limit: 5,
          backoff: {
            duration: '5s',
            factor: 2,
            maxDuration: '3m'
          }
        }
      },
      // Simplified single-source configuration
      // The Helm chart is now deployed directly in the CDK8S chart
      // with all values embedded in TypeScript
    }
  }
  // Add more applications here as needed
];
