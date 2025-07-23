import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { KubeServiceAccount, KubeRole, KubeRoleBinding } from '../imports/k8s';

export interface ServiceAccountConfig {
  namespace: string;
  name: string;
}

export interface WorkloadIdentityServiceAccountsChartProps extends ChartProps {
  /**
   * Azure Client ID for workload identity
   */
  azureClientId?: string;
  
  /**
   * Service account configurations
   * @default - external-secrets:external-secrets
   */
  serviceAccounts?: ServiceAccountConfig[];
}

/**
 * Workload Identity Service Accounts Chart
 * Manages service accounts with workload identity annotations and RBAC
 */
export class WorkloadIdentityServiceAccountsChart extends Chart {
  constructor(scope: Construct, id: string, props: WorkloadIdentityServiceAccountsChartProps = {}) {
    super(scope, id, props);

    const azureClientId = props.azureClientId || process.env.AZURE_CLIENT_ID || process.env.APP_ID;
    
    if (!azureClientId) {
      throw new Error('Azure Client ID is required. Set AZURE_CLIENT_ID or APP_ID environment variable.');
    }

    // Default service accounts from the bash script
    const defaultServiceAccounts: ServiceAccountConfig[] = [
      { namespace: 'external-secrets', name: 'external-secrets' },
    ];

    // Parse WORKLOAD_IDENTITY_SERVICE_ACCOUNTS environment variable if set
    const envServiceAccounts = process.env.WORKLOAD_IDENTITY_SERVICE_ACCOUNTS;
    if (envServiceAccounts) {
      const parsedAccounts = envServiceAccounts.split(' ').map(sa => {
        const [namespace, name] = sa.split(':');
        return { namespace, name };
      });
      defaultServiceAccounts.push(...parsedAccounts);
    }

    const serviceAccounts = props.serviceAccounts || defaultServiceAccounts;

    // Process each service account
    serviceAccounts.forEach(sa => {
      // For external-secrets namespace, we just need to annotate the existing SA
      if (sa.namespace === 'external-secrets' && sa.name === 'external-secrets') {
        // This is handled by patching the existing service account
        // In a real deployment, this would be done via kubectl annotate
        // For CDK8s, we'll create a patch resource
        new KubeServiceAccount(this, `sa-patch-${sa.namespace}-${sa.name}`, {
          metadata: {
            name: sa.name,
            namespace: sa.namespace,
            annotations: {
              'azure.workload.identity/client-id': azureClientId,
            },
          },
        });
      } else {
        // Create service account for other namespaces
        new KubeServiceAccount(this, `sa-${sa.namespace}-${sa.name}`, {
          metadata: {
            name: sa.name,
            namespace: sa.namespace,
            annotations: {
              'azure.workload.identity/client-id': azureClientId,
            },
          },
        });
      }

      // Create RBAC for ESO store service accounts
      if (sa.name === 'eso-store') {
        // Create Role
        new KubeRole(this, `role-${sa.namespace}-eso-store`, {
          metadata: {
            name: 'eso-store-reader',
            namespace: sa.namespace,
          },
          rules: [{
            apiGroups: [''],
            resources: ['secrets'],
            verbs: ['get', 'list', 'watch'],
          }],
        });

        // Create RoleBinding
        new KubeRoleBinding(this, `rolebinding-${sa.namespace}-eso-store`, {
          metadata: {
            name: 'eso-store-reader',
            namespace: sa.namespace,
          },
          roleRef: {
            apiGroup: 'rbac.authorization.k8s.io',
            kind: 'Role',
            name: 'eso-store-reader',
          },
          subjects: [{
            kind: 'ServiceAccount',
            name: sa.name,
            namespace: sa.namespace,
          }],
        });
      }
    });

    // Create eso-store service accounts for namespaces that provide secrets
    const secretProviderNamespaces = ['keycloak', 'gitea', 'argocd'];
    
    secretProviderNamespaces.forEach(namespace => {
      // Skip if already in serviceAccounts
      if (serviceAccounts.some(sa => sa.namespace === namespace && sa.name === 'eso-store')) {
        return;
      }

      // Create service account
      new KubeServiceAccount(this, `sa-${namespace}-eso-store`, {
        metadata: {
          name: 'eso-store',
          namespace: namespace,
          annotations: {
            'azure.workload.identity/client-id': azureClientId,
          },
        },
      });

      // Create Role
      new KubeRole(this, `role-${namespace}-eso-store`, {
        metadata: {
          name: 'eso-store-reader',
          namespace: namespace,
        },
        rules: [{
          apiGroups: [''],
          resources: ['secrets'],
          verbs: ['get', 'list', 'watch'],
        }],
      });

      // Create RoleBinding
      new KubeRoleBinding(this, `rolebinding-${namespace}-eso-store`, {
        metadata: {
          name: 'eso-store-reader',
          namespace: namespace,
        },
        roleRef: {
          apiGroup: 'rbac.authorization.k8s.io',
          kind: 'Role',
          name: 'eso-store-reader',
        },
        subjects: [{
          kind: 'ServiceAccount',
          name: 'eso-store',
          namespace: namespace,
        }],
      });
    });
  }
}