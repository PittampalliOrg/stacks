import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { Application, ApplicationSpec } from '../../../imports/argoproj.io';

export interface MonitoringHelmAppChartProps extends ChartProps {
  azureTenantId: string;
  azureRegion?: string;
}

/**
 * Monitoring Helm Applications Chart
 * Deploys monitoring stack (Loki, Tempo, Grafana, Alloy) via Helm-based ArgoCD Applications
 */
export class MonitoringHelmAppChart extends Chart {
  constructor(scope: Construct, id: string, props: MonitoringHelmAppChartProps) {
    super(scope, id, props);

    const azureRegion = props.azureRegion || 'eastus';

    // Workload Identity Webhook is now managed via bootstrap/infrastructure-apps.yaml
    // External Secrets Operator is now managed via bootstrap/infrastructure-apps.yaml
    // Argo Workflows is now managed via bootstrap/infrastructure-apps.yaml
    // These are deployed before CDK8s applications to ensure CRDs are available

    // DEPRECATED: Infrastructure apps that need CRDs are now managed at bootstrap level
    /*
    // Workload Identity Webhook Application
    const workloadIdentityApp = new ApiObject(this, 'workload-identity-webhook', {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: 'workload-identity-webhook',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-4'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
          repoUrl: 'https://azure.github.io/azure-workload-identity/charts',
          targetRevision: '1.3.0',
          chart: 'workload-identity-webhook',
          helm: {
            releaseName: 'workload-identity-webhook',
            values: JSON.stringify({
              azureTenantID: props.azureTenantId,
              namespace: 'azure-workload-identity-system',
              podLabels: {
                'azure.workload.identity/use': 'true'
              },
              webhook: {
                image: {
                  repository: 'mcr.microsoft.com/oss/azure/workload-identity/webhook',
                  tag: 'v1.3.0'
                }
              },
              nodeSelector: {},
              tolerations: [],
              affinity: {}
            }, null, 2)
          }
        },
        destination: {
          name: 'in-cluster',
          namespace: 'azure-workload-identity-system'
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

    // External Secrets Operator Application
    const externalSecretsApp = new ApiObject(this, 'external-secrets-operator', {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: 'external-secrets-operator',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-3'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
          repoUrl: 'https://charts.external-secrets.io',
          targetRevision: '0.17.0',
          chart: 'external-secrets',
          helm: {
            releaseName: 'external-secrets-operator',
            values: JSON.stringify({
              installCRDs: true,
              serviceAccount: {
                create: false,
                name: 'external-secrets'
              },
              resources: {
                requests: {
                  cpu: '100m',
                  memory: '128Mi'
                },
                limits: {
                  cpu: '500m',
                  memory: '512Mi'
                }
              },
              webhook: {
                resources: {
                  requests: {
                    cpu: '50m',
                    memory: '64Mi'
                  },
                  limits: {
                    cpu: '200m',
                    memory: '256Mi'
                  }
                }
              },
              certController: {
                resources: {
                  requests: {
                    cpu: '50m',
                    memory: '64Mi'
                  },
                  limits: {
                    cpu: '200m',
                    memory: '256Mi'
                  }
                }
              },
              replicaCount: 1,
              leaderElect: false
            }, null, 2)
          }
        },
        destination: {
          name: 'in-cluster',
          namespace: 'external-secrets'
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
        revisionHistoryLimit: 3,
        ignoreDifferences: [
          {
            group: 'apiextensions.k8s.io',
            kind: 'CustomResourceDefinition',
            jsonPointers: ['/spec/conversion']
          }
        ]
      }
    });

    // Add dependency - External Secrets needs Workload Identity
    externalSecretsApp.addDependency(workloadIdentityApp);

    // Argo Workflows Application - needed for WorkflowTemplate CRDs
    const argoWorkflowsApp = new ApiObject(this, 'argo-workflows', {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: 'argo-workflows',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-5' // Very early sync wave to ensure CRDs are available
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
              createNamespace: false, // Namespace created by platform-core-chart
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

    // External Secrets depends on Workload Identity, Argo Workflows stands alone
    */
    
    // Loki Application
    const lokiApp = new Application(this, 'loki', {
      metadata: {
        name: 'loki',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-1'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
          repoUrl: 'https://grafana.github.io/helm-charts',
          targetRevision: '5.48.0',
          chart: 'loki',
          helm: {
            releaseName: 'loki',
            values: JSON.stringify({
              singleBinary: { replicas: 1 },
              loki: { 
                auth_enabled: false,
                commonConfig: {
                  replication_factor: 1
                },
                schemaConfig: {
                  configs: [{
                    from: '2024-04-01',
                    store: 'tsdb',
                    object_store: 'filesystem',
                    schema: 'v13',
                    index: {
                      prefix: 'loki_index_',
                      period: '24h'
                    }
                  }]
                },
                storage: {
                  type: 'filesystem',
                  filesystem: {
                    directory: '/var/loki'
                  },
                  bucketNames: {
                    chunks: 'chunks',
                    ruler: 'ruler',
                    admin: 'admin'
                  }
                },
                pattern_ingester: {
                  enabled: true
                },
                limits_config: {
                  allow_structured_metadata: true,
                  volume_enabled: true
                },
                ruler: {
                  enable_api: true
                }
              },
              persistence: {
                enabled: true,
                size: '10Gi'
              },
              resources: {
                requests: {
                  cpu: '300m',
                  memory: '512Mi'
                },
                limits: {
                  cpu: '1000m',
                  memory: '1Gi'
                }
              },
              test: {
                enabled: false
              },
              gateway: { 
                enabled: true, 
                service: { 
                  type: 'NodePort', 
                  nodePort: 31000 
                },
                readinessProbe: {
                  failureThreshold: 10
                }
              },
              monitoring: {
                selfMonitoring: {
                  enabled: false,
                  grafanaAgent: {
                    installOperator: false
                  }
                },
                lokiCanary: {
                  enabled: false
                },
                serviceMonitor: {
                  enabled: false
                }
              }
            }, null, 2)
          }
        },
        destination: {
          name: 'in-cluster',
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
        revisionHistoryLimit: 3,
        ignoreDifferences: [{
          group: 'apps',
          kind: 'Deployment',
          jsonPointers: [
            '/spec/replicas',
            '/spec/template/metadata/labels',
            '/spec/template/spec/containers/*/resources',
            '/spec/template/spec/containers/*/env',
            '/spec/selector/matchLabels'
          ]
        }, {
          group: 'apps',
          kind: 'StatefulSet',
          jsonPointers: [
            '/spec/replicas',
            '/spec/template/metadata/labels',
            '/spec/template/spec/containers/*/resources',
            '/spec/template/spec/containers/*/env'
          ]
        }]
      } as ApplicationSpec
    });

    // Tempo Application
    const tempoApp = new Application(this, 'tempo', {
      metadata: {
        name: 'tempo',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-1'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
          repoUrl: 'https://grafana.github.io/helm-charts',
          targetRevision: '1.23.1',
          chart: 'tempo',
          helm: {
            releaseName: 'tempo',
            values: JSON.stringify({
              mode: 'standalone',
              service: { type: 'ClusterIP', ports: [
                { name: 'http', port: 3100 },
                { name: 'otlp-grpc', port: 4317 },
                { name: 'otlp-http', port: 4318 },
              ]},
              traces: { otlp: { grpc: { enabled: true }, http: { enabled: true } } },
              metricsGenerator: {
                enabled: true,
                remoteWriteUrl: 'http://mimir-gateway.monitoring.svc.cluster.local:80/api/v1/push',
                registry: {
                  externalLabels: {
                    source: 'tempo',
                    cluster: 'local-kind'
                  }
                },
                processor: {
                  serviceGraphs: {
                    enabled: true,
                    dimensions: ['service.namespace', 'service.name']
                  },
                  spanMetrics: {
                    enabled: true,
                    dimensions: [
                      { name: 'service.namespace' },
                      { name: 'service.name' },
                      { name: 'span.kind' },
                      { name: 'http.method', default: 'GET' },
                      { name: 'http.status_code' }
                    ]
                  }
                }
              }
            }, null, 2)
          }
        },
        destination: {
          name: 'in-cluster',
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
        revisionHistoryLimit: 3,
        ignoreDifferences: [{
          group: 'apps',
          kind: 'Deployment',
          jsonPointers: [
            '/spec/replicas',
            '/spec/template/metadata/labels',
            '/spec/template/spec/containers/*/resources',
            '/spec/template/spec/containers/*/env',
            '/spec/selector/matchLabels'
          ]
        }, {
          group: 'apps',
          kind: 'StatefulSet',
          jsonPointers: [
            '/spec/replicas',
            '/spec/template/metadata/labels',
            '/spec/template/spec/containers/*/resources',
            '/spec/template/spec/containers/*/env'
          ]
        }]
      } as ApplicationSpec
    });

    // Grafana Application
    const grafanaApp = new Application(this, 'grafana', {
      metadata: {
        name: 'grafana',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '0'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
          repoUrl: 'https://grafana.github.io/helm-charts',
          targetRevision: '8.15.0',
          chart: 'grafana',
          helm: {
            releaseName: 'grafana',
            values: JSON.stringify({
              service: { type: 'ClusterIP' },
              ingress: {
                enabled: true,
                ingressClassName: 'nginx',
                hosts: [`grafana.${process.env.INGRESS_HOST || 'localtest.me'}`],
              },
              adminUser: 'admin',
              adminPassword: 'admin',
              serviceAccount: {
                create: true,
                name: 'grafana'
              },
              rbac: {
                pspEnabled: false
              },
              datasources: {
                'datasources.yaml': {
                  apiVersion: 1,
                  datasources: [
                    {
                      name: 'Prometheus',
                      type: 'prometheus',
                      access: 'proxy',
                      url: 'http://prometheus.monitoring.svc.cluster.local:9090',
                      isDefault: true,
                      jsonData: {
                        httpMethod: 'POST'
                      }
                    },
                    {
                      name: 'Mimir',
                      type: 'prometheus',
                      access: 'proxy',
                      url: 'http://mimir-nginx.monitoring.svc.cluster.local/prometheus',
                      isDefault: false,
                      jsonData: {
                        httpMethod: 'POST'
                      }
                    },
                    {
                      name: 'Loki',
                      type: 'loki',
                      access: 'proxy',
                      url: 'http://loki-gateway.monitoring.svc.cluster.local:80'
                    },
                    {
                      name: 'Tempo',
                      type: 'tempo',
                      access: 'proxy',
                      url: 'http://tempo.monitoring.svc.cluster.local:3200'
                    }
                  ]
                }
              },
            }, null, 2)
          }
        },
        destination: {
          name: 'in-cluster',
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
        revisionHistoryLimit: 3,
        ignoreDifferences: [{
          group: 'apps',
          kind: 'Deployment',
          jsonPointers: [
            '/spec/replicas',
            '/spec/template/metadata/labels',
            '/spec/template/spec/containers/*/resources',
            '/spec/template/spec/containers/*/env',
            '/spec/selector/matchLabels'
          ]
        }, {
          group: 'apps',
          kind: 'StatefulSet',
          jsonPointers: [
            '/spec/replicas',
            '/spec/template/metadata/labels',
            '/spec/template/spec/containers/*/resources',
            '/spec/template/spec/containers/*/env'
          ]
        }]
      } as ApplicationSpec
    });

    // Grafana depends on Loki and Tempo being available
    grafanaApp.addDependency(lokiApp);
    grafanaApp.addDependency(tempoApp);

    // Alloy Application (Observability data collector)
    const alloyApp = new Application(this, 'alloy', {
      metadata: {
        name: 'alloy',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '1'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
          repoUrl: 'https://grafana.github.io/helm-charts',
          targetRevision: '0.9.2',  // Use specific version to avoid CRD v1alpha1 issues
          chart: 'alloy',
          helm: {
            releaseName: 'alloy',
            values: JSON.stringify({
              crds: {
                create: false  // Disable CRD creation to avoid the podlogs CRD issue
              },
              alloy: {
                clustering: {
                  enabled: false
                },
                extraArgs: [
                  '--stability.level=experimental'
                ],
                extraPorts: [
                  {
                    name: 'otlp-grpc',
                    port: 4317,
                    targetPort: 4317,
                    protocol: 'TCP'
                  },
                  {
                    name: 'otlp-http', 
                    port: 4318,
                    targetPort: 4318,
                    protocol: 'TCP'
                  }
                ],
                configMap: {
                  create: true,
                  content: `
// Enable live debugging for real-time visibility
livedebugging {
  enabled = true
}

logging {
  level = "info"
}

// Remote write to Prometheus for metrics storage
prometheus.remote_write "prometheus" {
  endpoint {
    url = "http://prometheus.monitoring.svc.cluster.local:9090/api/v1/write"
  }
}

// Keep existing Mimir endpoint for future use
prometheus.remote_write "mimir" {
  endpoint {
    url = "http://mimir-gateway:80/api/v1/push"
  }
}

loki.write "default" {
  endpoint {
    url = "http://loki-gateway:80/loki/api/v1/push"
  }
}

// OTLP receiver for traces, metrics, and logs
otelcol.receiver.otlp "default" {
  grpc {
    endpoint = "0.0.0.0:4317"
  }
  http {
    endpoint = "0.0.0.0:4318"
  }
  output {
    traces = [otelcol.exporter.otlp.tempo.input]
    metrics = [otelcol.exporter.prometheus.default.input]
    logs = [otelcol.exporter.loki.default.input]
  }
}

// Export traces to Tempo
otelcol.exporter.otlp "tempo" {
  client {
    endpoint = "tempo:4317"
    tls {
      insecure = true
    }
  }
}

// Export metrics to both Prometheus and Mimir
otelcol.exporter.prometheus "default" {
  forward_to = [prometheus.remote_write.prometheus.receiver, prometheus.remote_write.mimir.receiver]
}

// Export logs to Loki
otelcol.exporter.loki "default" {
  forward_to = [loki.write.default.receiver]
}

// ===== kgateway Metrics Scraping Configuration =====

// kgateway Control Plane Metrics Scraping
prometheus.scrape "kgateway_control_plane" {
  targets = discovery.relabel.kgateway_control_plane.output
  honor_labels = true
  forward_to = [prometheus.remote_write.prometheus.receiver]
  scrape_interval = "30s"
}

// kgateway Data Plane (Gateway Proxies) Metrics Scraping
prometheus.scrape "kgateway_data_plane" {
  targets = discovery.relabel.kgateway_data_plane.output
  honor_labels = true
  forward_to = [prometheus.remote_write.prometheus.receiver]
  scrape_interval = "30s"
}

// MCP Gateway Metrics Scraping
prometheus.scrape "mcp_gateway" {
  targets = discovery.relabel.mcp_gateway.output
  honor_labels = true
  forward_to = [prometheus.remote_write.prometheus.receiver]
  scrape_interval = "30s"
}

// Kubernetes service discovery for kgateway control plane
discovery.kubernetes "kgateway_control_plane" {
  role = "pod"
  namespaces {
    names = ["kgateway-system"]
  }
}

// Kubernetes service discovery for gateway proxies
discovery.kubernetes "kgateway_data_plane" {
  role = "pod"
  namespaces {
    names = ["kgateway-system", "default"]
  }
}

// Kubernetes service discovery for MCP Gateway
discovery.kubernetes "mcp_gateway" {
  role = "pod"
  namespaces {
    names = ["kgateway-system"]
  }
}

// Control plane relabeling
discovery.relabel "kgateway_control_plane" {
  targets = discovery.kubernetes.kgateway_control_plane.targets
  
  // Keep only kgateway pods
  rule {
    source_labels = ["__meta_kubernetes_pod_label_kgateway"]
    regex = "kgateway"
    action = "keep"
  }
  
  // Keep pods with prometheus scrape annotation
  rule {
    source_labels = ["__meta_kubernetes_pod_annotation_prometheus_io_scrape"]
    regex = "true"
    action = "keep"
  }
  
  // Use custom metrics path if specified
  rule {
    source_labels = ["__meta_kubernetes_pod_annotation_prometheus_io_path"]
    regex = "(.+)"
    target_label = "__metrics_path__"
  }
  
  // Use custom port if specified, default to 8080
  rule {
    source_labels = ["__meta_kubernetes_pod_annotation_prometheus_io_port"]
    regex = "(.+)"
    target_label = "__tmp_port"
  }
  
  rule {
    source_labels = ["__tmp_port"]
    regex = ""
    target_label = "__tmp_port"
    replacement = "8080"
  }
  
  // Set scrape address
  rule {
    source_labels = ["__meta_kubernetes_pod_ip", "__tmp_port"]
    separator = ":"
    target_label = "__address__"
  }
  
  // Add kubernetes labels
  rule {
    regex = "__meta_kubernetes_pod_label_(.+)"
    action = "labelmap"
  }
  
  // Add namespace label
  rule {
    source_labels = ["__meta_kubernetes_namespace"]
    target_label = "kube_namespace"
  }
  
  // Add pod name label
  rule {
    source_labels = ["__meta_kubernetes_pod_name"]
    target_label = "pod"
  }
}

// Envoy metrics relabeling for gateway proxies
discovery.relabel "kgateway_data_plane" {
  targets = discovery.kubernetes.kgateway_data_plane.targets
  
  // Keep pods with gateway name label
  rule {
    source_labels = ["__meta_kubernetes_pod_label_gateway_networking_k8s_io_gateway_name"]
    regex = ".+"
    action = "keep"
  }
  
  // Keep pods with prometheus scrape annotation
  rule {
    source_labels = ["__meta_kubernetes_pod_annotation_prometheus_io_scrape"]
    regex = "true"
    action = "keep"
  }
  
  // Use custom metrics path if specified, default to /stats/prometheus
  rule {
    source_labels = ["__meta_kubernetes_pod_annotation_prometheus_io_path"]
    regex = "(.+)"
    target_label = "__metrics_path__"
  }
  
  rule {
    source_labels = ["__metrics_path__"]
    regex = ""
    target_label = "__metrics_path__"
    replacement = "/stats/prometheus"
  }
  
  // Use custom port if specified, default to 19000 (Envoy admin port)
  rule {
    source_labels = ["__meta_kubernetes_pod_annotation_prometheus_io_port"]
    regex = "(.+)"
    target_label = "__tmp_port"
  }
  
  rule {
    source_labels = ["__tmp_port"]
    regex = ""
    target_label = "__tmp_port"
    replacement = "19000"
  }
  
  // Set scrape address
  rule {
    source_labels = ["__meta_kubernetes_pod_ip", "__tmp_port"]
    separator = ":"
    target_label = "__address__"
  }
  
  // Add kubernetes labels
  rule {
    regex = "__meta_kubernetes_pod_label_(.+)"
    action = "labelmap"
  }
  
  // Add namespace label
  rule {
    source_labels = ["__meta_kubernetes_namespace"]
    target_label = "kube_namespace"
  }
  
  // Add pod name label
  rule {
    source_labels = ["__meta_kubernetes_pod_name"]
    target_label = "pod"
  }
  
  // Add gateway name label
  rule {
    source_labels = ["__meta_kubernetes_pod_label_gateway_networking_k8s_io_gateway_name"]
    target_label = "gateway_name"
  }
}

// MCP Gateway relabeling
discovery.relabel "mcp_gateway" {
  targets = discovery.kubernetes.mcp_gateway.targets
  
  // Keep only MCP Gateway pods
  rule {
    source_labels = ["__meta_kubernetes_pod_label_app"]
    regex = "mcp-gateway"
    action = "keep"
  }
  
  // Set metrics path to /metrics
  rule {
    target_label = "__metrics_path__"
    replacement = "/metrics"
  }
  
  // Use port 8080 for MCP Gateway metrics
  rule {
    source_labels = ["__meta_kubernetes_pod_ip"]
    target_label = "__address__"
    replacement = "${1}:8080"
  }
  
  // Add kubernetes labels
  rule {
    regex = "__meta_kubernetes_pod_label_(.+)"
    action = "labelmap"
  }
  
  // Add namespace label
  rule {
    source_labels = ["__meta_kubernetes_namespace"]
    target_label = "kube_namespace"
  }
  
  // Add pod name label
  rule {
    source_labels = ["__meta_kubernetes_pod_name"]
    target_label = "pod"
  }
}
`
                }
              },
              service: {
                type: 'ClusterIP'
              }
            }, null, 2)
          }
        },
        destination: {
          name: 'in-cluster',
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
        revisionHistoryLimit: 3,
        ignoreDifferences: [{
          group: 'apps',
          kind: 'Deployment',
          jsonPointers: [
            '/spec/replicas',
            '/spec/template/metadata/labels',
            '/spec/template/spec/containers/*/resources',
            '/spec/template/spec/containers/*/env',
            '/spec/selector/matchLabels'
          ]
        }, {
          group: 'apps',
          kind: 'DaemonSet',
          jsonPointers: [
            '/spec/template/metadata/labels',
            '/spec/template/spec/containers/*/resources',
            '/spec/template/spec/containers/*/env'
          ]
        }]
      } as ApplicationSpec
    });

    // Alloy depends on Loki and Tempo being available
    alloyApp.addDependency(lokiApp);
    alloyApp.addDependency(tempoApp);

    // Gateway API CRDs are now managed by crd-providers-chart.ts

    // KGateway CRDs Application
    const kgatewayCrdsApp = new Application(this, 'kgateway-crds', {
      metadata: {
        name: 'kgateway-crds',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '2' // After Gateway API CRDs
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
          chart: 'kgateway-crds',
          repoUrl: 'cr.kgateway.dev/kgateway-dev/charts',  // note: the oci:// syntax is not included
          targetRevision: 'v2.0.1',
          helm: {
            releaseName: 'kgateway-crds'
          }
        },
        destination: {
          name: 'in-cluster',
          namespace: 'kgateway-system'
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
        }
      } as ApplicationSpec
    });

