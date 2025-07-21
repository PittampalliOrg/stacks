import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

export interface ServiceConfig {
  name: string;
  namespace: string;
  port: number;
  targetPort: number;
  selector: Record<string, string>;
}

export interface IngressConfig {
  name: string;
  namespace: string;
  hostname: string;
  serviceName: string;
  servicePort?: number;
  path?: string;
  pathType?: string;
  tlsEnabled?: boolean;
}

export abstract class BaseChart extends Chart {
  protected readonly domain = 'localtest.me';
  protected readonly tlsEnabled = false; // Set to true for production-like setup

  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);
  }

  /**
   * Creates a standard ClusterIP service
   */
  protected createStandardService(config: ServiceConfig): k8s.KubeService {
    return new k8s.KubeService(this, `${config.name}-service`, {
      metadata: {
        name: config.name,
        namespace: config.namespace,
      },
      spec: {
        type: 'ClusterIP', // Always ClusterIP for internal services
        selector: config.selector,
        ports: [{
          name: 'http',
          port: config.port,
          targetPort: k8s.IntOrString.fromNumber(config.targetPort),
          protocol: 'TCP',
        }],
      },
    });
  }

  /**
   * Creates a standard Ingress rule
   */
  protected createStandardIngress(config: IngressConfig): k8s.KubeIngress {
    const tlsConfig = this.tlsEnabled ? [{
      hosts: [config.hostname],
      secretName: `${config.name}-tls`,
    }] : undefined;

    return new k8s.KubeIngress(this, `${config.name}-ingress`, {
      metadata: {
        name: `${config.name}-ingress`,
        namespace: config.namespace,
        annotations: {
          // Removed NGINX-specific annotation: 'nginx.ingress.kubernetes.io/rewrite-target': '/$2',
          // This annotation is not compatible with Cilium Ingress Controller
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [{
          host: config.hostname,
          http: {
            paths: [{
              path: config.path || '/',
              pathType: config.pathType || 'Prefix',
              backend: {
                service: {
                  name: config.serviceName,
                  port: {
                    number: config.servicePort || 80,
                  },
                },
              },
            }],
          },
        }],
        tls: tlsConfig,
      },
    });
  }

  /**
   * Creates both service and ingress with standard patterns
   */
  protected createServiceWithIngress(
    name: string,
    namespace: string,
    targetPort: number,
    selector: Record<string, string>,
    subdomain: string,
  ): { service: k8s.KubeService; ingress: k8s.KubeIngress } {
    const service = this.createStandardService({
      name,
      namespace,
      port: 80, // Standard port for all services
      targetPort,
      selector,
    });

    const ingress = this.createStandardIngress({
      name,
      namespace,
      hostname: `${subdomain}.${this.domain}`,
      serviceName: name,
      servicePort: 80,
    });

    return { service, ingress };
  }

  /**
   * Helper to create health check probes
   */
  protected createHealthProbes(
    path: string = '/health',
    initialDelaySeconds: number = 30,
  ): {
    livenessProbe: k8s.Probe;
    readinessProbe: k8s.Probe;
  } {
    const livenessProbe: k8s.Probe = {
      httpGet: {
        path,
        port: k8s.IntOrString.fromNumber(80),
      },
      initialDelaySeconds,
      periodSeconds: 10,
      timeoutSeconds: 5,
      failureThreshold: 3,
    };

    const readinessProbe: k8s.Probe = {
      httpGet: {
        path,
        port: k8s.IntOrString.fromNumber(80),
      },
      initialDelaySeconds: 5,
      periodSeconds: 5,
      timeoutSeconds: 3,
      successThreshold: 1,
      failureThreshold: 3,
    };

    return { livenessProbe, readinessProbe };
  }
}