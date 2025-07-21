import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';
import { Quantity, IntOrString } from '../imports/k8s';
import { SyncWaves } from '../lib/sync-waves';
import { addSyncWave } from '../lib/argocd-helpers';
import { getImage } from '../lib/image-loader';

export interface FlagdUiNextJsChartProps extends ChartProps {
  namespace?: string;
  imageTag?: string;
}

/**
 * Flagd UI Next.js Chart
 * Deploys the Next.js-based flagd UI for managing FeatureFlag CRDs
 */
export class FlagdUiNextJsChart extends Chart {
  constructor(scope: Construct, id: string, props: FlagdUiNextJsChartProps = {}) {
    super(scope, id, props);

    const namespace = props.namespace || 'default';
    const imageTag = props.imageTag || getImage('flagdUi');

    // Create ServiceAccount with permissions to read/write FeatureFlag CRDs
    const serviceAccount = new k8s.KubeServiceAccount(this, 'flagd-ui-nextjs-sa', {
      metadata: {
        name: 'flagd-ui-nextjs',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'flagd-ui-nextjs',
          'app.kubernetes.io/component': 'ui',
        },
      },
    });

    // Note: The ClusterRole 'flagd-ui-nextjs-editor' is created in platform-core-chart
    // to avoid conflicts when multiple environment apps try to create the same ClusterRole

    // Bind the shared ClusterRole to this environment's ServiceAccount
    new k8s.KubeClusterRoleBinding(this, 'flagd-ui-nextjs-clusterrolebinding', {
      metadata: {
        name: `flagd-ui-nextjs-editor-${namespace}`, // Unique name per environment
        labels: {
          'app.kubernetes.io/name': 'flagd-ui-nextjs',
          'app.kubernetes.io/component': 'ui',
          'app.kubernetes.io/instance': namespace,
        },
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: 'flagd-ui-nextjs-editor', // Reference the shared ClusterRole
      },
      subjects: [{
        kind: 'ServiceAccount',
        name: serviceAccount.metadata.name!,
        namespace,
      }],
    });

