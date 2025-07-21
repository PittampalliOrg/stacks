import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';
import { ApplicationSet } from '../imports/argoproj.io';

export interface VClusterApplicationSetChartProps extends ChartProps {
  branch?: string;
  repoUrl?: string;
  argocdNamespace?: string;
}

/**
 * Creates an ApplicationSet for managing vClusters
 * This allows dynamic creation of vClusters based on configuration files
 */
export class VClusterApplicationSetChart extends Chart {
  constructor(scope: Construct, id: string, props: VClusterApplicationSetChartProps = {}) {
    super(scope, id, props);

    const branch = props.branch || 'main';
    const repoUrl = props.repoUrl || 'https://github.com/PittampalliOrg/cdk8s-project.git';
    const argocdNs = props.argocdNamespace || 'argocd';

    // Create vCluster configuration ConfigMap
    // This defines the vClusters to be created
    new k8s.KubeConfigMap(this, 'vcluster-configs', {
      metadata: {
        name: 'vcluster-configs',
        namespace: argocdNs,
        annotations: {
          'argocd.argoproj.io/sync-wave': '15'
        }
      },
      data: {
        'vclusters.yaml': `vclusters:
  - name: dev
    namespace: vcluster-dev
    chartVersion: "0.17.0"
    values:
      vcluster:
        image: rancher/k3s:v1.29.9-k3s1
      syncer:
        extraArgs:
          - "--tls-san=dev.vcluster-dev"
          - "--tls-san=dev.vcluster-dev.svc"
          - "--tls-san=dev.vcluster-dev.svc.cluster.local"
          - "--tls-san=localhost"
          - "--tls-san=127.0.0.1"
      storage:
        persistence: true
        size: 10Gi
      sync:
        nodes:
          enabled: false
        persistentvolumes:
          enabled: false
        storageclasses:
          enabled: false
        hoststorageclasses:
          enabled: true
        priorityclasses:
          enabled: false
        networkpolicies:
          enabled: false
        volumesnapshots:
          enabled: false
        poddisruptionbudgets:
          enabled: false
`
      }
    });

    // Create ApplicationSet for vClusters
    new ApplicationSet(this, 'vcluster-applicationset', {
      metadata: {
        name: 'vcluster-deployments',
        namespace: argocdNs,
        annotations: {
          'argocd.argoproj.io/sync-wave': '20'
        }
      },
      spec: {
        generators: [
          {
            list: {
              elements: [
                {
                  name: 'dev',
                  namespace: 'vcluster-dev',
                  chartVersion: '0.17.0'
                }
              ]
            }
          }
        ],
        template: {
          metadata: {
            name: 'vcluster-{{name}}',
            labels: {
              'app.kubernetes.io/instance': 'vcluster-{{name}}',
              'vcluster-instance': '{{name}}'
            }
          },
          spec: {
            project: 'default',
            destination: {
              name: 'in-cluster',
              namespace: '{{namespace}}'
            },
            source: {
              repoUrl: 'https://charts.loft.sh',
              targetRevision: '{{chartVersion}}',
              chart: 'vcluster',
              helm: {
                releaseName: '{{name}}',
                values: `vcluster:
  image: rancher/k3s:v1.29.9-k3s1
syncer:
  extraArgs:
    - "--tls-san={{name}}.{{namespace}}"
    - "--tls-san={{name}}.{{namespace}}.svc"
    - "--tls-san={{name}}.{{namespace}}.svc.cluster.local"
    - "--tls-san=localhost"
    - "--tls-san=127.0.0.1"
storage:
  persistence: true
  size: 10Gi
sync:
  nodes:
    enabled: false
  persistentvolumes:
    enabled: false
  storageclasses:
    enabled: false
  hoststorageclasses:
    enabled: true
  priorityclasses:
    enabled: false
  networkpolicies:
    enabled: false
  volumesnapshots:
    enabled: false
  poddisruptionbudgets:
    enabled: false`
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
        }
      }
    });

    // Note: vcluster-dev namespace is created by platform-core-chart.ts

    // Create registration job for vCluster
    this.createRegistrationJob('dev', 'vcluster-dev', argocdNs);
  }

  private createRegistrationJob(vclusterName: string, vclusterNamespace: string, argocdNamespace: string) {
    // Create ServiceAccount for registration
    new k8s.KubeServiceAccount(this, `vcluster-registrar-${vclusterName}`, {
      metadata: {
        name: 'vcluster-registrar',
        namespace: argocdNamespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '22'
        }
      }
    });

    // Create Role for accessing vCluster secret
    new k8s.KubeRole(this, `vcluster-secret-reader-${vclusterName}`, {
      metadata: {
        name: 'vcluster-secret-reader',
        namespace: vclusterNamespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '22'
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

    // Create RoleBinding in vCluster namespace
    new k8s.KubeRoleBinding(this, `vcluster-secret-reader-binding-${vclusterName}`, {
      metadata: {
        name: 'vcluster-secret-reader',
        namespace: vclusterNamespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '22'
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
          namespace: argocdNamespace
        }
      ]
    });

    // Create Role for registering cluster in ArgoCD
    new k8s.KubeRole(this, `vcluster-registrar-role-${vclusterName}`, {
      metadata: {
        name: 'vcluster-registrar',
        namespace: argocdNamespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '22'
        }
      },
      rules: [
        {
          apiGroups: [''],
          resources: ['secrets'],
          verbs: ['create', 'update', 'patch', 'get']
        }
      ]
    });

    // Create RoleBinding in ArgoCD namespace
    new k8s.KubeRoleBinding(this, `vcluster-registrar-binding-${vclusterName}`, {
      metadata: {
        name: 'vcluster-registrar',
        namespace: argocdNamespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '22'
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
          namespace: argocdNamespace
        }
      ]
    });

    // Create registration Job
    new k8s.KubeJob(this, `register-vcluster-${vclusterName}`, {
      metadata: {
        name: `register-vcluster-${vclusterName}`,
        namespace: argocdNamespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '25',
          'argocd.argoproj.io/hook': 'PostSync',
          'argocd.argoproj.io/hook-delete-policy': 'HookSucceeded'
        }
      },
      spec: {
        ttlSecondsAfterFinished: 600,
        template: {
          spec: {
            serviceAccountName: 'vcluster-registrar',
            restartPolicy: 'OnFailure',
            containers: [
              {
                name: 'register',
                image: 'bitnami/kubectl:1.28',
                command: ['/bin/bash'],
                args: [
                  '-c',
                  `#!/bin/bash
set -e

echo "Registering vCluster ${vclusterName} with ArgoCD..."

# Wait for vCluster to be ready
echo "Waiting for vCluster secret..."
for i in {1..60}; do
  if kubectl get secret vc-${vclusterName} -n ${vclusterNamespace} >/dev/null 2>&1; then
    echo "vCluster secret found"
    break
  fi
  echo "Waiting for vCluster secret... ($i/60)"
  sleep 5
done

# Extract vCluster credentials
echo "Extracting vCluster credentials..."
KUBECONFIG_DATA=$(kubectl get secret vc-${vclusterName} -n ${vclusterNamespace} -o jsonpath='{.data.config}')

# Create ArgoCD cluster secret
echo "Creating ArgoCD cluster secret..."
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: vcluster-${vclusterName}
  namespace: ${argocdNamespace}
  labels:
    argocd.argoproj.io/secret-type: cluster
    cluster-type: vcluster
    vcluster-instance: ${vclusterName}
type: Opaque
data:
  name: $(echo -n "vcluster-${vclusterName}" | base64 -w 0)
  server: $(echo -n "https://${vclusterName}.${vclusterNamespace}:443" | base64 -w 0)
  config: $KUBECONFIG_DATA
EOF

echo "vCluster ${vclusterName} registered successfully with ArgoCD"`
                ]
              }
            ]
          }
        }
      }
    });
  }
}