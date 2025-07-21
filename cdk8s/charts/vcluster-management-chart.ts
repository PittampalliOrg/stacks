import { ApiObject, Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';

export interface VClusterConfig {
  name: string;
  namespace?: string;
  expose?: boolean;
  resources?: {
    requests?: {
      cpu?: string;
      memory?: string;
    };
    limits?: {
      cpu?: string;
      memory?: string;
    };
  };
  storage?: {
    size?: string;
    className?: string;
  };
  sync?: {
    nodes?: boolean;
    persistentVolumes?: boolean;
    storageClasses?: boolean;
  };
  ingress?: {
    enabled?: boolean;
    host?: string;
    ingressClassName?: string;
  };
  workloadIdentity?: {
    enabled?: boolean;
    clientId?: string;
    tenantId?: string;
  };
}

export interface VClusterManagementChartProps extends ChartProps {
  vclusters: VClusterConfig[];
  argocdNamespace?: string;
}

export class VClusterManagementChart extends Chart {
  constructor(scope: Construct, id: string, props: VClusterManagementChartProps) {
    super(scope, id, props);

    const argocdNs = props.argocdNamespace || 'argocd';

    // Create ArgoCD Application for each vcluster
    props.vclusters.forEach(vcluster => {
      const vclusterNamespace = vcluster.namespace || `vcluster-${vcluster.name}`;
      
      // Create namespace for vcluster
      new ApiObject(this, `${vcluster.name}-namespace`, {
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: {
          name: vclusterNamespace,
          labels: {
            'app.kubernetes.io/managed-by': 'argocd',
            'vcluster.loft.sh/managed-by': 'argocd',
            'vcluster-name': vcluster.name
          },
          annotations: {
            'argocd.argoproj.io/sync-wave': '1'
          }
        }
      });

      // Create Helm values for vcluster
      const helmValues = this.generateHelmValues(vcluster);

      // Create ArgoCD Application for vcluster
      const app = {
        apiVersion: 'argoproj.io/v1alpha1',
        kind: 'Application',
        metadata: {
          name: `vcluster-${vcluster.name}`,
          namespace: argocdNs,
          labels: {
            'app.kubernetes.io/instance': `vcluster-${vcluster.name}`,
            'vcluster-instance': vcluster.name
          },
          annotations: {
            'argocd.argoproj.io/sync-wave': '2',
            'argocd.argoproj.io/tracking-id': `cdk8s-applications:argoproj.io/Application:${argocdNs}/vcluster-${vcluster.name}`
          },
          finalizers: ['resources-finalizer.argocd.argoproj.io']
        },
        spec: {
          project: 'default',
          destination: {
            name: 'in-cluster',
            namespace: vclusterNamespace
          },
          source: {
            repoURL: 'https://charts.loft.sh',
            targetRevision: '0.17.0',  // Use stable version compatible with our k8s
            chart: 'vcluster',
            helm: {
              releaseName: vcluster.name,
              values: JSON.stringify(helmValues, null, 2)
            }
          },
          syncPolicy: {
            automated: {
              prune: true,
              selfHeal: false
            },
            syncOptions: [
              'CreateNamespace=true',
              'ServerSideApply=true'
            ],
            retry: {
              limit: 5,
              backoff: {
                duration: '5s',
                factor: 2,
                maxDuration: '3m'
              }
            }
          },
          revisionHistoryLimit: 3,
          ignoreDifferences: [
            {
              group: 'apps',
              kind: 'StatefulSet',
              jsonPointers: ['/spec/volumeClaimTemplates']
            }
          ]
        }
      };

      new ApiObject(this, `${vcluster.name}-app`, app);

      // Create ServiceAccount for ArgoCD to manage vcluster
      if (vcluster.workloadIdentity?.enabled) {
        new ApiObject(this, `${vcluster.name}-argocd-sa`, {
          apiVersion: 'v1',
          kind: 'ServiceAccount',
          metadata: {
            name: `vcluster-${vcluster.name}-argocd`,
            namespace: vclusterNamespace,
            labels: {
              'azure.workload.identity/use': 'true'
            },
            annotations: {
              'azure.workload.identity/client-id': vcluster.workloadIdentity.clientId || '',
              'azure.workload.identity/tenant-id': vcluster.workloadIdentity.tenantId || '',
              'argocd.argoproj.io/sync-wave': '1'
            }
          }
        });
      }

      // Create RBAC for vcluster management
      const clusterRole = {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'ClusterRole',
        metadata: {
          name: `vcluster-${vcluster.name}-admin`,
          labels: {
            'vcluster-instance': vcluster.name
          }
        },
        rules: [
          {
            apiGroups: ['*'],
            resources: ['*'],
            verbs: ['*']
          }
        ]
      };

      new ApiObject(this, `${vcluster.name}-cluster-role`, clusterRole);

      // Create external secret for vcluster kubeconfig (if using external secrets)
      if (vcluster.expose) {
        const externalSecret = {
          apiVersion: 'external-secrets.io/v1',
          kind: 'ExternalSecret',
          metadata: {
            name: `vcluster-${vcluster.name}-kubeconfig`,
            namespace: argocdNs,
            annotations: {
              'argocd.argoproj.io/sync-wave': '3'
            }
          },
          spec: {
            refreshInterval: '1h',
            secretStoreRef: {
              name: 'keyvault-secret-store',
              kind: 'SecretStore'
            },
            target: {
              name: `vcluster-${vcluster.name}-kubeconfig`,
              creationPolicy: 'Owner',
              template: {
                type: 'Opaque',
                metadata: {
                  labels: {
                    'argocd.argoproj.io/secret-type': 'cluster',
                    'vcluster-instance': vcluster.name
                  }
                }
              }
            },
            dataFrom: [{
              extract: {
                key: `vcluster-${vcluster.name}-kubeconfig`
              }
            }]
          }
        };

        new ApiObject(this, `${vcluster.name}-external-secret`, externalSecret);
      }
    });

    // Create AppProject for vcluster management
    const appProject = {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'AppProject',
      metadata: {
        name: 'vcluster-management',
        namespace: argocdNs,
        annotations: {
          'argocd.argoproj.io/sync-wave': '0'
        }
      },
      spec: {
        description: 'Project for managing vclusters',
        sourceRepos: ['*'],
        destinations: [
          {
            namespace: 'vcluster-*',
            server: 'https://kubernetes.default.svc'
          },
          {
            namespace: argocdNs,
            server: 'https://kubernetes.default.svc'
          }
        ],
        clusterResourceWhitelist: [
          {
            group: '*',
            kind: '*'
          }
        ],
        namespaceResourceWhitelist: [
          {
            group: '*',
            kind: '*'
          }
        ],
        roles: [
          {
            name: 'vcluster-admin',
            policies: [
              'p, proj:vcluster-management:vcluster-admin, applications, *, vcluster-management/*, allow',
              'p, proj:vcluster-management:vcluster-admin, clusters, *, *, allow'
            ],
            groups: ['argocd-admins']
          }
        ]
      }
    };

    new ApiObject(this, 'vcluster-app-project', appProject);
    // Create registration resources for each vcluster
    props.vclusters.forEach(vcluster => {
      const vclusterNamespace = vcluster.namespace || `vcluster-${vcluster.name}`;
      
      // Create ServiceAccount for vCluster registration
      new ApiObject(this, 'vcluster-registrar-sa', {
        apiVersion: 'v1',
        kind: 'ServiceAccount',
        metadata: {
          name: 'vcluster-registrar',
          namespace: argocdNs,
          annotations: {
            'argocd.argoproj.io/sync-wave': '0'
          }
        }
      });

      // Create Role for vCluster registration
      new ApiObject(this, 'vcluster-registrar-role', {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'Role',
        metadata: {
          name: 'vcluster-registrar',
          namespace: argocdNs,
          annotations: {
            'argocd.argoproj.io/sync-wave': '0'
          }
        },
        rules: [
          {
            apiGroups: [''],
            resources: ['secrets'],
            verbs: ['create', 'get', 'list', 'patch', 'update']
          },
          {
            apiGroups: ['argoproj.io'],
            resources: ['applications', 'appprojects'],
            verbs: ['get', 'list']
          }
        ]
      });

      // Create RoleBinding for vCluster registration
      new ApiObject(this, 'vcluster-registrar-rb', {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'RoleBinding',
        metadata: {
          name: 'vcluster-registrar',
          namespace: argocdNs,
          annotations: {
            'argocd.argoproj.io/sync-wave': '0'
          }
        },
        roleRef: {
          apiGroup: 'rbac.authorization.k8s.io',
          kind: 'Role',
          name: 'vcluster-registrar'
        },
        subjects: [
          {
            kind: 'ServiceAccount',
            name: 'vcluster-registrar',
            namespace: argocdNs
          }
        ]
      });

      // Create Role for reading vCluster secret
      new ApiObject(this, `${vcluster.name}-secret-reader-role`, {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'Role',
        metadata: {
          name: 'vcluster-secret-reader',
          namespace: vclusterNamespace,
          annotations: {
            'argocd.argoproj.io/sync-wave': '1'
          }
        },
        rules: [
          {
            apiGroups: [''],
            resources: ['secrets'],
            verbs: ['get', 'list']
          }
        ]
      });

      // Create RoleBinding for reading vCluster secret
      new ApiObject(this, `${vcluster.name}-secret-reader-rb`, {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'RoleBinding',
        metadata: {
          name: 'vcluster-secret-reader',
          namespace: vclusterNamespace,
          annotations: {
            'argocd.argoproj.io/sync-wave': '1'
          }
        },
        roleRef: {
          apiGroup: 'rbac.authorization.k8s.io',
          kind: 'Role',
          name: 'vcluster-secret-reader'
        },
        subjects: [
          {
            kind: 'ServiceAccount',
            name: 'vcluster-registrar',
            namespace: argocdNs
          }
        ]
      });

      // Create Job that registers vCluster with ArgoCD
      const registrationScript = `
set -e
echo "Waiting for vCluster ${vcluster.name} to be ready..."

# Wait for vCluster secret to exist
echo "Waiting for vCluster secret... (1/60)"
for i in {1..60}; do
  if kubectl get secret vc-${vcluster.name} -n ${vclusterNamespace} >/dev/null 2>&1; then
    echo "vCluster secret found!"
    break
  fi
  echo "Waiting for vCluster secret... ($i/60)"
  sleep 5
done

# Get vCluster kubeconfig
echo "Extracting vCluster kubeconfig..."
kubectl get secret vc-${vcluster.name} -n ${vclusterNamespace} -o jsonpath='{.data.config}' | base64 -d > /tmp/kubeconfig

# Create ArgoCD cluster secret
echo "Creating ArgoCD cluster secret..."
kubectl create secret generic vcluster-${vcluster.name} \\
  --from-file=config=/tmp/kubeconfig \\
  --namespace=${argocdNs} \\
  --dry-run=client -o yaml | \\
kubectl label -f - \\
  argocd.argoproj.io/secret-type=cluster \\
  vcluster-instance=${vcluster.name} \\
  --local -o yaml | \\
kubectl annotate -f - \\
  managed-by=argocd.argoproj.io \\
  --local -o yaml | \\
kubectl apply -f -

# Update the secret with cluster name and server
VCLUSTER_SERVER=$(kubectl --kubeconfig=/tmp/kubeconfig config view -o jsonpath='{.clusters[0].cluster.server}')
kubectl patch secret vcluster-${vcluster.name} -n ${argocdNs} --type=json -p='[
  {"op": "add", "path": "/data/name", "value": "'$(echo -n "vcluster-${vcluster.name}" | base64 -w0)'"},
  {"op": "add", "path": "/data/server", "value": "'$(echo -n "$VCLUSTER_SERVER" | base64 -w0)'"}
]'

echo "vCluster ${vcluster.name} registered with ArgoCD successfully!"
`;

      new ApiObject(this, `${vcluster.name}-registration-job`, {
        apiVersion: 'batch/v1',
        kind: 'Job',
        metadata: {
          name: `register-vcluster-${vcluster.name}`,
          namespace: argocdNs,
          labels: {
            'app.kubernetes.io/name': 'vcluster-registration',
            'app.kubernetes.io/instance': vcluster.name,
            'app.kubernetes.io/managed-by': 'cdk8s'
          },
          annotations: {
            'argocd.argoproj.io/sync-wave': '3',  // Run after vCluster is deployed
            'argocd.argoproj.io/hook': 'Sync',  // Run during sync, not PostSync
            'argocd.argoproj.io/hook-delete-policy': 'BeforeHookCreation'  // Delete old job before creating new
          }
        },
        spec: {
          ttlSecondsAfterFinished: 86400, // Clean up after 24 hours
          template: {
            metadata: {
              labels: {
                'app.kubernetes.io/name': 'vcluster-registration',
                'app.kubernetes.io/instance': vcluster.name
              }
            },
            spec: {
              restartPolicy: 'OnFailure',
              serviceAccountName: 'vcluster-registrar',
              containers: [{
                name: 'register',
                image: 'bitnami/kubectl:latest',
                command: ['/bin/bash'],
                args: ['-c', registrationScript]
              }]
            }
          }
        }
      });
    });
  }

  private generateHelmValues(vcluster: VClusterConfig): any {
    const values: any = {
      // Basic vcluster configuration
      vcluster: {
        image: 'rancher/k3s:v1.29.9-k3s1'
      },
      
      // Syncer configuration with WSL2 compatibility
      syncer: {
        extraArgs: [
          '--tls-san=' + vcluster.name + '.vcluster-' + vcluster.name,
          '--tls-san=' + vcluster.name + '.vcluster-' + vcluster.name + '.svc',
          '--tls-san=' + vcluster.name + '.vcluster-' + vcluster.name + '.svc.cluster.local',
          '--tls-san=localhost',
          '--tls-san=127.0.0.1'
        ]
      },

      // Storage configuration
      storage: {
        persistence: true,
        size: vcluster.storage?.size || '10Gi'
      },

      // Service configuration - ClusterIP for WSL2
      service: {
        type: 'ClusterIP'
      },

      // Ingress configuration
      ingress: {
        enabled: vcluster.ingress?.enabled || false,
        host: vcluster.ingress?.host,
        ingressClassName: vcluster.ingress?.ingressClassName || 'nginx'
      },

      // RBAC configuration
      rbac: {
        clusterRole: {
          create: true
        },
        role: {
          create: true
        }
      },

      // Security context - removed fsGroup as it's not valid here
      securityContext: {
        runAsUser: 0,
        runAsNonRoot: false
      },

      // Pod security context - removed 'enabled' field, just set fsGroup directly
      podSecurityContext: {
        fsGroup: 12345
      },

      // Isolation configuration
      isolation: {
        enabled: true,
        namespace: true,
        network: false,
        resourceQuota: {
          enabled: true,
          quota: {
            'requests.cpu': '10',  // Allow 10 CPUs for all workloads
            'requests.memory': '40Gi',  // Allow 40Gi memory for all workloads
            'requests.storage': '100Gi',  // Allow 100Gi for all workloads
            'persistentvolumeclaims': '20',
            'services.nodeports': '0',
            'services.loadbalancers': '1'
          }
        }
      },

      // Monitoring - disabled as ServiceMonitor CRD is not installed
      monitoring: {
        serviceMonitor: {
          enabled: false
        }
      },

      // Telemetry
      telemetry: {
        disabled: false
      },

      // Multi-namespace mode
      multiNamespaceMode: {
        enabled: false
      },

      // Proxy configuration for workload identity
      proxy: {
        metricsServer: {
          nodes: {
            enabled: true
          },
          pods: {
            enabled: true
          }
        }
      }
    };

    // Add resource limits if specified
    if (vcluster.resources) {
      values.resources = {
        limits: vcluster.resources.limits || {},
        requests: vcluster.resources.requests || {}
      };
    }

    // Add sync configuration
    if (vcluster.sync) {
      values.sync = values.sync || {};
      
      // Sync from host to virtual cluster
      values.sync.fromHost = values.sync.fromHost || {};
      
      if (vcluster.sync.storageClasses) {
        values.sync.fromHost.storageClasses = { enabled: true };
      }
      
      // Sync from virtual to host cluster  
      values.sync.toHost = values.sync.toHost || {};
      
      if (vcluster.sync.persistentVolumes) {
        values.sync.toHost.persistentVolumes = { enabled: true };
      }
      
      // PersistentVolumeClaims are synced by default
      values.sync.toHost.persistentVolumeClaims = { enabled: true };
      
      if (vcluster.sync.nodes) {
        values.sync.fromHost.nodes = {
          enabled: true,
          syncAllNodes: true,
          nodeSelector: 'vcluster.loft.sh/enabled=true'
        };
      }
    }

    // Add workload identity annotations
    if (vcluster.workloadIdentity?.enabled) {
      values.syncer.serviceAccount = {
        create: true,
        annotations: {
          'azure.workload.identity/client-id': vcluster.workloadIdentity.clientId || '',
          'azure.workload.identity/tenant-id': vcluster.workloadIdentity.tenantId || ''
        }
      };
      values.labels = {
        'azure.workload.identity/use': 'true'
      };
    }

    return values;
  }
}