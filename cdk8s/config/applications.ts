import { ApplicationConfig } from '../lib/idpbuilder-types';

/**
 * IDPBuilder application configurations
 * Add new applications here to have them automatically synthesized
 */
export const applicationConfigs: ApplicationConfig[] = [
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
    name: 'infra-secrets',
    namespace: 'infra',
    chart: {
      type: 'InfraSecretsChart'
    },
    argocd: {
      syncWave: '10',
      labels: {
        'app.kubernetes.io/component': 'infrastructure',
        'app.kubernetes.io/part-of': 'platform'
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
        'app.kubernetes.io/name': 'nextjs-secrets'
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
        'app.kubernetes.io/name': 'nextjs'
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
        'app.kubernetes.io/name': 'postgres'
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
        'app.kubernetes.io/name': 'redis'
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
      type: 'HeadlampChart'
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
      }
    }
  }
  // Add more applications here as needed
];