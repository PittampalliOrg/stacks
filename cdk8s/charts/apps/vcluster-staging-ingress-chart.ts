import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../../imports/k8s';

/**
 * Ingress for staging vcluster API access with SSL passthrough
 * This allows external access to the vcluster API server
 */
export class VclusterStagingIngressChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);
    
    new k8s.KubeIngress(this, 'vcluster-staging-ingress', {
      metadata: {
        name: 'vcluster-staging-ingress',
        namespace: 'staging-vcluster',
        annotations: {
          // We need the ingress to pass through ssl traffic to the vCluster
          // This only works for the nginx-ingress (enabled via --enable-ssl-passthrough)
          'nginx.ingress.kubernetes.io/backend-protocol': 'HTTPS',
          'nginx.ingress.kubernetes.io/ssl-passthrough': 'true',
          'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
          'argocd.argoproj.io/sync-wave': '15', // After vcluster is created
        },
        labels: {
          'app.kubernetes.io/name': 'vcluster-staging-ingress',
          'app.kubernetes.io/component': 'ingress',
          'app.kubernetes.io/instance': 'staging',
          'app.kubernetes.io/part-of': 'vcluster',
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [{
          host: 'staging-vcluster.cnoe.localtest.me',
          http: {
            paths: [{
              path: '/',
              pathType: 'ImplementationSpecific',
              backend: {
                service: {
                  name: 'vcluster-staging-helm',
                  port: { number: 443 }
                }
              }
            }]
          }
        }]
      }
    });
  }
}