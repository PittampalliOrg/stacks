import { Chart } from 'cdk8s';
import { Construct } from 'constructs';
import * as kplus from 'cdk8s-plus-32';

export class AlloyChart extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const ns = 'monitoring';

    /* OTLP + UI multi-port service */
    const otlp = new kplus.Service(this, 'alloy-otlp', {
      metadata: {
        name: 'alloy-otlp',
        namespace: ns,
        labels: { 'app.kubernetes.io/component': 'alloy' },
      },
      ports: [
        { name: 'otlp-grpc', port: 4317, targetPort: 4317 },
        { name: 'otlp-http', port: 4318, targetPort: 4318 },
        { name: 'http-ui',   port: 12345, targetPort: 12345 },
      ],
    });
    otlp.selectLabel('app.kubernetes.io/name', 'alloy');

    /* UI ClusterIP service */
    const ui = new kplus.Service(this, 'alloy-ui-svc', {
      metadata: { name: 'alloy-ui', namespace: ns },
      ports: [{ name: 'http', port: 12345, targetPort: 12345 }],
      type: kplus.ServiceType.CLUSTER_IP,
    });
    ui.selectLabel('app.kubernetes.io/name', 'alloy');

    /* Ingress */
    new kplus.Ingress(this, 'alloy-ingress', {
      metadata: {
        name: 'alloy-ui',
        namespace: ns,
        annotations: { 
          'nginx.ingress.kubernetes.io/rewrite-target': '/'
        },
      },
      className: 'nginx',
      rules: [
        {
          host: `alloy.${process.env.INGRESS_HOST || 'localtest.me'}`,
          path: '/',
          pathType: kplus.HttpIngressPathType.PREFIX,
          backend: kplus.IngressBackend.fromService(ui),
        },
      ],
    });
  }
}