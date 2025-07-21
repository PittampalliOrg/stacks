import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';
import { Quantity, IntOrString } from '../imports/k8s';
import { SyncWaves } from '../lib/sync-waves';
import { addSyncWave, configureCRDDependentResource } from '../lib/argocd-helpers';

export interface FlagdServiceChartProps extends ChartProps {
  namespace?: string;
  enableServiceMonitor?: boolean;
}

/**
 * Flagd Service Chart
 * Deploys a centralized flagd service that watches FeatureFlag CRDs
 * and provides feature flag evaluation for all services
 */
export class FlagdServiceChart extends Chart {
  constructor(scope: Construct, id: string, props: FlagdServiceChartProps = {}) {
    super(scope, id, props);

    const namespace = props.namespace || 'default';
    const enableServiceMonitor = props.enableServiceMonitor ?? false;

    // Create ServiceAccount for flagd
    const serviceAccount = new k8s.KubeServiceAccount(this, 'flagd-sa', {
      metadata: {
        name: 'flagd',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'flagd',
          'app.kubernetes.io/component': 'feature-flags',
        },
      },
    });

    // Create ClusterRole for reading FeatureFlag CRDs across all namespaces
    const clusterRole = new k8s.KubeClusterRole(this, 'flagd-cluster-role', {
      metadata: {
        name: 'flagd-featureflag-reader',
        labels: {
          'app.kubernetes.io/name': 'flagd',
          'app.kubernetes.io/component': 'feature-flags',
        },
      },
      rules: [{
        apiGroups: ['core.openfeature.dev'],
        resources: ['featureflags'],
        verbs: ['get', 'list', 'watch'],
      }],
    });

    // Bind ClusterRole to ServiceAccount
    new k8s.KubeClusterRoleBinding(this, 'flagd-cluster-rolebinding', {
      metadata: {
        name: 'flagd-featureflag-reader',
        labels: {
          'app.kubernetes.io/name': 'flagd',
          'app.kubernetes.io/component': 'feature-flags',
        },
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: clusterRole.metadata.name!,
      },
      subjects: [{
        kind: 'ServiceAccount',
        name: serviceAccount.metadata.name!,
        namespace,
      }],
    });

