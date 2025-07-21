import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

export interface CoreDNSConfigChartProps extends ChartProps {
  // DNS servers to forward to (default: Google DNS)
  forwardServers?: string[];
}

export class CoreDNSConfigChart extends Chart {
  constructor(scope: Construct, id: string, props: CoreDNSConfigChartProps = {}) {
    super(scope, id, props);

    const forwardServers = props.forwardServers || ['8.8.8.8', '8.8.4.4'];

    // CoreDNS ConfigMap with reliable DNS forwarding
    // This fixes DNS resolution issues in WSL2/Kind environments
    new k8s.KubeConfigMap(this, 'coredns', {
      metadata: {
        name: 'coredns',
        namespace: 'kube-system',
        annotations: {
          'argocd.argoproj.io/sync-wave': '-5',  // Deploy early
          'argocd.argoproj.io/sync-options': 'Replace=true'
        }
      },
      data: {
        Corefile: `.:53 {
    errors
    health {
       lameduck 5s
    }
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {
       pods insecure
       fallthrough in-addr.arpa ip6.arpa
       ttl 30
    }
    prometheus :9153
    forward . ${forwardServers.join(' ')} {
       max_concurrent 1000
    }
    cache 30
    loop
    reload
    loadbalance
}`
      }
    });
  }
}