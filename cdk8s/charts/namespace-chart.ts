import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { KubeNamespace } from '../imports/k8s';

export interface NamespaceChartProps extends ChartProps {
  name: string;
  labels?: Record<string, string>;
}

export class NamespaceChart extends Chart {
  constructor(scope: Construct, id: string, props: NamespaceChartProps) {
    super(scope, id, props);

    const nsLabels: Record<string, string> = {
      'app.kubernetes.io/managed-by': 'argocd',
      ...(props.labels || {}),
    };

    new KubeNamespace(this, 'namespace', {
      metadata: {
        name: props.name,
        labels: nsLabels,
      },
    });
  }
}

