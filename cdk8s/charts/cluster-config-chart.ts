import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { ClusterCorednsChart } from './cluster/cluster-coredns-chart';

export interface ClusterConfigChartProps extends ChartProps {
  namespace?: string;
}

/**
 * Cluster configuration chart that creates CoreDNS custom configuration
 */
export class ClusterConfigChart extends Chart {
  constructor(scope: Construct, id: string, props: ClusterConfigChartProps = {}) {
    super(scope, id, props);

    const namespace = props.namespace || 'kube-system';

    // Create CoreDNS custom configuration
    new ClusterCorednsChart(this, 'coredns', {
      namespace: namespace,
    });
  }
}