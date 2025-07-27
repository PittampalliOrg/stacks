import { Chart, ApiObject, ChartProps } from 'cdk8s';
import * as kplus from 'cdk8s-plus-32';
import * as k8s from '../imports/k8s';
import { Construct } from 'constructs';
import * as images from '../../.env-files/images.json';

export interface NextJsChartProps extends ChartProps {
  // Additional props can be added here as needed
}

export class NextJsChart extends Chart {
  constructor(scope: Construct, id: string, props: NextJsChartProps = {}) {
    super(scope, id, props);

    const namespace = 'nextjs';
    
    // Docker registry secret is now managed by app-stack-secrets-chart
    
    // ConfigMap - using environment variables directly
    // The plugin strips ARGOCD_ENV_ prefix, so we can use simple process.env.
    // Using subdomain-based routing for idpbuilder
    const baseHost = process.env.INGRESS_HOST || 'cnoe.localtest.me';
    const ingressHost = `chat.${baseHost}`;
    const enableTls = process.env.ENABLE_TLS === 'true';
    const protocol = enableTls ? 'https' : 'http';
    const port = enableTls ? ':8443' : '';
    const baseUrl = `${protocol}://${ingressHost}${port}` || 'https://chat.cnoe.localtest.me';
    
    const configMap = new kplus.ConfigMap(this, 'config', {
      metadata: { 
        name: 'myapp-config', 
        namespace
      },
      data: {
        // Authentication URLs - use constructed baseUrl if NEXTJS_BASE_URL not explicitly set
        NEXTAUTH_URL: baseUrl,
        NEXT_PUBLIC_BASE_URL: baseUrl,
        NEXT_PUBLIC_SITE_URL: baseUrl,
        AUTH_URL: baseUrl,
        
        // Static configuration
        NEXT_PUBLIC_BASE_PATH: baseUrl,
        AUTH_TRUST_HOST: 'true',
        // HOSTNAME removed - let Next.js use its default behavior
        // Setting HOSTNAME to '0.0.0.0' causes authentication redirect issues
        NEXTAUTH_URL_INTERNAL: 'http://nextjs-service:3000',
        
        // Observability
        OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_ENDPOINT || "http://alloy.monitoring:4318",
        OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
        OTEL_TRACES_EXPORTER: 'otlp',
        OTEL_METRICS_EXPORTER: 'otlp',
        OTEL_LOGS_EXPORTER: 'otlp',
        OTEL_SERVICE_NAME: 'nextjs',
        OTEL_RESOURCE_ATTRIBUTES: 'k8s.cluster.name=local-kind,service.namespace=nextjs,service.name=nextjs',
        OTEL_LOG_LEVEL: process.env.LOG_LEVEL || "",
        
        // Runtime environment
        NEXT_RUNTIME: 'nodejs',
        NODE_ENV: process.env.NODE_ENV || "",
        
        // Database connections
        REDIS_URL: 'redis://redis-service:6379',
        REDIS_AVAILABLE: 'true',
        
        // Proxy configuration
        TRUST_PROXY: '1',
        
        // Kubernetes metadata
        K8S_NAMESPACE: namespace,
        
        // Feature flag configuration
        FLAGD_HOST: 'flagd.default.svc.cluster.local',
        FLAGD_PORT: '8013',
      },
    });

    // Deployment using raw API object to have full control
    new ApiObject(this, 'nextjs-deployment', {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: 'nextjs-deployment',
        namespace: namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '10', // Deploy after secrets are ready
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: 'nextjs',
          },
        },
        template: {
          metadata: {
            labels: {
              app: 'nextjs',
            },
            annotations: {
              'openfeature.dev/enabled': 'false', // We'll use centralized flagd instead of sidecar
            },
          },
          spec: {
            imagePullSecrets: [
              { name: 'ghcr-dockercfg' }
            ],
            containers: [
              {
                name: 'nextjs',
                image: images[(process.env.ENVIRONMENT as keyof typeof images) || 'dev'].nextjs,
                imagePullPolicy: 'Always',
                ports: [{ containerPort: 80 }],
                envFrom: [
                  { configMapRef: { name: configMap.name } },
                  { secretRef: { name: 'app-env' } },
                  { secretRef: { name: 'neon-database-credentials' } },
                  { secretRef: { name: 'nextauth-credentials' } },
                ],
                env: [
                  {
                    name: 'FLAGD_HOST',
                    value: 'flagd.default.svc.cluster.local',
                  },
                  {
                    name: 'FLAGD_PORT',
                    value: '8013',
                  },
                  {
                    name: 'FLAGD_PROTOCOL',
                    value: 'grpc',
                  },
                ],
                resources: {
                  requests: {
                    cpu: '100m',
                    memory: '256Mi',
                  },
                  limits: {
                    cpu: '1000m',
                    memory: '1Gi',
                  },
                },
                // Health checks temporarily disabled due to missing /api/health endpoint
                // and redirect issues with other endpoints
                // TODO: Re-enable once /api/health endpoint is added to the app
              },
            ],
          },
        },
      },
    });

    // Note: app-env secret is created by all-secrets-chart.ts
    // No explicit dependency needed since all-secrets-chart is deployed first

    // Service
    new ApiObject(this, 'nextjs-service', {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: 'nextjs-service',
        namespace: namespace,
      },
      spec: {
        selector: {
          app: 'nextjs',
        },
        ports: [{ 
          port: 3000,
          targetPort: 80
        }],
      },
    });

    // Environment-specific configuration is defined at the top of the constructor
    const tlsIssuer = process.env.TLS_ISSUER || '';
    const isProduction = process.env.ENVIRONMENT === 'production';
    const isAKS = process.env.CLUSTER_TYPE === 'aks';

    new ApiObject(this, 'nextjs-ingress', {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: 'nextjs-ingress',
        namespace: namespace,
        annotations: {
          // Add cert-manager annotation if TLS is enabled and issuer is specified
          ...(enableTls && tlsIssuer && {
            'cert-manager.io/cluster-issuer': tlsIssuer,
          }),
          // Add NGINX annotations for AKS/production environments
          ...(isAKS && {
            'nginx.ingress.kubernetes.io/proxy-body-size': '10m',
            'nginx.ingress.kubernetes.io/proxy-read-timeout': '600',
            'nginx.ingress.kubernetes.io/proxy-send-timeout': '600',
          }),
          // Force SSL redirect for production
          ...(isProduction && enableTls && {
            'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
            'nginx.ingress.kubernetes.io/force-ssl-redirect': 'true',
          }),
        },
      },
      spec: {
        ingressClassName: 'nginx',
        // Add TLS configuration if enabled
        ...(enableTls && {
          tls: [{
            hosts: [ingressHost],
            secretName: `nextjs-tls-${process.env.ENVIRONMENT || 'dev'}`,
          }],
        }),
        rules: [
          {
            host: ingressHost,
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: 'nextjs-service',
                      port: {
                        number: 3000,
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