import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../../imports/k8s';

export interface ClusterCorednsChartProps extends ChartProps {
  namespace?: string;
}

export class ClusterCorednsChart extends Chart {
  constructor(scope: Construct, id: string, props: ClusterCorednsChartProps = {}) {
    super(scope, id, props);

    const namespace = props.namespace || 'kube-system';

    new k8s.KubeConfigMap(this, 'coredns-conf-custom', {
      metadata: {
        name: 'coredns-conf-custom',
        namespace: namespace,
      },
      data: {
        'custom.conf': `rewrite stop {
  name exact cnoe.localtest.me ingress-nginx-controller.ingress-nginx.svc.cluster.local
  name exact vault.cnoe.localtest.me ingress-nginx-controller.ingress-nginx.svc.cluster.local
}`,
      },
    });
  }
}