    // Create Deployment for the Next.js UI
    const deployment = new k8s.KubeDeployment(this, 'flagd-ui-nextjs-deployment', {
      metadata: {
        name: 'flagd-ui-nextjs',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'flagd-ui-nextjs',
          'app.kubernetes.io/component': 'ui',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': SyncWaves.APPLICATIONS.toString(),
        },
      },
      spec: {
        replicas: 1,
        revisionHistoryLimit: 3,
        selector: {
          matchLabels: {
            'app.kubernetes.io/name': 'flagd-ui-nextjs',
            'app.kubernetes.io/component': 'ui',
          },
        },
        template: {
          metadata: {
            labels: {
              'app.kubernetes.io/name': 'flagd-ui-nextjs',
              'app.kubernetes.io/component': 'ui',
            },
          },
          spec: {
            serviceAccountName: serviceAccount.metadata.name,
            containers: [{
              name: 'flagd-ui',
              image: imageTag.includes(':') ? imageTag : `vpittamp.azurecr.io/flagd-ui:${imageTag}`,
              imagePullPolicy: 'Always',
              ports: [{
                containerPort: 4000,
                name: 'http',
                protocol: 'TCP',
              }],
              env: [
                {
                  name: 'NODE_ENV',
                  value: 'production',
                },
                {
                  name: 'PORT',
                  value: '4000',
                },
              ],
              livenessProbe: {
                httpGet: {
                  path: '/feature',
                  port: IntOrString.fromNumber(4000),
                },
                initialDelaySeconds: 30,
                periodSeconds: 30,
              },
              readinessProbe: {
                httpGet: {
                  path: '/feature',
                  port: IntOrString.fromNumber(4000),
                },
                initialDelaySeconds: 10,
                periodSeconds: 10,
              },
              resources: {
                requests: {
                  cpu: Quantity.fromString('100m'),
                  memory: Quantity.fromString('256Mi'),
                },
                limits: {
                  cpu: Quantity.fromString('500m'),
                  memory: Quantity.fromString('512Mi'),
                },
              },
            }],
            imagePullSecrets: [{
              name: 'vpittamp-acr-dockercfg',
            }],
          },
        },
      },
    });

    // Create Service
    const service = new k8s.KubeService(this, 'flagd-ui-nextjs-service', {
      metadata: {
        name: 'flagd-ui-nextjs',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'flagd-ui-nextjs',
          'app.kubernetes.io/component': 'ui',
        },
      },
      spec: {
        selector: {
          'app.kubernetes.io/name': 'flagd-ui-nextjs',
          'app.kubernetes.io/component': 'ui',
        },
        ports: [{
          port: 80,
          targetPort: IntOrString.fromNumber(4000),
          protocol: 'TCP',
          name: 'http',
        }],
        type: 'ClusterIP',
      },
    });

    // Create Ingress
    new k8s.KubeIngress(this, 'flagd-ui-nextjs-ingress', {
      metadata: {
        name: 'flagd-ui-nextjs',
        namespace,
        annotations: {
          'nginx.ingress.kubernetes.io/ssl-redirect': 'false',
          'nginx.ingress.kubernetes.io/use-regex': 'true',
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [
          {
            host: `flagd.${process.env.INGRESS_HOST || 'localtest.me'}`,
            http: {
              paths: [{
                path: '/feature(/|$)(.*)',
                pathType: 'ImplementationSpecific',
                backend: {
                  service: {
                    name: service.metadata.name!,
                    port: {
                      number: 80,
                    },
                  },
                },
              }],
            },
          },
        ],
      },
    });

    // Create NetworkPolicy
    new k8s.KubeNetworkPolicy(this, 'flagd-ui-nextjs-network-policy', {
      metadata: {
        name: 'flagd-ui-nextjs',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'flagd-ui-nextjs',
          'app.kubernetes.io/component': 'ui',
        },
      },
      spec: {
        podSelector: {
          matchLabels: {
            'app.kubernetes.io/name': 'flagd-ui-nextjs',
            'app.kubernetes.io/component': 'ui',
          },
        },
        policyTypes: ['Ingress', 'Egress'],
        ingress: [
          {
            // Allow traffic from ingress controller
            ports: [
              { port: IntOrString.fromNumber(4000), protocol: 'TCP' },
            ],
          },
        ],
        egress: [
          {
            // Allow DNS resolution
            to: [{
              namespaceSelector: {
                matchLabels: {
                  'kubernetes.io/metadata.name': 'kube-system',
                },
              },
              podSelector: {
                matchLabels: {
                  'k8s-app': 'kube-dns',
                },
              },
            }],
            ports: [
              { port: IntOrString.fromNumber(53), protocol: 'UDP' },
              { port: IntOrString.fromNumber(53), protocol: 'TCP' },
            ],
          },
          {
            // Allow access to Kubernetes API for CRD operations
            to: [{
              podSelector: {},
              namespaceSelector: {
                matchLabels: {
                  'kubernetes.io/metadata.name': 'default',
                },
              },
            }],
            ports: [
              { port: IntOrString.fromNumber(443), protocol: 'TCP' },
              { port: IntOrString.fromNumber(6443), protocol: 'TCP' },
            ],
          },
        ],
      },
    });


    // Create HPA for autoscaling (disabled for local development)
    // Note: HPA requires metrics-server to be installed in the cluster
    // Uncomment the following block if you have metrics-server installed
    /*
    const hpa = new ApiObject(this, 'flagd-ui-nextjs-hpa', {
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: {
        name: 'flagd-ui-nextjs',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'flagd-ui-nextjs',
          'app.kubernetes.io/component': 'ui',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': SyncWaves.HPAS.toString(),
        },
      },
      spec: {
        scaleTargetRef: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          name: deployment.metadata.name!,
        },
        minReplicas: 1,
        maxReplicas: 3,
        metrics: [
          {
            type: 'Resource',
            resource: {
              name: 'cpu',
              target: {
                type: 'Utilization',
                averageUtilization: 80,
              },
            },
          },
          {
            type: 'Resource',
            resource: {
              name: 'memory',
              target: {
                type: 'Utilization',
                averageUtilization: 80,
              },
            },
          },
        ],
      },
    });
    */
    
  }
}