    // KGateway depends on Gateway API CRDs
    // Gateway API CRDs are now managed by crd-providers-chart.ts

    // KGateway Controller Application  
    const kgatewayApp = new Application(this, 'kgateway', {
      metadata: {
        name: 'kgateway',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '3' // After KGateway CRDs
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
          chart: 'kgateway',
          repoUrl: 'cr.kgateway.dev/kgateway-dev/charts',  // note: the oci:// syntax is not included
          targetRevision: 'v2.0.1',
          helm: {
            releaseName: 'kgateway',
            values: JSON.stringify({
              features: {
                mcp: {
                  enabled: true
                }
              },
              resources: {
                requests: {
                  cpu: '250m',
                  memory: '256Mi'
                },
                limits: {
                  cpu: '1000m',
                  memory: '512Mi'
                }
              },
              controller: {
                extraEnv: {
                  OTEL_SERVICE_NAME: 'kgateway',
                  OTEL_EXPORTER_OTLP_ENDPOINT: 'http://alloy.monitoring.svc.cluster.local:4317',
                  OTEL_EXPORTER_OTLP_PROTOCOL: 'grpc',
                  OTEL_TRACES_EXPORTER: 'otlp',
                  OTEL_METRICS_EXPORTER: 'otlp',
                  OTEL_LOGS_EXPORTER: 'otlp',
                  OTEL_RESOURCE_ATTRIBUTES: 'service.namespace=kgateway-system,service.version=v2.0.1,deployment.environment=production'
                }
              }
            }, null, 2)
          }
        },
        destination: {
          name: 'in-cluster',
          namespace: 'kgateway-system'
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
      } as ApplicationSpec
    });

