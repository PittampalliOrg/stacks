import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../../imports/k8s';

export interface RedisChartProps extends ChartProps {
  // Additional props can be added here as needed
  replicas?: number;
}

export class RedisChart extends Chart {
  constructor(scope: Construct, id: string, props: RedisChartProps = {}) {
    super(scope, id, props);

    const namespace = 'nextjs';
    const replicas = props.replicas ?? 1; // Default to 1 replica for local dev
    
    // Create deployment for Redis
    new k8s.KubeDeployment(this, 'redis-deployment', {
      metadata: {
        name: 'redis-deployment',
        namespace: namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '60', // Deploy after postgres but before nextjs
        },
      },
      spec: {
        replicas: replicas,
        selector: {
          matchLabels: {
            app: 'redis',
          },
        },
        template: {
          metadata: {
            labels: {
              app: 'redis',
            },
          },
          spec: {
            containers: [
              {
                name: 'redis',
                // Use public Redis image
                image: 'redis:7-alpine',
                imagePullPolicy: 'IfNotPresent',
                ports: [{ containerPort: 6379 }],
                resources: {
                  requests: {
                    cpu: k8s.Quantity.fromString('50m'),
                    memory: k8s.Quantity.fromString('128Mi'),
                  },
                  limits: {
                    cpu: k8s.Quantity.fromString('200m'),
                    memory: k8s.Quantity.fromString('256Mi'),
                  },
                },
                livenessProbe: {
                  tcpSocket: {
                    port: k8s.IntOrString.fromNumber(6379),
                  },
                  initialDelaySeconds: 30,
                  periodSeconds: 10,
                  timeoutSeconds: 5,
                  failureThreshold: 3,
                },
                readinessProbe: {
                  exec: {
                    command: ['redis-cli', 'ping'],
                  },
                  initialDelaySeconds: 5,
                  periodSeconds: 5,
                  timeoutSeconds: 3,
                  successThreshold: 1,
                  failureThreshold: 3,
                },
                startupProbe: {
                  tcpSocket: {
                    port: k8s.IntOrString.fromNumber(6379),
                  },
                  initialDelaySeconds: 0,
                  periodSeconds: 10,
                  timeoutSeconds: 5,
                  successThreshold: 1,
                  failureThreshold: 30,
                },
              },
            ],
            // No imagePullSecrets needed - using public image
          },
        },
      },
    });

    // Create service
    new k8s.KubeService(this, 'redis-service', {
      metadata: {
        name: 'redis-service',
        namespace: namespace,
      },
      spec: {
        selector: {
          app: 'redis',
        },
        ports: [{ 
          port: 6379,
          targetPort: k8s.IntOrString.fromNumber(6379),
        }],
      },
    });
  }
}
