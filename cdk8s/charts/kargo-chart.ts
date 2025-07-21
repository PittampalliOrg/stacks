import { Chart } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

export class KargoChart extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id); 

    const ns = 'kargo'; 

    // Note: kargo namespace is created by platform-core-chart.ts

    // Note: The Kargo Helm chart is installed by kargo-helm-app-chart.ts which handles:
    // - Namespace creation
    // - All RBAC resources
    // - Services and deployments
    // - CRDs
    // 
    // This chart only adds the ingress for UI access since the Helm chart
    // doesn't include ingress by default.

    // Create ingress for Kargo UI using raw Kubernetes API
    // This references the existing kargo-api service created by the Helm chart
    new k8s.KubeIngress(this, 'kargo-ingress', {
      metadata: {
        name: 'kargo-ui',
        namespace: ns,
        annotations: {
          'nginx.ingress.kubernetes.io/backend-protocol': 'HTTPS',
          'nginx.ingress.kubernetes.io/backend-tls-verify': 'false'
        }
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [{
          host: `kargo.${process.env.INGRESS_HOST || 'localtest.me'}`,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: 'kargo-api',
                  port: {
                    number: 443
                  }
                }
              }
            }]
          }
        }]
      }
    });
  }
}