import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../../imports/k8s';
import * as images from '../../../.env-files/images.json';

/**
 * Chart that creates the main Backstage deployment, service, and ingress
 */
export class BackstageAppChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    // Backstage Service
    new k8s.KubeService(this, 'backstage-service', {
      metadata: {
        name: 'backstage',
        namespace: 'backstage'
      },
      spec: {
        ports: [
          {
            name: 'http',
            port: 7007,
            targetPort: k8s.IntOrString.fromString('http')
          }
        ],
        selector: {
          app: 'backstage'
        }
      }
    });

    // Kubernetes Config Secret
    new k8s.KubeSecret(this, 'k8s-config', {
      metadata: {
        name: 'k8s-config',
        namespace: 'backstage'
      },
      stringData: {
        'k8s-config.yaml': `type: 'config'
clusters:
  - url: https://kubernetes.default.svc.cluster.local
    name: local
    authProvider: 'serviceAccount'
    skipTLSVerify: true
    skipMetricsLookup: true
    serviceAccountToken: 
      $file: /var/run/secrets/kubernetes.io/serviceaccount/token
    caData: 
      $file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt`
      }
    });

    // Backstage Deployment
    new k8s.KubeDeployment(this, 'backstage-deployment', {
      metadata: {
        name: 'backstage',
        namespace: 'backstage',
        annotations: {
          'argocd.argoproj.io/sync-wave': '20'
        }
      },
      spec: {
        replicas: 1,
        strategy: {
          type: 'Recreate'
        },
        selector: {
          matchLabels: {
            app: 'backstage'
          }
        },
        template: {
          metadata: {
            labels: {
              app: 'backstage'
            }
          },
          spec: {
            containers: [
              {
                name: 'backstage',
                image: images[(process.env.ENVIRONMENT as keyof typeof images) || 'dev'].backstage,
                env: [
                  {
                    name: 'LOG_LEVEL',
                    value: 'debug'
                  },
                  {
                    name: 'NODE_TLS_REJECT_UNAUTHORIZED',
                    value: '0'
                  },
                  {
                    name: 'NODE_ENV',
                    value: 'production'
                  }
                ],
                envFrom: [
                  {
                    secretRef: {
                      name: 'backstage-env-vars'
                    }
                  },
                  {
                    secretRef: {
                      name: 'gitea-credentials'
                    }
                  },
                  {
                    secretRef: {
                      name: 'argocd-credentials'
                    }
                  }
                ],
                ports: [
                  {
                    containerPort: 7007,
                    name: 'http'
                  }
                ]
              }
            ],
            serviceAccountName: 'backstage',
            imagePullSecrets: [
              {
                name: 'ghcr-dockercfg'
              }
            ]
          }
        }
      }
    });

    // Backstage Ingress
    new k8s.KubeIngress(this, 'backstage-ingress', {
      metadata: {
        name: 'backstage',
        namespace: 'backstage'
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [
          {
            host: 'localhost',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: 'backstage',
                      port: {
                        name: 'http'
                      }
                    }
                  }
                }
              ]
            }
          },
          {
            host: 'cnoe.localtest.me',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: 'backstage',
                      port: {
                        name: 'http'
                      }
                    }
                  }
                }
              ]
            }
          }
        ]
      }
    });
  }
}