    // Create Deployment for flagd
    const deployment = new k8s.KubeDeployment(this, 'flagd-deployment', {
      metadata: {
        name: 'flagd',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'flagd',
          'app.kubernetes.io/component': 'feature-flags',
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
            'app.kubernetes.io/name': 'flagd',
            'app.kubernetes.io/component': 'feature-flags',
          },
        },
        template: {
          metadata: {
            labels: {
              'app.kubernetes.io/name': 'flagd',
              'app.kubernetes.io/component': 'feature-flags',
            },
            annotations: {
              'prometheus.io/scrape': 'true',
              'prometheus.io/port': '8014',
              'prometheus.io/path': '/metrics',
            },
          },
          spec: {
            serviceAccountName: serviceAccount.metadata.name,
            containers: [{
              name: 'flagd',
              image: 'ghcr.io/open-feature/flagd:v0.11.1',
              imagePullPolicy: 'IfNotPresent',
              command: [
                '/flagd-build',
                'start',
                '--port', '8013',
                '--ofrep-port', '8016',
                '--management-port', '8014',
                '--uri', 'core.openfeature.dev/default/cdk8s-env-config',
                '--uri', 'core.openfeature.dev/default/nextjs-app-features',
                '--uri', 'core.openfeature.dev/default/demo-flags',
                '--log-format', 'console',
                '--otel-collector-uri', 'alloy.monitoring:4317',
              ],
              ports: [
                {
                  containerPort: 8013,
                  name: 'grpc',
                  protocol: 'TCP',
                },
                {
                  containerPort: 8016,
                  name: 'ofrep',
                  protocol: 'TCP',
                },
                {
                  containerPort: 8014,
                  name: 'metrics',
                  protocol: 'TCP',
                },
              ],
              env: [
                {
                  name: 'FLAGD_METRICS_EXPORTER',
                  value: 'otel',
                },
                {
                  name: 'FLAGD_OTEL_COLLECTOR_URI',
                  value: 'alloy.monitoring:4317',
                },
              ],
              livenessProbe: {
                httpGet: {
                  path: '/healthz',
                  port: IntOrString.fromNumber(8014),
                },
                initialDelaySeconds: 10,
                periodSeconds: 30,
              },
              readinessProbe: {
                httpGet: {
                  path: '/readyz',
                  port: IntOrString.fromNumber(8014),
                },
                initialDelaySeconds: 5,
                periodSeconds: 10,
              },
              resources: {
                requests: {
                  cpu: Quantity.fromString('50m'),
                  memory: Quantity.fromString('64Mi'),
                },
                limits: {
                  cpu: Quantity.fromString('200m'),
                  memory: Quantity.fromString('256Mi'),
                },
              },
            }],
          },
        },
      },
    });

    // Create Service for flagd
    const service = new k8s.KubeService(this, 'flagd-service', {
      metadata: {
        name: 'flagd',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'flagd',
          'app.kubernetes.io/component': 'feature-flags',
        },
      },
      spec: {
        type: 'ClusterIP',
        selector: {
          'app.kubernetes.io/name': 'flagd',
          'app.kubernetes.io/component': 'feature-flags',
        },
        ports: [
          {
            port: 8013,
            targetPort: IntOrString.fromNumber(8013),
            protocol: 'TCP',
            name: 'grpc',
          },
          {
            port: 8016,
            targetPort: IntOrString.fromNumber(8016),
            protocol: 'TCP',
            name: 'ofrep',
          },
          {
            port: 8014,
            targetPort: IntOrString.fromNumber(8014),
            protocol: 'TCP',
            name: 'metrics',
          },
        ],
      },
    });

    // Create ServiceMonitor for Prometheus scraping (if monitoring is enabled)
    if (enableServiceMonitor) {
      const serviceMonitor = new ApiObject(this, 'flagd-servicemonitor', {
        apiVersion: 'monitoring.coreos.com/v1',
        kind: 'ServiceMonitor',
        metadata: {
          name: 'flagd',
          namespace,
          labels: {
            'app.kubernetes.io/name': 'flagd',
            'app.kubernetes.io/component': 'feature-flags',
            'prometheus': 'kube-prometheus', // Adjust based on your Prometheus operator labels
          },
          annotations: {
            'argocd.argoproj.io/sync-wave': SyncWaves.SERVICE_MONITORS.toString(),
            'argocd.argoproj.io/sync-options': 'SkipDryRunOnMissingResource=true',
          },
        },
        spec: {
          selector: {
            matchLabels: {
              'app.kubernetes.io/name': 'flagd',
              'app.kubernetes.io/component': 'feature-flags',
            },
          },
          endpoints: [{
            port: 'metrics',
            interval: '30s',
            path: '/metrics',
          }],
        },
      });
      
    }

    // Create NetworkPolicy for flagd (optional, for security)
    new k8s.KubeNetworkPolicy(this, 'flagd-network-policy', {
      metadata: {
        name: 'flagd',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'flagd',
          'app.kubernetes.io/component': 'feature-flags',
        },
      },
      spec: {
        podSelector: {
          matchLabels: {
            'app.kubernetes.io/name': 'flagd',
            'app.kubernetes.io/component': 'feature-flags',
          },
        },
        policyTypes: ['Ingress', 'Egress'],
        ingress: [
          {
            // Allow traffic from any pod in the cluster to flagd ports
            ports: [
              { port: IntOrString.fromNumber(8013), protocol: 'TCP' }, // gRPC
              { port: IntOrString.fromNumber(8016), protocol: 'TCP' }, // OFREP
              { port: IntOrString.fromNumber(8014), protocol: 'TCP' }, // Metrics
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
            // Allow access to Kubernetes API server (AKS compatible)
            // In AKS, the API server is external, so we need to allow HTTPS to any IP
            ports: [
              { port: IntOrString.fromNumber(443), protocol: 'TCP' },
            ],
          },
          {
            // Allow connection to Alloy for OpenTelemetry
            to: [{
              namespaceSelector: {
                matchLabels: {
                  'kubernetes.io/metadata.name': 'monitoring',
                },
              },
              podSelector: {
                matchLabels: {
                  'app.kubernetes.io/name': 'alloy',
                },
              },
            }],
            ports: [
              { port: IntOrString.fromNumber(4317), protocol: 'TCP' }, // OTLP gRPC
            ],
          },
        ],
      },
    });


    // Create HPA for autoscaling (disabled for local development)
    // Note: HPA requires metrics-server to be installed in the cluster
    // Uncomment the following block if you have metrics-server installed
    /*
    const hpa = new ApiObject(this, 'flagd-hpa', {
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: {
        name: 'flagd',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'flagd',
          'app.kubernetes.io/component': 'feature-flags',
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