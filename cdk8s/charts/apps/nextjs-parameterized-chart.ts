import { Chart, ChartProps } from 'cdk8s';
import * as k8s from '../../imports/k8s';
import { Construct } from 'constructs';
import * as images from '../../../.env-files/images.json';

export interface NextJsParameterizedChartProps extends ChartProps {
  environmentName: string;
}

/**
 * Creates NextJS application resources for a specific environment
 * Generates complete manifests with environment-specific images
 */
export class NextJsParameterizedChart extends Chart {
  constructor(scope: Construct, id: string, props: NextJsParameterizedChartProps) {
    super(scope, id, props);

    const envName = props.environmentName;
    const namespace = 'nextjs';
    
    // Get the appropriate image for this environment
    const imageRef = images[envName as keyof typeof images]?.nextjs || images.dev.nextjs;
    
    // Base configuration that's common across environments
    const baseHost = 'cnoe.localtest.me';
    const ingressHost = `chat-${envName}.${baseHost}`;
    const protocol = 'https';
    const port = ':8443';
    const baseUrl = `${protocol}://${ingressHost}${port}`;
    
    // ConfigMap with environment-specific values
    const configMap = new k8s.KubeConfigMap(this, `${envName}-config`, {
      metadata: { 
        name: `nextjs-config-${envName}`, 
        namespace
      },
      data: {
        // Environment-specific URLs
        NEXTAUTH_URL: baseUrl,
        NEXT_PUBLIC_BASE_URL: baseUrl,
        NEXT_PUBLIC_SITE_URL: baseUrl,
        AUTH_URL: baseUrl,
        NEXT_PUBLIC_BASE_PATH: baseUrl,
        AUTH_TRUST_HOST: 'true',
        NEXTAUTH_URL_INTERNAL: `http://nextjs-service-${envName}:3000`,
        
        // Environment indicator
        ENVIRONMENT: envName,
        NODE_ENV: envName === 'dev' ? 'development' : 'production',
        
        // Observability
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://alloy.monitoring:4318",
        OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
        OTEL_TRACES_EXPORTER: 'otlp',
        OTEL_METRICS_EXPORTER: 'otlp',
        OTEL_LOGS_EXPORTER: 'otlp',
        OTEL_SERVICE_NAME: `nextjs-${envName}`,
        OTEL_RESOURCE_ATTRIBUTES: `k8s.cluster.name=${envName}-vcluster,service.namespace=nextjs,service.name=nextjs-${envName}`,
        
        // Runtime
        NEXT_RUNTIME: 'nodejs',
        
        // Database connections (can be environment-specific)
        REDIS_URL: `redis://redis-service-${envName}:6379`,
        REDIS_AVAILABLE: 'true',
        
        // Proxy configuration
        TRUST_PROXY: '1',
        
        // Kubernetes metadata
        K8S_NAMESPACE: namespace,
        
        // Feature flags
        FLAGD_HOST: 'flagd.default.svc.cluster.local',
        FLAGD_PORT: '8013',
      },
    });

    // Deployment with environment-specific image
    new k8s.KubeDeployment(this, `${envName}-nextjs-deployment`, {
      metadata: {
        name: `nextjs-${envName}`,
        namespace: namespace,
        labels: {
          app: `nextjs-${envName}`,
          environment: envName,
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '10',
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: `nextjs-${envName}`,
            environment: envName,
          },
        },
        template: {
          metadata: {
            labels: {
              app: `nextjs-${envName}`,
              environment: envName,
            },
            annotations: {
              'openfeature.dev/enabled': 'false',
            },
          },
          spec: {
            imagePullSecrets: [
              { name: 'ghcr-dockercfg' }
            ],
            containers: [
              {
                name: 'nextjs',
                image: imageRef,
                imagePullPolicy: 'Always',
                // Dev containers sleep by default for development
                ...(envName === 'dev' ? { command: ['sleep', 'infinity'] } : {}),
                ports: [{ containerPort: envName === 'dev' ? 3000 : 80 }],
                envFrom: [
                  { configMapRef: { name: configMap.metadata.name } },
                  { secretRef: { name: 'app-env' } },
                  { secretRef: { name: 'neon-database-credentials' } },
                  { secretRef: { name: 'nextauth-credentials' } },
                ],
                env: [
                  {
                    name: 'FLAGD_PROTOCOL',
                    value: 'grpc',
                  },
                ],
                resources: {
                  requests: {
                    cpu: k8s.Quantity.fromString(envName === 'dev' ? '50m' : '100m'),
                    memory: k8s.Quantity.fromString(envName === 'dev' ? '128Mi' : '256Mi'),
                  },
                  limits: {
                    cpu: k8s.Quantity.fromString(envName === 'dev' ? '500m' : '1000m'),
                    memory: k8s.Quantity.fromString(envName === 'dev' ? '512Mi' : '1Gi'),
                  },
                },
              },
            ],
          },
        },
      },
    });

    // Service
    new k8s.KubeService(this, `${envName}-nextjs-service`, {
      metadata: {
        name: `nextjs-service-${envName}`,
        namespace: namespace,
        labels: {
          app: `nextjs-${envName}`,
          environment: envName,
        },
      },
      spec: {
        selector: {
          app: `nextjs-${envName}`,
          environment: envName,
        },
        ports: [{ 
          port: 3000,
          targetPort: k8s.IntOrString.fromNumber(envName === 'dev' ? 3000 : 80)
        }],
      },
    });

    // Ingress (only for environments that need external access)
    if (envName === 'staging') {
      new k8s.KubeIngress(this, `${envName}-nextjs-ingress`, {
        metadata: {
          name: `nextjs-ingress-${envName}`,
          namespace: namespace,
          labels: {
            app: `nextjs-${envName}`,
            environment: envName,
          },
          annotations: {
            'nginx.ingress.kubernetes.io/proxy-body-size': '10m',
            'nginx.ingress.kubernetes.io/proxy-read-timeout': '600',
            'nginx.ingress.kubernetes.io/proxy-send-timeout': '600',
          },
        },
        spec: {
          ingressClassName: 'nginx',
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
                        name: `nextjs-service-${envName}`,
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
}