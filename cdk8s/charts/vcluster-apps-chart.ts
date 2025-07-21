import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { ApiObject } from 'cdk8s';

export interface VClusterAppsChartProps extends ChartProps {
  targetCluster?: string;
  gitBranch?: string;
}

/**
 * VCluster Applications Chart
 * Deploys application workloads to vcluster via ArgoCD Applications
 */
export class VClusterAppsChart extends Chart {
  constructor(scope: Construct, id: string, props: VClusterAppsChartProps = {}) {
    super(scope, id, props);

    const targetCluster = props.targetCluster || 'in-cluster';
    const gitBranch = props.gitBranch || 'app';

    // PostgreSQL Application
    new ApiObject(this, 'postgres', {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: 'postgres',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'app.kubernetes.io/part-of': 'vcluster-apps'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '30'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
          repoURL: 'https://github.com/PittampalliOrg/cdk8s-project.git',
          targetRevision: gitBranch,
          path: 'dist',
          directory: {
            include: '0012-postgres.k8s.yaml'
          }
        },
        destination: {
          name: targetCluster,
          namespace: 'nextjs'
        },
        syncPolicy: {
          automated: {
            prune: true,
            selfHeal: false,
            allowEmpty: false
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
        revisionHistoryLimit: 3
      }
    });

    // Redis Application
    new ApiObject(this, 'redis', {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: 'redis',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'app.kubernetes.io/part-of': 'vcluster-apps'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '30'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
          repoURL: 'https://github.com/PittampalliOrg/cdk8s-project.git',
          targetRevision: gitBranch,
          path: 'dist',
          directory: {
            include: '0013-redis.k8s.yaml'
          }
        },
        destination: {
          name: targetCluster,
          namespace: 'nextjs'
        },
        syncPolicy: {
          automated: {
            prune: true,
            selfHeal: false,
            allowEmpty: false
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
        revisionHistoryLimit: 3
      }
    });

    // Alloy Application (for monitoring)
    new ApiObject(this, 'alloy', {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: 'alloy',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'app.kubernetes.io/part-of': 'vcluster-apps'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '31'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
          repoURL: 'https://github.com/PittampalliOrg/cdk8s-project.git',
          targetRevision: gitBranch,
          path: 'dist',
          directory: {
            include: '0014-alloy.k8s.yaml'
          }
        },
        destination: {
          name: targetCluster,
          namespace: 'monitoring'
        },
        syncPolicy: {
          automated: {
            prune: true,
            selfHeal: false,
            allowEmpty: false
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
        revisionHistoryLimit: 3
      }
    });

    // Grafana UI Application
    new ApiObject(this, 'grafana-ui', {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: 'grafana-ui',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'app.kubernetes.io/part-of': 'vcluster-apps'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '32'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
          repoURL: 'https://github.com/PittampalliOrg/cdk8s-project.git',
          targetRevision: gitBranch,
          path: 'dist',
          directory: {
            include: '0011-grafana-ui.k8s.yaml'
          }
        },
        destination: {
          name: targetCluster,
          namespace: 'monitoring'
        },
        syncPolicy: {
          automated: {
            prune: true,
            selfHeal: false,
            allowEmpty: false
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
        revisionHistoryLimit: 3
      }
    });

    // NextJS Application
    new ApiObject(this, 'nextjs', {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: 'nextjs',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'app.kubernetes.io/part-of': 'vcluster-apps'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '35'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
          repoURL: 'https://github.com/PittampalliOrg/cdk8s-project.git',
          targetRevision: gitBranch,
          path: 'dist',
          directory: {
            include: '0015-nextjs.k8s.yaml'
          }
        },
        destination: {
          name: targetCluster,
          namespace: 'nextjs'
        },
        syncPolicy: {
          automated: {
            prune: true,
            selfHeal: false,
            allowEmpty: false
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
        revisionHistoryLimit: 3
      }
    });
  }
}