import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';
import { KubeStatefulSet } from '../imports/k8s';

export class PrometheusChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    const namespace = 'monitoring';

    // Create ServiceAccount for Prometheus
    new k8s.KubeServiceAccount(this, 'prometheus-sa', {
      metadata: {
        name: 'prometheus',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'prometheus',
          'app.kubernetes.io/component': 'metrics',
          'app.kubernetes.io/part-of': 'monitoring',
        },
      },
    });

    // Create ClusterRole for Prometheus
    new k8s.KubeClusterRole(this, 'prometheus-cluster-role', {
      metadata: {
        name: 'prometheus',
        labels: {
          'app.kubernetes.io/name': 'prometheus',
        },
      },
      rules: [
        {
          apiGroups: [''],
          resources: ['nodes', 'nodes/proxy', 'nodes/metrics', 'services', 'endpoints', 'pods'],
          verbs: ['get', 'list', 'watch'],
        },
        {
          apiGroups: ['extensions', 'networking.k8s.io'],
          resources: ['ingresses'],
          verbs: ['get', 'list', 'watch'],
        },
        {
          nonResourceUrLs: ['/metrics'],
          verbs: ['get'],
        },
      ],
    });

    // Create ClusterRoleBinding
    new k8s.KubeClusterRoleBinding(this, 'prometheus-cluster-role-binding', {
      metadata: {
        name: 'prometheus',
        labels: {
          'app.kubernetes.io/name': 'prometheus',
        },
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: 'prometheus',
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'prometheus',
          namespace,
        },
      ],
    });

    // Create ConfigMap for Prometheus configuration
    new k8s.KubeConfigMap(this, 'prometheus-config', {
      metadata: {
        name: 'prometheus-config',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'prometheus',
        },
      },
      data: {
        'prometheus.yml': `
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'kgateway-cluster'
    region: 'local'

# Rule files
rule_files:
  # - /etc/prometheus/rules/*.yml

# Remote write configuration for Alloy to send metrics
# This allows Alloy to act as the primary collector and forward to Prometheus
scrape_configs:
  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # Scrape Alloy metrics
  - job_name: 'alloy'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
            - monitoring
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app_kubernetes_io_name]
        action: keep
        regex: alloy
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: pod
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace

  # Service discovery for annotated services
  - job_name: 'kubernetes-services'
    kubernetes_sd_configs:
      - role: service
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_service_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\\d+)?;(\\d+)
        replacement: $1:$2
        target_label: __address__
      - action: labelmap
        regex: __meta_kubernetes_service_label_(.+)
      - source_labels: [__meta_kubernetes_namespace]
        target_label: kubernetes_namespace
      - source_labels: [__meta_kubernetes_service_name]
        target_label: kubernetes_service_name

  # Pod discovery for annotated pods
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\\d+)?;(\\d+)
        replacement: $1:$2
        target_label: __address__
      - action: labelmap
        regex: __meta_kubernetes_pod_label_(.+)
      - source_labels: [__meta_kubernetes_namespace]
        target_label: kubernetes_namespace
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: kubernetes_pod_name

# Alerting configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets: []

# Remote write API configuration to receive metrics from Alloy
# This is configured but Alloy will push metrics to us
`,
      },
    });

    // Create PVC for Prometheus data
    new k8s.KubePersistentVolumeClaim(this, 'prometheus-data-pvc', {
      metadata: {
        name: 'prometheus-data',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'prometheus',
        },
      },
      spec: {
        accessModes: ['ReadWriteOnce'],
        resources: {
          requests: {
            storage: k8s.Quantity.fromString('10Gi'),
          },
        },
        storageClassName: 'standard',
      },
    });

    // Create Prometheus StatefulSet
    new KubeStatefulSet(this, 'prometheus', {
      metadata: {
        name: 'prometheus',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'prometheus',
          'app.kubernetes.io/component': 'metrics-storage',
        },
      },
      spec: {
        serviceName: 'prometheus',
        replicas: 1,
        selector: {
          matchLabels: {
            'app.kubernetes.io/name': 'prometheus',
          },
        },
        template: {
          metadata: {
            labels: {
              'app.kubernetes.io/name': 'prometheus',
              'app.kubernetes.io/component': 'metrics-storage',
            },
            annotations: {
              'prometheus.io/scrape': 'true',
              'prometheus.io/port': '9090',
              'prometheus.io/path': '/metrics',
            },
          },
          spec: {
            serviceAccountName: 'prometheus',
            securityContext: {
              fsGroup: 65534,
              runAsGroup: 65534,
              runAsNonRoot: true,
              runAsUser: 65534,
            },
            containers: [
              {
                name: 'prometheus',
                image: 'prom/prometheus:v2.47.2',
                args: [
                  '--config.file=/etc/prometheus/prometheus.yml',
                  '--storage.tsdb.path=/prometheus',
                  '--web.console.libraries=/usr/share/prometheus/console_libraries',
                  '--web.console.templates=/usr/share/prometheus/consoles',
                  '--web.enable-lifecycle',
                  '--web.enable-remote-write-receiver', // Enable remote write API for Alloy
                  '--storage.tsdb.retention.time=7d',
                  '--storage.tsdb.retention.size=9GB',
                ],
                ports: [
                  {
                    name: 'http',
                    containerPort: 9090,
                    protocol: 'TCP',
                  },
                ],
                livenessProbe: {
                  httpGet: {
                    path: '/-/healthy',
                    port: k8s.IntOrString.fromString('http'),
                  },
                  initialDelaySeconds: 30,
                  periodSeconds: 15,
                  timeoutSeconds: 10,
                  successThreshold: 1,
                  failureThreshold: 3,
                },
                readinessProbe: {
                  httpGet: {
                    path: '/-/ready',
                    port: k8s.IntOrString.fromString('http'),
                  },
                  initialDelaySeconds: 30,
                  periodSeconds: 5,
                  timeoutSeconds: 4,
                  successThreshold: 1,
                  failureThreshold: 3,
                },
                resources: {
                  requests: {
                    cpu: k8s.Quantity.fromString('250m'),
                    memory: k8s.Quantity.fromString('512Mi'),
                  },
                  limits: {
                    cpu: k8s.Quantity.fromString('1000m'),
                    memory: k8s.Quantity.fromString('2Gi'),
                  },
                },
                volumeMounts: [
                  {
                    name: 'config',
                    mountPath: '/etc/prometheus',
                  },
                  {
                    name: 'prometheus-data',
                    mountPath: '/prometheus',
                  },
                ],
              },
            ],
            volumes: [
              {
                name: 'config',
                configMap: {
                  name: 'prometheus-config',
                },
              },
              {
                name: 'prometheus-data',
                persistentVolumeClaim: {
                  claimName: 'prometheus-data',
                },
              },
            ],
          },
        },
      },
    });

    // Create Service for Prometheus
    new k8s.KubeService(this, 'prometheus-service', {
      metadata: {
        name: 'prometheus',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'prometheus',
          'app.kubernetes.io/component': 'metrics-storage',
        },
        annotations: {
          'prometheus.io/scrape': 'true',
          'prometheus.io/port': '9090',
        },
      },
      spec: {
        type: 'ClusterIP',
        ports: [
          {
            name: 'http',
            port: 9090,
            targetPort: k8s.IntOrString.fromNumber(9090),
            protocol: 'TCP',
          },
        ],
        selector: {
          'app.kubernetes.io/name': 'prometheus',
        },
      },
    });

    // Create Ingress for Prometheus UI
    new k8s.KubeIngress(this, 'prometheus-ingress', {
      metadata: {
        name: 'prometheus',
        namespace,
        annotations: {
          'nginx.ingress.kubernetes.io/proxy-body-size': '0',
        },
        labels: {
          'app.kubernetes.io/name': 'prometheus',
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [
          {
            host: `prometheus.${process.env.INGRESS_HOST || 'localtest.me'}`,
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: 'prometheus',
                      port: {
                        number: 9090,
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    });
  }
}