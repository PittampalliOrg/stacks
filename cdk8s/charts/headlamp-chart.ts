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
    const keycloakUrl = process.env.KEYCLOAK_URL || 'https://cnoe.localtest.me/keycloak';
    const keycloakRealm = process.env.KEYCLOAK_REALM || 'idpbuilder';

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
                '-base-url', '/headlamp',
                '-html-static-dir', '/headlamp/frontend',
                '-oidc-client-id', '$(OIDC_CLIENT_ID)',
                '-oidc-client-secret', '$(OIDC_CLIENT_SECRET)',
                '-oidc-idp-issuer-url', `${keycloakUrl}/realms/${keycloakRealm}`,
                '-oidc-scopes', 'email,profile',
              ],
              ports: [{
                containerPort: 4466,
                name: 'http',
                protocol: 'TCP',
              }],
              env: [
                {
                  name: 'OIDC_CLIENT_ID',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'headlamp-oidc-secrets',
                      key: 'OIDC_CLIENT_ID',
                    },
                  },
                },
                {
                  name: 'OIDC_CLIENT_SECRET',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'headlamp-oidc-secrets',
                      key: 'OIDC_CLIENT_SECRET',
                    },
                  },
                },
              ],
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
                  path: '/headlamp/',
                  port: k8s.IntOrString.fromString('http'),
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
              },
              readinessProbe: {
                httpGet: {
                  path: '/headlamp/',
                  port: k8s.IntOrString.fromString('http'),
                },
                initialDelaySeconds: 5,
                periodSeconds: 5,
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
        labels: {
          'app.kubernetes.io/name': appName,
        },
        annotations: {
          'nginx.ingress.kubernetes.io/backend-protocol': 'HTTP',
          'nginx.ingress.kubernetes.io/use-regex': 'true',
          'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
          'nginx.ingress.kubernetes.io/force-ssl-redirect': 'true',
          'nginx.ingress.kubernetes.io/proxy-body-size': '100m',
          'nginx.ingress.kubernetes.io/proxy-read-timeout': '600',
          'nginx.ingress.kubernetes.io/proxy-send-timeout': '600',
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [{
          host: ingressHost,
          http: {
            paths: [{
              path: '/headlamp(/|$)(.*)',
              pathType: 'ImplementationSpecific',
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
        tls: [{
          hosts: [ingressHost],
          secretName: 'headlamp-tls',
        }],
      },
    });
  }
}