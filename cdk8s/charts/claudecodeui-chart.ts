import { Chart, ApiObject, ChartProps } from 'cdk8s';
import * as kplus from 'cdk8s-plus-32';
import { Construct } from 'constructs';
import { getImage } from '../lib/image-loader';

export interface ClaudeCodeUIChartProps extends ChartProps {
}

export class ClaudeCodeUIChart extends Chart {
  constructor(scope: Construct, id: string, props: ClaudeCodeUIChartProps = {}) {
    super(scope, id, props);

    const namespace = 'nextjs';
    
    // ConfigMap for environment variables
    const configMap = new kplus.ConfigMap(this, 'config', {
      metadata: { 
        name: 'claudecodeui-config', 
        namespace
      },
      data: {
        // Claude Code UI configuration
        PORT: '3001',
        NODE_ENV: process.env.NODE_ENV || 'production',
        
        // WebSocket configuration - use ingress hostname
        WEBSOCKET_URL: 'ws://claudecodeui.localtest.me',
        
        // Runtime environment
        K8S_NAMESPACE: namespace,
        
        // Grafana MCP configuration
        GRAFANA_URL: 'http://grafana.monitoring.svc.cluster.local:80',
      },
    });

    // Note: Grafana API token is created by the grafana-token-job
    // and stored in the 'grafana-api-token' secret in the monitoring namespace.
    // We'll reference it directly instead of using ExternalSecret.

    // Deployment
    const deployment = new ApiObject(this, 'claudecodeui-deployment', {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: 'claudecodeui-deployment',
        namespace: namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '10', // Deploy alongside other apps
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: 'claudecodeui',
          },
        },
        template: {
          metadata: {
            labels: {
              app: 'claudecodeui',
            },
          },
          spec: {
            imagePullSecrets: [{ name: 'vpittamp-acr-dockercfg' }],
            containers: [
              {
                name: 'claudecodeui',
                image: getImage('claudecodeui'),
                imagePullPolicy: 'Always',
                ports: [{ containerPort: 3001 }],
                envFrom: [
                  { configMapRef: { name: configMap.name } },
                  { secretRef: { name: 'grafana-api-token' } },
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
                livenessProbe: {
                  httpGet: {
                    path: '/',
                    port: 3001,
                  },
                  initialDelaySeconds: 30,
                  periodSeconds: 30,
                },
                readinessProbe: {
                  httpGet: {
                    path: '/',
                    port: 3001,
                  },
                  initialDelaySeconds: 10,
                  periodSeconds: 10,
                },
              },
            ],
          },
        },
      },
    });

    // Service
    new ApiObject(this, 'claudecodeui-service', {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: 'claudecodeui-service',
        namespace: namespace,
      },
      spec: {
        selector: {
          app: 'claudecodeui',
        },
        ports: [{ 
          port: 3001,
          targetPort: 3001,
          protocol: 'TCP',
          name: 'http'
        }],
        type: 'ClusterIP',
      },
    });

    // Ingress
    new ApiObject(this, 'claudecodeui-ingress', {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: 'claudecodeui-ingress',
        namespace: namespace,
        annotations: {
          // Basic ingress annotations
          'argocd.argoproj.io/sync-wave': '25', // After services
          // WebSocket support annotations for nginx
          'nginx.ingress.kubernetes.io/proxy-read-timeout': '3600',
          'nginx.ingress.kubernetes.io/proxy-send-timeout': '3600',
          'nginx.ingress.kubernetes.io/websocket-services': 'claudecodeui-service',
          'nginx.ingress.kubernetes.io/upstream-hash-by': '$binary_remote_addr',
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [
          {
            host: `claudecodeui.${process.env.INGRESS_HOST || 'localtest.me'}`,
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: 'claudecodeui-service',
                      port: {
                        number: 3001,
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