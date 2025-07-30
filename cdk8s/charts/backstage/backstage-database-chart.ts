import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../../imports/k8s';

/**
 * Chart that creates the PostgreSQL database for Backstage
 */
export class BackstageDatabaseChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    // PostgreSQL Headless Service
    new k8s.KubeService(this, 'postgresql-service', {
      metadata: {
        labels: {
          app: 'postgresql'
        },
        name: 'postgresql',
        namespace: 'backstage'
      },
      spec: {
        clusterIp: 'None',
        ports: [
          {
            name: 'postgres',
            port: 5432
          }
        ],
        selector: {
          app: 'postgresql'
        }
      }
    });

    // PostgreSQL StatefulSet
    new k8s.KubeStatefulSet(this, 'postgresql-statefulset', {
      metadata: {
        labels: {
          app: 'postgresql'
        },
        name: 'postgresql',
        namespace: 'backstage',
        annotations: {
          'argocd.argoproj.io/sync-wave': '10'
        }
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: 'postgresql'
          }
        },
        serviceName: 'service-postgresql',
        template: {
          metadata: {
            labels: {
              app: 'postgresql'
            }
          },
          spec: {
            containers: [
              {
                env: [
                  {
                    name: 'POSTGRES_DB',
                    valueFrom: {
                      secretKeyRef: {
                        name: 'backstage-env-vars',
                        key: 'POSTGRES_DB'
                      }
                    }
                  },
                  {
                    name: 'POSTGRES_USER',
                    valueFrom: {
                      secretKeyRef: {
                        name: 'backstage-env-vars',
                        key: 'POSTGRES_USER'
                      }
                    }
                  },
                  {
                    name: 'POSTGRES_PASSWORD',
                    valueFrom: {
                      secretKeyRef: {
                        name: 'backstage-env-vars',
                        key: 'POSTGRES_PASSWORD'
                      }
                    }
                  }
                ],
                image: 'docker.io/library/postgres:15.3-alpine3.18',
                name: 'postgres',
                ports: [
                  {
                    containerPort: 5432,
                    name: 'postgresdb'
                  }
                ],
                resources: {
                  limits: {
                    memory: k8s.Quantity.fromString('500Mi')
                  },
                  requests: {
                    cpu: k8s.Quantity.fromString('100m'),
                    memory: k8s.Quantity.fromString('300Mi')
                  }
                },
                volumeMounts: [
                  {
                    name: 'data',
                    mountPath: '/var/lib/postgresql/data'
                  }
                ]
              }
            ]
          }
        },
        volumeClaimTemplates: [
          {
            metadata: {
              name: 'data'
            },
            spec: {
              accessModes: ['ReadWriteOnce'],
              resources: {
                requests: {
                  storage: k8s.Quantity.fromString('500Mi')
                }
              }
            }
          }
        ]
      }
    });
  }
}