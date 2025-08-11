import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { VaultIngressChart } from './vault-ingress-chart';
import { VaultSecretStoreChart } from './vault-secret-store-chart';
import { VaultInitJobChart } from './vault-init-job-chart';
import { VaultConfigJobChart } from './vault-config-job-chart';
import { VaultUnsealerChart } from './vault-unsealer-chart';

export interface VaultChartProps extends ChartProps {
  namespace?: string;
}

/**
 * Main Vault chart that combines all Vault components
 */
export class VaultChart extends Chart {
  constructor(scope: Construct, id: string, props: VaultChartProps = {}) {
    super(scope, id, props);

    const namespace = props.namespace || 'vault';

    // Create all Vault resources in the correct order
    new VaultIngressChart(this, 'ingress', { namespace });
    new VaultSecretStoreChart(this, 'secret-store');
    new VaultInitJobChart(this, 'init-job', { namespace });
    new VaultConfigJobChart(this, 'config-job', { namespace });
    new VaultUnsealerChart(this, 'unsealer', { namespace });
  }
}
