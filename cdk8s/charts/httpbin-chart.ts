import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';
import { Quantity } from '../imports/k8s';

/**
 * HttpbinChart deploys the httpbin test application
 * This is used to test Gateway API functionality
 */
export class HttpbinChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    const namespace = 'default'; // Deploy to default namespace as per kgateway docs
    const kgatewayNamespace = 'kgateway-system';

    // Httpbin Deployment
    new k8s.KubeDeployment(this, 'httpbin-deployment', {
      metadata: {
        name: 'httpbin',
        namespace: namespace,
        labels: {
          'app': 'httpbin',
          'app.kubernetes.io/name': 'httpbin',
          'app.kubernetes.io/component': 'test-app',
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            'app': 'httpbin',
          },
        },
        template: {
          metadata: {
            labels: {
              'app': 'httpbin',
              'app.kubernetes.io/name': 'httpbin',
              'app.kubernetes.io/component': 'test-app',
            },
          },
          spec: {
            containers: [{
              name: 'httpbin',
              image: 'docker.io/kennethreitz/httpbin:latest',
              ports: [{
                name: 'http',
                containerPort: 80,
                protocol: 'TCP',
              }],
              resources: {
                requests: {
                  cpu: Quantity.fromString('100m'),
                  memory: Quantity.fromString('128Mi'),
                },
                limits: {
                  cpu: Quantity.fromString('500m'),
                  memory: Quantity.fromString('256Mi'),
                },
              },
              livenessProbe: {
                httpGet: {
                  path: '/status/200',
                  port: k8s.IntOrString.fromNumber(80),
                },
                initialDelaySeconds: 30,
                periodSeconds: 30,
              },
              readinessProbe: {
                httpGet: {
                  path: '/status/200',
                  port: k8s.IntOrString.fromNumber(80),
                },
                initialDelaySeconds: 5,
                periodSeconds: 10,
              },
            }],
          },
        },
      },
    });

    // Httpbin Service
    new k8s.KubeService(this, 'httpbin-service', {
      metadata: {
        name: 'httpbin',
        namespace: namespace,
        labels: {
          'app': 'httpbin',
          'app.kubernetes.io/name': 'httpbin',
          'app.kubernetes.io/component': 'test-app',
        },
      },
      spec: {
        selector: {
          'app': 'httpbin',
        },
        type: 'ClusterIP',
        ports: [{
          name: 'http',
          protocol: 'TCP',
          port: 8080,
          targetPort: k8s.IntOrString.fromNumber(80),
        }],
      },
    });

    // HTTPRoute for httpbin through the http gateway
    new ApiObject(this, 'httpbin-route', {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'HTTPRoute',
      metadata: {
        name: 'httpbin',
        namespace: namespace,
        labels: {
          'app.kubernetes.io/name': 'httpbin',
          'app.kubernetes.io/component': 'test-app',
        },
      },
      spec: {
        parentRefs: [{
          group: 'gateway.networking.k8s.io',
          kind: 'Gateway',
          name: 'http',
          namespace: kgatewayNamespace,
        }],
        hostnames: ['httpbin.localtest.me'],
        rules: [{
          matches: [{
            path: {
              type: 'PathPrefix',
              value: '/',
            },
          }],
          backendRefs: [{
            group: '',
            kind: 'Service',
            name: 'httpbin',
            port: 8080,
            weight: 1,
          }],
        }],
      },
    });

    // Create ReferenceGrant to allow HTTPRoute to reference the gateway in kgateway-system
    new ApiObject(this, 'httpbin-reference-grant', {
      apiVersion: 'gateway.networking.k8s.io/v1beta1',
      kind: 'ReferenceGrant',
      metadata: {
        name: 'allow-httpbin-to-gateway',
        namespace: kgatewayNamespace, // Must be in the namespace being referenced
      },
      spec: {
        from: [{
          group: 'gateway.networking.k8s.io',
          kind: 'HTTPRoute',
          namespace: namespace, // Allow HTTPRoutes from default namespace
        }],
        to: [{
          group: 'gateway.networking.k8s.io',
          kind: 'Gateway',
        }],
      },
    });
  }
}