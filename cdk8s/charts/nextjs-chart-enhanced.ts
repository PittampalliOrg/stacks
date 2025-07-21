import { Chart, ApiObject, ChartProps } from 'cdk8s';
import * as kplus from 'cdk8s-plus-32';
import { Construct } from 'constructs';
import { InfraSecretsChart } from './infra-secrets-chart';
import { EnvironmentConfig, getEnvironmentConfig } from '../lib/environment-config';

export interface NextJsEnhancedChartProps extends ChartProps {
  infraSecrets?: InfraSecretsChart;
  /** Optional: Override the environment configuration */
  environmentConfig?: EnvironmentConfig;
}

/**
 * Enhanced NextJS Chart with environment-specific configuration
 * This demonstrates best practices for handling different environments in CDK8s
 */
export class NextJsEnhancedChart extends Chart {
  constructor(scope: Construct, id: string, props: NextJsEnhancedChartProps = {}) {
    super(scope, id, props);

    const namespace = 'nextjs';
    
    // Get environment configuration
    const envConfig = props.environmentConfig || getEnvironmentConfig();
    const isDev = envConfig.environment === 'dev';
    const isProduction = envConfig.environment === 'production';
    const isAKS = envConfig.clusterType === 'aks';
    
    // ConfigMap with environment-aware values
    const configMap = new kplus.ConfigMap(this, 'config', {
      metadata: { 
        name: 'myapp-config', 
        namespace
      },
      data: {
        // Authentication URLs - environment-specific
        NEXTAUTH_URL: `https://${envConfig.ingress.host}`,
        NEXT_PUBLIC_BASE_URL: `https://${envConfig.ingress.host}`,
        NEXT_PUBLIC_SITE_URL: `https://${envConfig.ingress.host}`,
        AUTH_URL: `https://${envConfig.ingress.host}`,
        
        // Use HTTP for local development
        ...(isDev && {
          NEXTAUTH_URL: `http://${envConfig.ingress.host}`,
          NEXT_PUBLIC_BASE_URL: `http://${envConfig.ingress.host}`,
          NEXT_PUBLIC_SITE_URL: `http://${envConfig.ingress.host}`,
          AUTH_URL: `http://${envConfig.ingress.host}`,
        }),
        
        // Static configuration
        NEXT_PUBLIC_BASE_PATH: '',
        AUTH_TRUST_HOST: 'true',
        NEXTAUTH_URL_INTERNAL: 'http://nextjs-service:3000',
        
        // Observability - environment-specific endpoints
        OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_ENDPOINT || 
          (isDev ? 'http://alloy.monitoring:4318' : 'https://otel-collector.monitoring:4318'),
        OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
        OTEL_SERVICE_NAME: 'nextjs',
        OTEL_RESOURCE_ATTRIBUTES: `k8s.cluster.name=${envConfig.clusterType}-${envConfig.environment},service.namespace=nextjs,service.name=nextjs`,
        OTEL_LOG_LEVEL: isDev ? 'debug' : 'info',
        
        // Runtime environment
        NEXT_RUNTIME: 'nodejs',
        NODE_ENV: isProduction ? 'production' : 'development',
        
        // Database connections
        REDIS_URL: 'redis://redis-service:6379',
        REDIS_AVAILABLE: 'true',
        
        // Proxy configuration
        TRUST_PROXY: '1',
        
        // Kubernetes metadata
        K8S_NAMESPACE: namespace,
        K8S_ENVIRONMENT: envConfig.environment,
        K8S_CLUSTER_TYPE: envConfig.clusterType,
        
        // Feature flag configuration
        FLAGD_HOST: 'flagd.default.svc.cluster.local',
        FLAGD_PORT: '8013',
      },
    });

    // Deployment with environment-specific resources
    const deployment = new ApiObject(this, 'nextjs-deployment', {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: 'nextjs-deployment',
        namespace: namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '10',
        },
      },
      spec: {
        replicas: envConfig.resources?.replicas || 1,
        selector: {
          matchLabels: {
            app: 'nextjs',
          },
        },
        template: {
          metadata: {
            labels: {
              app: 'nextjs',
              environment: envConfig.environment,
              'app.kubernetes.io/name': 'nextjs',
              'app.kubernetes.io/instance': `nextjs-${envConfig.environment}`,
            },
            annotations: {
              'openfeature.dev/enabled': 'false',
            },
          },
          spec: {
            // Only use image pull secrets for private registries (AKS with ACR)
            ...(isAKS && {
              imagePullSecrets: [{ name: 'vpittamp-acr-dockercfg' }],
            }),
            containers: [
              {
                name: 'nextjs',
                image: process.env.NEXTJS_IMAGE || 'vpittamp.azurecr.io/chat-frontend:latest',
                imagePullPolicy: 'Always',
                ports: [{ containerPort: 3000 }],
                envFrom: [
                  { configMapRef: { name: configMap.name } },
                  { secretRef: { name: 'app-env' } },
                  { secretRef: { name: 'neon-database-credentials' } },
                  { secretRef: { name: 'nextauth-credentials' } },
                ],
                resources: {
                  requests: envConfig.resources?.requests || {
                    cpu: '100m',
                    memory: '256Mi',
                  },
                  limits: envConfig.resources?.limits || {
                    cpu: '1000m',
                    memory: '1Gi',
                  },
                },
                // Health checks for production environments
                ...(isProduction && {
                  livenessProbe: {
                    httpGet: {
                      path: '/api/health',
                      port: 3000,
                    },
                    initialDelaySeconds: 30,
                    periodSeconds: 10,
                  },
                  readinessProbe: {
                    httpGet: {
                      path: '/api/health',
                      port: 3000,
                    },
                    initialDelaySeconds: 5,
                    periodSeconds: 5,
                  },
                }),
              },
            ],
            // Production-specific configurations
            ...(isProduction && {
              affinity: {
                podAntiAffinity: {
                  preferredDuringSchedulingIgnoredDuringExecution: [{
                    weight: 100,
                    podAffinityTerm: {
                      labelSelector: {
                        matchExpressions: [{
                          key: 'app',
                          operator: 'In',
                          values: ['nextjs'],
                        }],
                      },
                      topologyKey: 'kubernetes.io/hostname',
                    },
                  }],
                },
              },
            }),
          },
        },
      },
    });

    // Service with environment-specific configuration
    new ApiObject(this, 'nextjs-service', {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: 'nextjs-service',
        namespace: namespace,
        ...(envConfig.service?.annotations && {
          annotations: envConfig.service.annotations,
        }),
      },
      spec: {
        type: envConfig.service?.type || 'ClusterIP',
        selector: {
          app: 'nextjs',
        },
        ports: [{ 
          port: 3000,
          targetPort: 3000,
          name: 'http',
        }],
      },
    });

    // Ingress with environment-specific configuration
    new ApiObject(this, 'nextjs-ingress', {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: 'nextjs-ingress',
        namespace: namespace,
        annotations: {
          // Default annotations
          'kubernetes.io/ingress.class': envConfig.ingress.className,
          
          // Environment-specific annotations
          ...envConfig.ingress.annotations,
          
          // NGINX-specific annotations for non-dev environments
          ...(!isDev && {
            'nginx.ingress.kubernetes.io/proxy-body-size': '10m',
            'nginx.ingress.kubernetes.io/proxy-read-timeout': '600',
            'nginx.ingress.kubernetes.io/proxy-send-timeout': '600',
          }),
        },
      },
      spec: {
        ingressClassName: envConfig.ingress.className,
        // TLS configuration for non-dev environments
        ...(envConfig.ingress.enableTLS && {
          tls: [{
            hosts: [envConfig.ingress.host],
            secretName: `nextjs-tls-${envConfig.environment}`,
          }],
        }),
        rules: [
          {
            host: envConfig.ingress.host,
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

    // Production-specific resources
    if (isProduction) {
      // PodDisruptionBudget for high availability
      new ApiObject(this, 'nextjs-pdb', {
        apiVersion: 'policy/v1',
        kind: 'PodDisruptionBudget',
        metadata: {
          name: 'nextjs-pdb',
          namespace: namespace,
        },
        spec: {
          minAvailable: 1,
          selector: {
            matchLabels: {
              app: 'nextjs',
            },
          },
        },
      });

      // HorizontalPodAutoscaler for auto-scaling
      new ApiObject(this, 'nextjs-hpa', {
        apiVersion: 'autoscaling/v2',
        kind: 'HorizontalPodAutoscaler',
        metadata: {
          name: 'nextjs-hpa',
          namespace: namespace,
        },
        spec: {
          scaleTargetRef: {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            name: 'nextjs-deployment',
          },
          minReplicas: envConfig.resources?.replicas || 2,
          maxReplicas: 10,
          metrics: [
            {
              type: 'Resource',
              resource: {
                name: 'cpu',
                target: {
                  type: 'Utilization',
                  averageUtilization: 70,
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
    }
  }
}