import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

/**
 * Kubernetes Dependency Tracker Deployment
 * This chart creates a direct Kubernetes deployment for the dependency tracker
 * since we cannot access the OCI registry
 */
export class K8sDependencyTrackerDeploymentChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const namespace = 'k8s-dependency-tracker';
    const appName = 'k8s-dependency-tracker';
    const serviceAccountName = 'k8s-dependency-tracker';

    // Namespace
    new k8s.KubeNamespace(this, 'namespace', {
      metadata: {
        name: namespace,
        labels: {
          'app.kubernetes.io/name': appName,
          'app.kubernetes.io/part-of': 'backstage-integration'
        }
      }
    });

    // ServiceAccount
    const serviceAccount = new k8s.KubeServiceAccount(this, 'service-account', {
      metadata: {
        name: serviceAccountName,
        namespace,
        labels: {
          'app.kubernetes.io/name': appName,
          'app.kubernetes.io/part-of': 'backstage-integration'
        }
      }
    });

    // ClusterRole for reading all resources
    const clusterRole = new k8s.KubeClusterRole(this, 'cluster-role', {
      metadata: {
        name: `${appName}-reader`,
        labels: {
          'app.kubernetes.io/name': appName,
          'app.kubernetes.io/part-of': 'backstage-integration'
        }
      },
      rules: [{
        apiGroups: ['*'],
        resources: ['*'],
        verbs: ['get', 'list', 'watch']
      }]
    });

    // ClusterRoleBinding
    new k8s.KubeClusterRoleBinding(this, 'cluster-role-binding', {
      metadata: {
        name: `${appName}-reader`,
        labels: {
          'app.kubernetes.io/name': appName,
          'app.kubernetes.io/part-of': 'backstage-integration'
        }
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: clusterRole.name
      },
      subjects: [{
        kind: 'ServiceAccount',
        name: serviceAccountName,
        namespace
      }]
    });

    // Deployment
    const deployment = new k8s.KubeDeployment(this, 'deployment', {
      metadata: {
        name: appName,
        namespace,
        labels: {
          'app.kubernetes.io/name': appName,
          'app.kubernetes.io/part-of': 'backstage-integration'
        }
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            'app.kubernetes.io/name': appName
          }
        },
        template: {
          metadata: {
            labels: {
              'app.kubernetes.io/name': appName,
              'app.kubernetes.io/part-of': 'backstage-integration'
            }
          },
          spec: {
            serviceAccountName,
            containers: [{
              name: 'dependency-tracker',
              image: 'ghcr.io/terasky-oss/kubernetes-dependency-tracker:0.1.0',
              command: ['/app/k8s-dependency-tracker'],
              imagePullPolicy: 'IfNotPresent',
              ports: [{
                containerPort: 8080,
                name: 'http',
                protocol: 'TCP'
              }],
              env: [
                {
                  name: 'LOG_LEVEL',
                  value: 'info'
                }
              ],
              resources: {
                limits: {
                  cpu: k8s.Quantity.fromString('500m'),
                  memory: k8s.Quantity.fromString('512Mi')
                },
                requests: {
                  cpu: k8s.Quantity.fromString('100m'),
                  memory: k8s.Quantity.fromString('128Mi')
                }
              },
              livenessProbe: {
                tcpSocket: {
                  port: k8s.IntOrString.fromNumber(8080)
                },
                initialDelaySeconds: 15,
                periodSeconds: 30
              },
              readinessProbe: {
                tcpSocket: {
                  port: k8s.IntOrString.fromNumber(8080)
                },
                initialDelaySeconds: 15,
                periodSeconds: 30
              },
              securityContext: {
                runAsNonRoot: true,
                runAsUser: 1000,
                allowPrivilegeEscalation: false,
                readOnlyRootFilesystem: true,
                capabilities: {
                  drop: ['ALL']
                }
              }
            }],
            securityContext: {
              runAsNonRoot: true,
              runAsUser: 1000,
              fsGroup: 1000
            }
          }
        }
      }
    });

    // Service
    new k8s.KubeService(this, 'service', {
      metadata: {
        name: appName,
        namespace,
        labels: {
          'app.kubernetes.io/name': appName,
          'app.kubernetes.io/part-of': 'backstage-integration'
        }
      },
      spec: {
        type: 'ClusterIP',
        selector: {
          'app.kubernetes.io/name': appName
        },
        ports: [{
          name: 'http',
          port: 8080,
          targetPort: k8s.IntOrString.fromNumber(8080),
          protocol: 'TCP'
        }]
      }
    });

    // Ingress
    new k8s.KubeIngress(this, 'ingress', {
      metadata: {
        name: appName,
        namespace,
        labels: {
          'app.kubernetes.io/name': appName,
          'app.kubernetes.io/part-of': 'backstage-integration'
        },
        annotations: {
          'nginx.ingress.kubernetes.io/rewrite-target': '/'
        }
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [{
          host: `k8s-dependency-tracker.${process.env.INGRESS_HOST || 'localtest.me'}`,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: appName,
                  port: {
                    number: 8080
                  }
                }
              }
            }]
          }
        }],
        tls: process.env.ENABLE_TLS === 'true' ? [{
          hosts: [`k8s-dependency-tracker.${process.env.INGRESS_HOST || 'localtest.me'}`],
          secretName: `${appName}-tls`
        }] : undefined
      }
    });
  }
}