    // KGateway controller depends on KGateway CRDs
    kgatewayApp.addDependency(kgatewayCrdsApp);

    // DEPRECATED: KGateway Resources Application removed
    // KGateway is now fully managed via Helm, and Gateway API resources are created by the Helm chart
    // The old kgateway-resources chart has been removed to prevent creating conflicting resources
    /*
    const kgatewayResourcesApp = new ApiObject(this, 'kgateway-resources', {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: 'kgateway-resources',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'argocd.argoproj.io/source-type': 'git',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '5' // After kgateway (wave 3)
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
          repoUrl: 'https://github.com/PittampalliOrg/cdk8s-project.git',
          targetRevision: 'app',
          path: 'dist',
          directory: {
            include: '0026-kgateway-resources.k8s.yaml' // Only include this specific file
          }
        },
        destination: {
          name: 'in-cluster'
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

    // KGateway Resources depends on Gateway API CRDs (kgateway itself is installed via Makefile)
    // Gateway API CRDs are now managed by crd-providers-chart.ts
    */

    // Cert-Manager is now managed via bootstrap/infrastructure-apps.yaml
    // to ensure it's available before Kargo and other apps that need certificates

    // Prometheus Application (Traditional Metrics)
    // NOTE: Commented out to reduce resource usage - using Mimir instead
    /*
    const prometheusApp = new ApiObject(this, 'prometheus', {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: 'prometheus',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '0'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
          repoUrl: 'https://prometheus-community.github.io/helm-charts',
          targetRevision: '25.0.0',
          chart: 'prometheus',
          helm: {
            releaseName: 'prometheus',
            values: JSON.stringify({
              server: {
                service: {
                  type: 'NodePort',
                  nodePort: 30002
                },
                persistentVolume: {
                  enabled: true,
                  size: '8Gi'
                },
                resources: {
                  requests: {
                    cpu: '200m',
                    memory: '512Mi'
                  },
                  limits: {
                    cpu: '1000m',
                    memory: '1Gi'
                  }
                }
              },
              alertmanager: {
                enabled: false  // Using Mimir's alertmanager
              },
              prometheusNodeExporter: {
                enabled: true
              },
              kubeStateMetrics: {
                enabled: true
              }
            }, null, 2)
          }
        },
        destination: {
          name: 'in-cluster',
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
    */

