import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { KubeNamespace } from '../imports/k8s';
import { Kargo } from '../imports/kargo';

export interface KargoHelmChartProps extends ChartProps {
  namespace?: string;
}

export class KargoHelmChart extends Chart {
  constructor(scope: Construct, id: string, props: KargoHelmChartProps = {}) {
    super(scope, id, props);

    const namespace = props.namespace || 'kargo';
    const baseHost = process.env.INGRESS_HOST || 'cnoe.localtest.me';
    const kargoHost = `kargo.${baseHost}`;

    // Create namespace
    new KubeNamespace(this, 'kargo-namespace', {
      metadata: {
        name: namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-20',
        },
        labels: {
          'app.kubernetes.io/name': 'kargo',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
      },
    });

    // Deploy Kargo using imported Helm chart construct
    new Kargo(this, 'kargo', {
      namespace: namespace,
      releaseName: 'kargo',
      values: {
        api: {
          // IMPORTANT: Set the host to avoid conflict with other services
          host: kargoHost,
          // Admin account configuration - hardcoded for now, should use External Secrets
          adminAccount: {
            passwordHash: '$2a$10$Zrhhie4vLz5ygtVSaif6o.qN36jgs6vjtMBdM6yrU1FOeiAAMMxOm',
            tokenSigningKey: 'YvUGEEoD430TBHCfzrxVifl4RD6PkO',
            tokenTTL: '24h',
          },
          // Service configuration
          service: {
            type: 'ClusterIP',
            port: 443,
          },
          // Enable gRPC web support for UI
          grpcWeb: true,
          // Logging
          logLevel: 'INFO',
          // TLS configuration - use existing certificates
          tls: {
            enabled: true,
            selfSignedCert: false,
          },
          // Ingress configuration
          ingress: {
            enabled: true,
            className: 'nginx',
            annotations: {
              'nginx.ingress.kubernetes.io/backend-protocol': 'HTTPS',
              'nginx.ingress.kubernetes.io/backend-tls-verify': 'false',
            },
            tls: {
              enabled: false, // nginx already handles TLS termination
            },
          },
          // Resources
          resources: {
            requests: {
              cpu: '100m',
              memory: '128Mi',
            },
            limits: {
              cpu: '500m',
              memory: '256Mi',
            },
          },
        },
        // Controller configuration
        controller: {
          logLevel: 'INFO',
          resources: {
            requests: {
              cpu: '100m',
              memory: '128Mi',
            },
            limits: {
              cpu: '500m',
              memory: '512Mi',
            },
          },
        },
        // Webhooks configuration
        webhooksServer: {
          tls: {
            selfSignedCert: false,
          },
        },
        webhooks: {
          logLevel: 'INFO',
          resources: {
            requests: {
              cpu: '100m',
              memory: '128Mi',
            },
            limits: {
              cpu: '200m',
              memory: '256Mi',
            },
          },
        },
        // Management controller configuration
        management: {
          logLevel: 'INFO',
          resources: {
            requests: {
              cpu: '50m',
              memory: '64Mi',
            },
            limits: {
              cpu: '100m',
              memory: '128Mi',
            },
          },
        },
        // Garbage collector configuration
        garbageCollector: {
          resources: {
            requests: {
              cpu: '50m',
              memory: '64Mi',
            },
            limits: {
              cpu: '100m',
              memory: '128Mi',
            },
          },
        },
        // External webhooks configuration
        externalWebhooksServer: {
          enabled: true,
          tls: {
            enabled: true,
            selfSignedCert: false,
          },
        },
        // Disable AWS-specific features for local development
        awsLoadBalancerController: {
          enabled: false,
        },
        // RBAC configuration
        rbac: {
          installClusterRoles: true,
          installClusterRoleBindings: true,
        },
        // Disable certificate generation
        certificates: {
          enabled: false,
        },
        // Additional annotations for all resources
        global: {
          annotations: {
            'app.kubernetes.io/managed-by': 'cdk8s',
          },
        },
      },
    });
  }
}