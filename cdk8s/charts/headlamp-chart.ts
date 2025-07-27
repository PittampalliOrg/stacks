import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

export interface HeadlampChartProps extends ChartProps {
  // Additional props can be added here as needed
}

/**
 * Headlamp Kubernetes Dashboard Chart
 * Deploys Headlamp with Keycloak OIDC authentication
 */
export class HeadlampChart extends Chart {
  constructor(scope: Construct, id: string, props: HeadlampChartProps = {}) {
    super(scope, id, props);

    const namespace = 'headlamp';
    const appName = 'headlamp';
    const ingressHost = process.env.INGRESS_HOST || 'cnoe.localtest.me';
    const keycloakUrl = process.env.KEYCLOAK_URL || 'https://cnoe.localtest.me:8443/keycloak';
    const keycloakRealm = process.env.KEYCLOAK_REALM || 'cnoe';

    // Create namespace
    new k8s.KubeNamespace(this, 'headlamp-namespace', {
      metadata: {
        name: namespace,
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'app.kubernetes.io/name': 'headlamp',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-20',
        },
      },
    });

    // ServiceAccount
    new k8s.KubeServiceAccount(this, 'headlamp-sa', {
      metadata: {
        name: appName,
        namespace,
        labels: {
          'app.kubernetes.io/name': appName,
        },
      },
    });

    // ClusterRoleBinding
    new k8s.KubeClusterRoleBinding(this, 'headlamp-crb', {
      metadata: {
        name: `${appName}-admin`,
        labels: {
          'app.kubernetes.io/name': appName,
        },
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: 'cluster-admin',
      },
      subjects: [{
        kind: 'ServiceAccount',
        name: appName,
        namespace,
      }],
    });

    // Deployment
    new k8s.KubeDeployment(this, 'headlamp-deployment', {
      metadata: {
        name: appName,
        namespace,
        labels: {
          'app.kubernetes.io/name': appName,
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            'app.kubernetes.io/name': appName,
          },
        },
        template: {
          metadata: {
            labels: {
              'app.kubernetes.io/name': appName,
            },
          },
          spec: {
            serviceAccountName: appName,
            securityContext: {
              runAsNonRoot: true,
              runAsUser: 100,
              fsGroup: 101,
            },
            containers: [{
              name: appName,
              image: 'ghcr.io/headlamp-k8s/headlamp:v0.33.0',
              imagePullPolicy: 'IfNotPresent',
              command: [
                '/headlamp/headlamp-server',
                '-in-cluster',
                '-html-static-dir', '/headlamp/frontend',
              ],
              ports: [{
                containerPort: 4466,
                name: 'http',
                protocol: 'TCP',
              }],
              env: [
                {
                  name: 'SSL_CERT_FILE',
                  value: '/etc/ssl/certs/ca.crt',
                },
              ],
              volumeMounts: [{
                name: 'ca-cert',
                mountPath: '/etc/ssl/certs',
                readOnly: true,
              }],
              resources: {
                requests: {
                  cpu: k8s.Quantity.fromString('100m'),
                  memory: k8s.Quantity.fromString('128Mi'),
                },
                limits: {
                  cpu: k8s.Quantity.fromString('500m'),
                  memory: k8s.Quantity.fromString('512Mi'),
                },
              },
              securityContext: {
                allowPrivilegeEscalation: false,
                readOnlyRootFilesystem: false,
                runAsNonRoot: true,
                runAsUser: 100,
                capabilities: {
                  drop: ['ALL'],
                },
              },
              livenessProbe: {
                httpGet: {
                  path: '/',
                  port: k8s.IntOrString.fromString('http'),
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
              },
              readinessProbe: {
                httpGet: {
                  path: '/',
                  port: k8s.IntOrString.fromString('http'),
                },
                initialDelaySeconds: 5,
                periodSeconds: 5,
              },
            }],
            volumes: [{
              name: 'ca-cert',
              secret: {
                secretName: 'idpbuilder-cert',
                defaultMode: 0o644,
              },
            }],
          },
        },
      },
    });

    // Service
    new k8s.KubeService(this, 'headlamp-service', {
      metadata: {
        name: appName,
        namespace,
        labels: {
          'app.kubernetes.io/name': appName,
        },
      },
      spec: {
        type: 'ClusterIP',
        ports: [{
          port: 80,
          targetPort: k8s.IntOrString.fromString('http'),
          protocol: 'TCP',
          name: 'http',
        }],
        selector: {
          'app.kubernetes.io/name': appName,
        },
      },
    });

    // Ingress
    new k8s.KubeIngress(this, 'headlamp-ingress', {
      metadata: {
        name: appName,
        namespace,
        annotations: {
          'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [{
          host: `headlamp.${ingressHost}`,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: appName,
                  port: {
                    number: 80,
                  },
                },
              },
            }],
          },
        }],
      },
    });
  }
}