    // Mimir Application (Distributed Metrics Storage)
    // NOTE: Commented out - currently not used as k8s-monitoring app is disabled
    /*
    const mimirApp = new ApiObject(this, 'mimir', {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: 'mimir',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '0'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
          repoUrl: 'https://grafana.github.io/helm-charts',
          targetRevision: '5.48.0',
          chart: 'mimir-distributed',
          helm: {
            releaseName: 'mimir',
            values: JSON.stringify({
              global: {
                mimir: {
                  extraObjectStores: [{
                    name: 'filesystem',
                    storageClass: 'standard'
                  }]
                }
              },
              gateway: {
                service: {
                  type: 'ClusterIP'
                }
              },
              mimir: {
                mode: 'monolithic'  // Use monolithic mode for local development
              },
              monolithic: {
                replicas: 1,
                resources: {
                  requests: {
                    cpu: '100m',
                    memory: '256Mi'
                  },
                  limits: {
                    cpu: '500m',
                    memory: '1Gi'
                  }
                },
                persistentVolume: {
                  enabled: false  // Use ephemeral storage for local dev
                }
              },
              alertmanager: {
                enabled: false
              }
            }, null, 2)
          }
        },
        destination: {
          name: 'in-cluster',
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
    */

    // Kargo Application is now managed via bootstrap/infrastructure-apps.yaml
    // to ensure CRDs are installed before CDK8s resources are created
    // This prevents the circular dependency issue where CDK8s apps try to create
    // Kargo resources before the CRDs exist

