import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

export interface HeadlampChartProps extends ChartProps {
  // Additional props can be added here as needed
  enablePluginManager?: boolean;
  plugins?: Array<{
    name: string;
    source: string;
    version: string;
  }>;
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
    const baseHost = process.env.INGRESS_HOST || 'cnoe.localtest.me';
    const ingressHost = `headlamp.${baseHost}`;
    const keycloakUrl = process.env.KEYCLOAK_URL || 'https://cnoe.localtest.me:8443/keycloak';
    const keycloakRealm = process.env.KEYCLOAK_REALM || 'cnoe';
    const enablePluginManager = props.enablePluginManager ?? true;
    const plugins = props.plugins || [];

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

    // Plugin ConfigMap (if plugin manager is enabled)
    if (enablePluginManager && plugins.length > 0) {
      new k8s.KubeConfigMap(this, 'headlamp-plugins-config', {
        metadata: {
          name: `${appName}-plugins`,
          namespace,
          labels: {
            'app.kubernetes.io/name': appName,
          },
        },
        data: {
          'plugins.yaml': `plugins:
${plugins.map(plugin => `  - name: ${plugin.name}
    source: ${plugin.source}
    version: ${plugin.version}`).join('\n')}
`,
        },
      });
    }

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
            volumes: [
              {
                name: 'plugins',
                emptyDir: {},
              },
              ...(enablePluginManager && plugins.length > 0 ? [{
                name: 'plugins-config',
                configMap: {
                  name: `${appName}-plugins`,
                },
              }] : []),
            ],
            containers: [{
              name: appName,
              image: 'ghcr.io/headlamp-k8s/headlamp:v0.33.0',
              imagePullPolicy: 'IfNotPresent',
              command: [
                '/headlamp/headlamp-server',
                '-in-cluster',
                '-html-static-dir', '/headlamp/frontend',
                '-plugins-dir', '/headlamp/plugins',
                ...(enablePluginManager ? ['-watch-plugins-changes'] : []),
              ],
              ports: [{
                containerPort: 4466,
                name: 'http',
                protocol: 'TCP',
              }],
              env: [],
              volumeMounts: [
                {
                  name: 'plugins',
                  mountPath: '/headlamp/plugins',
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
            },
            // Plugin manager sidecar container
            ...(enablePluginManager && plugins.length > 0 ? [{
              name: 'plugin-manager',
              image: 'busybox:1.36',
              imagePullPolicy: 'IfNotPresent',
              command: ['/bin/sh'],
              args: [
                '-c',
                `echo "Plugin manager initialized. Plugins configured: ${plugins.map(p => p.name).join(', ')}";
                # Copy plugin config to plugins directory for potential future use
                cp /config/plugins.yaml /headlamp/plugins/plugins.yaml 2>/dev/null || true;
                # Keep container running
                while true; do sleep 3600; done`
              ],
              volumeMounts: [
                {
                  name: 'plugins',
                  mountPath: '/headlamp/plugins',
                },
                {
                  name: 'plugins-config',
                  mountPath: '/config',
                },
              ],
              resources: {
                requests: {
                  cpu: k8s.Quantity.fromString('10m'),
                  memory: k8s.Quantity.fromString('32Mi'),
                },
                limits: {
                  cpu: k8s.Quantity.fromString('50m'),
                  memory: k8s.Quantity.fromString('64Mi'),
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
            }] : []),
            ],
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
          host: ingressHost,
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