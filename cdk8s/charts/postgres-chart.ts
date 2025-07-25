import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

export interface PostgresChartProps extends ChartProps {
  // Additional props can be added here as needed
}

export class PostgresChart extends Chart {
  constructor(scope: Construct, id: string, props: PostgresChartProps = {}) {
    super(scope, id, props);

    const namespace = 'nextjs';

    // Note: The neon-database-credentials secret is created separately
    // This maintains separation of concerns - applications consume secrets, not create them

    // Create a headless service that maintains compatibility with existing configurations
    // This allows apps to continue using postgres-service.nextjs.svc.cluster.local
    // but actually connects to Neon cloud
    new k8s.KubeService(this, 'postgres-service', {
      metadata: {
        name: 'postgres-service',
        namespace: namespace,
        annotations: {
          'description': 'Headless service for Neon cloud PostgreSQL compatibility',
          'argocd.argoproj.io/sync-wave': '50',
        },
      },
      spec: {
        type: 'ExternalName',
        externalName: 'ep-wispy-math-a8k8xapb-pooler.eastus2.azure.neon.tech',
        ports: [{
          name: 'pg',
          port: 5432,
          targetPort: k8s.IntOrString.fromNumber(5432),
        }],
      },
    });

    // Create ConfigMap with database connection info for debugging
    new k8s.KubeConfigMap(this, 'postgres-info', {
      metadata: {
        name: 'postgres-connection-info',
        namespace: namespace,
      },
      data: {
        'connection-type': 'neon-cloud',
        'pooling': 'enabled',
        'ssl-mode': 'require',
        'info': 'Database is hosted on Neon cloud. Connection string is stored in neon-database-credentials secret.',
        'migration-note': 'Run database migrations using your application migration tools (Prisma, Drizzle, etc.)',
      },
    });
  }
}