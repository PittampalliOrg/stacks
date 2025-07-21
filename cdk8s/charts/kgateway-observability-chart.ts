import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

/**
 * KGatewayObservabilityChart patches the Kgateway deployment with OpenTelemetry
 * configuration to send traces, metrics, and logs to Alloy.
 * 
 * Since Kgateway is deployed via Helm in the Makefile, we use a strategic merge patch
 * to add observability configuration without modifying the Helm deployment.
 */
export class KGatewayObservabilityChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    const namespace = 'kgateway-system';

    // Create a ConfigMap with observability environment variables
    new k8s.KubeConfigMap(this, 'kgateway-otel-config', {
      metadata: {
        name: 'kgateway-otel-config',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'kgateway',
          'app.kubernetes.io/component': 'observability',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '10', // After Kgateway is deployed
        },
      },
      data: {
        'OTEL_SERVICE_NAME': 'kgateway',
        'OTEL_EXPORTER_OTLP_ENDPOINT': 'http://alloy.monitoring.svc.cluster.local:4317',
        'OTEL_EXPORTER_OTLP_PROTOCOL': 'grpc',
        'OTEL_TRACES_EXPORTER': 'otlp',
        'OTEL_METRICS_EXPORTER': 'otlp',
        'OTEL_LOGS_EXPORTER': 'otlp',
        'OTEL_RESOURCE_ATTRIBUTES': 'service.namespace=kgateway-system,service.version=v2.0.1,deployment.environment=production',
        // Additional Envoy-specific configuration
        'ENVOY_LOG_LEVEL': 'info',
        'ENVOY_COMPONENT_LOG_LEVEL': 'upstream:debug,connection:trace',
      },
    });

    // Since CDK8s doesn't have built-in patch support, we'll create a Job that patches the deployment
    // This approach ensures the patch is applied after Kgateway is deployed
    new k8s.KubeJob(this, 'kgateway-deployment-patch', {
      metadata: {
        name: 'kgateway-otel-patch',
        namespace,
        annotations: {
          'argocd.argoproj.io/hook': 'PostSync',
          'argocd.argoproj.io/hook-delete-policy': 'HookSucceeded',
        },
      },
      spec: {
        template: {
          spec: {
            serviceAccountName: 'kgateway-otel-patcher',
            restartPolicy: 'OnFailure',
            containers: [{
              name: 'patcher',
              image: 'bitnami/kubectl:latest',
              command: ['/bin/bash', '-c'],
              args: [`
set -e
echo "Patching Kgateway deployment with observability configuration..."

# Wait for the deployment to exist
kubectl wait --for=condition=available deployment/kgateway -n ${namespace} --timeout=300s

# Apply the patch to add envFrom and prometheus annotations
kubectl patch deployment kgateway -n ${namespace} --type='json' -p='[
  {
    "op": "add",
    "path": "/spec/template/spec/containers/0/envFrom",
    "value": [
      {
        "configMapRef": {
          "name": "kgateway-otel-config"
        }
      }
    ]
  },
  {
    "op": "add",
    "path": "/spec/template/metadata/annotations",
    "value": {
      "prometheus.io/scrape": "true",
      "prometheus.io/port": "8080",
      "prometheus.io/path": "/metrics"
    }
  }
]'

echo "Patch applied successfully!"
              `],
            }],
          },
        },
      },
    });

    // Create ServiceAccount and RBAC for the patch job
    const patcherSA = new k8s.KubeServiceAccount(this, 'kgateway-otel-patcher-sa', {
      metadata: {
        name: 'kgateway-otel-patcher',
        namespace,
      },
    });

    new k8s.KubeRole(this, 'kgateway-otel-patcher-role', {
      metadata: {
        name: 'kgateway-otel-patcher',
        namespace,
      },
      rules: [{
        apiGroups: ['apps'],
        resources: ['deployments'],
        verbs: ['get', 'list', 'watch', 'patch', 'update'],
      }],
    });

    new k8s.KubeRoleBinding(this, 'kgateway-otel-patcher-binding', {
      metadata: {
        name: 'kgateway-otel-patcher',
        namespace,
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: 'kgateway-otel-patcher',
      },
      subjects: [{
        kind: 'ServiceAccount',
        name: 'kgateway-otel-patcher',
        namespace,
      }],
    });

    // Also create a patch for any gateway proxy deployments
    // These are created dynamically by Kgateway for each Gateway resource
    new k8s.KubeConfigMap(this, 'gateway-proxy-otel-config', {
      metadata: {
        name: 'gateway-proxy-otel-config',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'kgateway',
          'app.kubernetes.io/component': 'gateway-proxy-observability',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '10',
        },
      },
      data: {
        'otel-config.yaml': `
# OpenTelemetry configuration for gateway proxies
staticResources:
  clusters:
  - name: opentelemetry_collector
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN
    typed_extension_protocol_options:
      envoy.extensions.upstreams.http.v3.HttpProtocolOptions:
        "@type": type.googleapis.com/envoy.extensions.upstreams.http.v3.HttpProtocolOptions
        explicit_http_config:
          http2_protocol_options: {}
    load_assignment:
      cluster_name: opentelemetry_collector
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: alloy.monitoring.svc.cluster.local
                port_value: 4317

layeredRuntime:
  layers:
  - name: static_layer
    static_layer:
      envoy:
        resource_monitors:
          global_downstream_max_connections: 50000
      tracing:
        http:
          name: envoy.tracers.opentelemetry
          typed_config:
            "@type": type.googleapis.com/envoy.config.trace.v3.OpenTelemetryConfig
            grpc_service:
              envoy_grpc:
                cluster_name: opentelemetry_collector
              timeout: 0.250s
            service_name: kgateway-proxy
            resource_detectors:
            - name: envoy.tracers.opentelemetry.resource_detectors.environment
              typed_config:
                "@type": type.googleapis.com/envoy.extensions.tracers.opentelemetry.resource_detectors.v3.EnvironmentResourceDetectorConfig
`,
      },
    });

    // Create a Job to patch gateway proxy deployments with Prometheus annotations
    new k8s.KubeJob(this, 'gateway-proxy-patch', {
      metadata: {
        name: 'gateway-proxy-prometheus-patch',
        namespace,
        annotations: {
          'argocd.argoproj.io/hook': 'PostSync',
          'argocd.argoproj.io/hook-delete-policy': 'HookSucceeded',
        },
      },
      spec: {
        template: {
          spec: {
            serviceAccountName: 'kgateway-otel-patcher',
            restartPolicy: 'OnFailure',
            containers: [{
              name: 'patcher',
              image: 'bitnami/kubectl:latest',
              command: ['/bin/bash', '-c'],
              args: [`
set -e
echo "Patching gateway proxy deployments with Prometheus annotations..."

# Find all gateway proxy deployments
for deployment in $(kubectl get deployments -n ${namespace} -l gateway.networking.k8s.io/gateway-name -o name); do
  echo "Patching $deployment..."
  kubectl patch $deployment -n ${namespace} --type='json' -p='[
    {
      "op": "add",
      "path": "/spec/template/metadata/annotations",
      "value": {
        "prometheus.io/scrape": "true",
        "prometheus.io/port": "19000",
        "prometheus.io/path": "/stats/prometheus"
      }
    }
  ]' || true
done

echo "Gateway proxy patches applied!"
              `],
            }],
          },
        },
      },
    });
  }
}