import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

export class ArgoWorkflowsIngressChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const namespace = 'argo-workflows';
    const ingressHost = process.env.INGRESS_HOST || 'localtest.me';
    const enableTls = process.env.ENABLE_TLS === 'true';
    const protocol = enableTls ? 'https' : 'http';

    // Create Ingress for Argo Workflows Server
    new k8s.KubeIngress(this, 'argo-workflows-ingress', {
      metadata: {
        name: 'argo-workflows-server-ingress',
        namespace,
        annotations: {
          'nginx.ingress.kubernetes.io/backend-protocol': 'HTTP',
          'nginx.ingress.kubernetes.io/proxy-body-size': '100m',
          'nginx.ingress.kubernetes.io/proxy-read-timeout': '600',
          'nginx.ingress.kubernetes.io/proxy-send-timeout': '600',
          // Argo Workflows specific annotations
          'nginx.ingress.kubernetes.io/grpc-backend': 'false',
          ...(enableTls && { 'cert-manager.io/cluster-issuer': process.env.CLUSTER_ISSUER || 'letsencrypt-prod' })
        }
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [{
          host: `argo-workflows.${ingressHost}`,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: 'argo-workflows-server',
                  port: {
                    number: 2746
                  }
                }
              }
            }]
          }
        }],
        ...(enableTls && {
          tls: [{
            hosts: [`argo-workflows.${ingressHost}`],
            secretName: 'argo-workflows-tls'
          }]
        })
      }
    });
  }
}