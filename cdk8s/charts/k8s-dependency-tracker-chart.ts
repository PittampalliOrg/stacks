import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

/**
 * Additional resources for Kubernetes Dependency Tracker
 * This chart creates supplementary resources not managed by the Helm chart
 * such as ServiceMonitor for Prometheus integration
 */
export class K8sDependencyTrackerChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const namespace = 'k8s-dependency-tracker';
    const appName = 'k8s-dependency-tracker';

    // ServiceMonitor for Prometheus scraping (if metrics are exposed)
    new ApiObject(this, 'service-monitor', {
      apiVersion: 'monitoring.coreos.com/v1',
      kind: 'ServiceMonitor',
      metadata: {
        name: `${appName}-metrics`,
        namespace,
        labels: {
          'app.kubernetes.io/name': appName,
          'app.kubernetes.io/part-of': 'backstage-integration',
          'prometheus.io/scrape': 'true'
        }
      },
      spec: {
        selector: {
          matchLabels: {
            'app.kubernetes.io/name': appName
          }
        },
        endpoints: [{
          port: 'http',
          path: '/metrics',
          interval: '30s',
          scrapeTimeout: '10s'
        }]
      }
    });

    // NetworkPolicy to allow traffic from Backstage
    new k8s.KubeNetworkPolicy(this, 'network-policy', {
      metadata: {
        name: `${appName}-ingress`,
        namespace,
        labels: {
          'app.kubernetes.io/name': appName,
          'app.kubernetes.io/part-of': 'backstage-integration'
        }
      },
      spec: {
        podSelector: {
          matchLabels: {
            'app.kubernetes.io/name': appName
          }
        },
        policyTypes: ['Ingress'],
        ingress: [
          {
            // Allow traffic from NGINX ingress controller
            from: [{
              namespaceSelector: {
                matchLabels: {
                  'name': 'ingress-nginx'
                }
              }
            }],
            ports: [{
              protocol: 'TCP',
              port: k8s.IntOrString.fromNumber(8080)
            }]
          },
          {
            // Allow traffic from Backstage namespace
            from: [{
              namespaceSelector: {
                matchLabels: {
                  'name': 'backstage'
                }
              }
            }],
            ports: [{
              protocol: 'TCP',
              port: k8s.IntOrString.fromNumber(8080)
            }]
          },
          {
            // Allow traffic from Prometheus for metrics scraping
            from: [{
              namespaceSelector: {
                matchLabels: {
                  'name': 'monitoring'
                }
              }
            }],
            ports: [{
              protocol: 'TCP',
              port: k8s.IntOrString.fromNumber(8080)
            }]
          }
        ]
      }
    });

    // PodDisruptionBudget for high availability
    new k8s.KubePodDisruptionBudget(this, 'pdb', {
      metadata: {
        name: appName,
        namespace,
        labels: {
          'app.kubernetes.io/name': appName,
          'app.kubernetes.io/part-of': 'backstage-integration'
        }
      },
      spec: {
        minAvailable: k8s.IntOrString.fromNumber(1),
        selector: {
          matchLabels: {
            'app.kubernetes.io/name': appName
          }
        }
      }
    });
  }
}