    // K8s-Monitoring Chart removed - using individual monitoring components instead
    /* const k8sMonitoringApp = new ApiObject(this, 'k8s-monitoring', {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: 'k8s-monitoring',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '2' // After all monitoring backends are ready
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
          repoUrl: 'https://grafana.github.io/helm-charts',
          targetRevision: '1.23.1',
          chart: 'k8s-monitoring',
          helm: {
            releaseName: 'k8s-monitoring',
            values: JSON.stringify({
              cluster: {
                name: 'gitops-local'
              },
              metrics: {
                enabled: true,
                cost: {
                  enabled: false // Disable cost monitoring for local dev
                },
                node_exporter: {
                  enabled: true
                }
              },
              logs: {
                enabled: true,
                pod_logs: {
                  enabled: true
                },
                cluster_events: {
                  enabled: true
                }
              },
              traces: {
                enabled: true
              },
              receivers: {
                grpc: {
                  enabled: true
                },
                http: {
                  enabled: true
                },
                zipkin: {
                  enabled: false
                }
              },
              opencost: {
                enabled: false
              },
              kube_state_metrics: {
                enabled: true
              },
              prometheus_node_exporter: {
                enabled: true
              },
              alloy: {
                installOperator: false,
                alloy: {
                  resources: {
                    requests: {
                      cpu: '100m',
                      memory: '128Mi'
                    },
                    limits: {
                      cpu: '500m',
                      memory: '512Mi'
                    }
                  }
                }
              },
              // Destinations for metrics, logs, and traces
              externalServices: {
                prometheus: {
                  host: 'http://mimir-nginx.monitoring.svc.cluster.local',
                  basicAuth: {
                    username: 'anonymous'
                  }
                },
                loki: {
                  host: 'http://loki-gateway.monitoring.svc.cluster.local',
                  basicAuth: {
                    username: 'anonymous'
                  }
                },
                tempo: {
                  host: 'tempo.monitoring.svc.cluster.local:4317',
                  protocol: 'grpc'
                }
              }
            }, null, 2)
          }
        },
        destination: {
          name: 'in-cluster',
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
    }); */

    // K8s-monitoring depends on all monitoring backends
    // k8sMonitoringApp.addDependency(lokiApp);
    // k8sMonitoringApp.addDependency(tempoApp);
    // k8sMonitoringApp.addDependency(prometheusApp);  // Commented out - using Mimir instead
    // k8sMonitoringApp.addDependency(mimirApp);

    // Kagent AI Platform Application is now managed via bootstrap/infrastructure-apps.yaml
    // to ensure CRDs are installed before CDK8s resources are created

    // Kargo Pipeline Application - deploys after Kargo itself
    // Note: Keeping this here even though it depends on Kargo CRDs because
    // it's deploying from the CDK8s-generated dist/ directory
    // Note: Kargo pipeline resources (Project, Warehouse, Stages) are managed by CDK8s
    // via kargo-pipeline-chart.ts and deployed as part of cdk8s-applications.
    // No separate Application is needed here.

    // Kargo pipeline depends on Kargo being installed
    // Note: Kargo itself is now installed via bootstrap/infrastructure-apps.yaml
    // so we don't have a direct dependency here

    // OpenFeature Operator is now managed via bootstrap/infrastructure-apps.yaml
    // to ensure CRDs are installed before CDK8s resources are created
  }
}