import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

/**
 * Chart for creating a reference ConfigMap with kgateway metrics scraping configuration
 * 
 * NOTE: This chart now only creates a reference ConfigMap. The actual kgateway metrics
 * scraping configuration has been integrated directly into the Alloy Helm values in
 * monitoring-helm-app-chart.ts. This ensures the configuration is managed through
 * GitOps and not overwritten by Helm syncs.
 * 
 * The ConfigMap is kept as a reference and for potential future use cases where
 * the configuration might need to be consumed by other components.
 */
export class KGatewayAlloyObservabilityChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    const namespace = 'monitoring';

    // Create a ConfigMap with Alloy configuration for kgateway metrics scraping
    // This is now just a reference - the actual config is in the Alloy Helm values
    new k8s.KubeConfigMap(this, 'kgateway-alloy-config', {
      metadata: {
        name: 'alloy-kgateway-config',
        namespace: namespace,
        labels: {
          'app.kubernetes.io/name': 'alloy',
          'app.kubernetes.io/component': 'kgateway-config',
          'app.kubernetes.io/purpose': 'reference',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '10',
          'description': 'Reference ConfigMap for kgateway Alloy configuration. Actual config is in Alloy Helm values.',
        },
      },
      data: {
        'kgateway.alloy': `
// kgateway Control Plane Metrics Scraping
prometheus.scrape "kgateway_control_plane" {
  targets = discovery.relabel.kgateway_control_plane.output
  honor_labels = true
  forward_to = [prometheus.remote_write.default.receiver]
  scrape_interval = "30s"
}

// kgateway Data Plane (Gateway Proxies) Metrics Scraping
prometheus.scrape "kgateway_data_plane" {
  targets = discovery.relabel.kgateway_data_plane.output
  honor_labels = true
  forward_to = [prometheus.remote_write.default.receiver]
  scrape_interval = "30s"
}

// MCP Gateway Metrics Scraping
prometheus.scrape "mcp_gateway" {
  targets = discovery.relabel.mcp_gateway.output
  honor_labels = true
  forward_to = [prometheus.remote_write.default.receiver]
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
    replacement = "\${1}:8080"
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
`,
      },
    });

    // NOTE: The alloy-kgateway-config-update Job and its RBAC resources have been removed.
    // The kgateway metrics scraping configuration is now integrated directly into the
    // Alloy Helm values in monitoring-helm-app-chart.ts. This ensures proper GitOps
    // management and prevents configuration from being overwritten by Helm syncs.
  }
}