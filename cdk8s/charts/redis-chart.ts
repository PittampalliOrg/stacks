import { Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { KubeDeployment, KubeService, IntOrString } from '../imports/k8s';

export class RedisChart extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const namespace = 'nextjs';
    
    // Create deployment using raw API object to avoid default security contexts
    new KubeDeployment(this, 'redis-deployment', {
      metadata: {
        name: 'redis-deployment',
        namespace: namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '5', // Deploy after external secrets are ready
        },
      },
      spec: {
        replicas: 2,
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
                image: 'redis/redis-stack:latest',
                ports: [{ containerPort: 6379 }],
                livenessProbe: {
                  tcpSocket: {
                    port: IntOrString.fromNumber(6379),
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
                    port: IntOrString.fromNumber(6379),
                  },
                  initialDelaySeconds: 0,
                  periodSeconds: 10,
                  timeoutSeconds: 5,
                  successThreshold: 1,
                  failureThreshold: 30,
                },
              },
            ],
          },
        },
      },
    });

    // Create service
    new KubeService(this, 'redis-service', {
      metadata: {
        name: 'redis-service',
        namespace: namespace,
      },
      spec: {
        selector: {
          app: 'redis',
        },
        ports: [{ port: 6379 }],
      },
    });
  }
}