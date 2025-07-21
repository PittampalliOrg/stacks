import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { Application } from '../imports/argoproj.io';

export interface CrdProvidersChartProps extends ChartProps {}

/**
 * CRD Providers Chart
 * Installs all Custom Resource Definition providers required by the platform
 * These must be installed before any resources that depend on their CRDs
 */
export class CrdProvidersChart extends Chart {
  constructor(scope: Construct, id: string, props?: CrdProvidersChartProps) {
    super(scope, id, props);

    // Cert Manager Application - Provides Certificate CRDs (required by Kargo)
    const certManagerApp = new Application(this, 'cert-manager', {
      metadata: {
        name: 'cert-manager',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-295'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
        repoUrl: 'https://charts.jetstack.io',
          targetRevision: 'v1.15.1',
          chart: 'cert-manager',
          helm: {
            releaseName: 'cert-manager',
            values: JSON.stringify({
              installCRDs: true,
              namespace: 'cert-manager',
              global: {
                leaderElection: {
                  namespace: 'cert-manager'
                }
              }
            }, null, 2)
          }
        },
        destination: {
          name: 'in-cluster',
          namespace: 'cert-manager'
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
              duration: '5s',
              factor: 2,
              maxDuration: '3m'
            }
          }
        },
        revisionHistoryLimit: 3
      }
    });

    // Argo Workflows Application - Provides WorkflowTemplate and ClusterWorkflowTemplate CRDs
    const argoWorkflowsApp = new Application(this, 'argo-workflows', {
      metadata: {
        name: 'argo-workflows',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-290'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
        repoUrl: 'https://argoproj.github.io/argo-helm',
          targetRevision: '0.41.1',
          chart: 'argo-workflows',
          helm: {
            releaseName: 'argo-workflows',
            values: JSON.stringify({
              namespace: 'argo',
              createNamespace: true,
              singleNamespace: false,
              workflow: {
                serviceAccount: {
                  create: true,
                  name: 'argo-workflow'
                }
              },
              controller: {
                workflowNamespaces: ['argo'],
                containerRuntimeExecutor: 'k8sapi',
                resourceRateLimit: {
                  limit: 10,
                  burst: 1
                }
              },
              server: {
                enabled: true,
                authMode: 'server',
                extraArgs: ['--auth-mode=server'],
                service: {
                  type: 'ClusterIP',
                  port: 2746
                }
              }
            }, null, 2)
          }
        },
        destination: {
          name: 'in-cluster',
          namespace: 'argo'
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
              duration: '5s',
              factor: 2,
              maxDuration: '3m'
            }
          }
        },
        revisionHistoryLimit: 3
      }
    });

    // OpenFeature Operator Application - Provides FeatureFlag CRDs
    const openFeatureOperatorApp = new Application(this, 'openfeature-operator', {
      metadata: {
        name: 'openfeature-operator',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-280'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
        repoUrl: 'https://open-feature.github.io/open-feature-operator',
          targetRevision: 'v0.8.0',
          chart: 'open-feature-operator',
          helm: {
            releaseName: 'openfeature-operator',
            values: JSON.stringify({
              controllerManager: {
                manager: {
                  image: {
                    repository: 'ghcr.io/open-feature/open-feature-operator',
                    tag: 'v0.8.0'
                  }
                }
              }
            }, null, 2)
          }
        },
        destination: {
          name: 'in-cluster',
          namespace: 'open-feature-operator-system'
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
              duration: '5s',
              factor: 2,
              maxDuration: '3m'
            }
          }
        },
        revisionHistoryLimit: 3
      }
    });

    // Kagent Application - AI Platform providing Agent, ModelConfig, and ToolServer CRDs
    const kagentApp = new Application(this, 'kagent', {
      metadata: {
        name: 'kagent',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-275'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
        repoUrl: 'ghcr.io/kagent-dev/kagent/helm',
          targetRevision: '0.1.9',
          chart: 'kagent',
          helm: {
            releaseName: 'kagent',
            values: JSON.stringify({
              namespace: 'kagent',
              installCRDs: true
            }, null, 2)
          }
        },
        destination: {
          name: 'in-cluster',
          namespace: 'kagent'
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
              duration: '5s',
              factor: 2,
              maxDuration: '3m'
            }
          }
        },
        revisionHistoryLimit: 3
      }
    });

    // Gateway API Application - Provides Gateway, HTTPRoute, and other Gateway API CRDs
    const gatewayApiApp = new Application(this, 'gateway-api', {
      metadata: {
        name: 'gateway-api',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-285'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
        repoUrl: 'https://github.com/kubernetes-sigs/gateway-api',
          targetRevision: 'v1.2.1',
          path: 'config/crd/standard'
        },
        destination: {
          name: 'in-cluster'
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
            'Replace=true'
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