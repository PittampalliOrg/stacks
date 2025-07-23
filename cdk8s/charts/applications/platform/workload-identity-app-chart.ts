import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates ArgoCD Applications for Azure Workload Identity components
 * This application manages all workload identity resources including:
 * - Workload Identity Webhook (for pod identity injection)
 * - Service Accounts (with Azure AD annotations)
 * - Azure Key Vault SecretStore (for secret management)
 * - Bootstrap Secrets (GitHub App credentials)
 */
export class WorkloadIdentityAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    console.log('📦 Creating WorkloadIdentityAppChart...');
    
    const clusterType = process.env.CLUSTER_TYPE || 'kind';
    const azureTenantId = process.env.AZURE_TENANT_ID;
    
    if (!azureTenantId) {
      throw new Error('Azure Tenant ID is required. Set AZURE_TENANT_ID environment variable.');
    }
    
    // Workload Identity Webhook - Must be deployed first (KIND clusters only)
    // AKS clusters have workload identity pre-installed
    if (clusterType.toLowerCase() === 'kind') {
      this.createHelmApplication('workload-identity-webhook', {
        resourcePath: 'workload-identity-webhook', // Not used for Helm but required
        namespace: 'azure-workload-identity-system',
        project: 'default',
        syncWave: '-90', // Very early, before any workload identity resources
        
        // Helm-specific configuration
        chart: 'workload-identity-webhook',
        helmRepoURL: 'https://azure.github.io/azure-workload-identity/charts',
        helmVersion: '1.3.0', // Latest stable version
        helmValues: {
          azureTenantID: azureTenantId,
        },
        
        labels: {
          'app.kubernetes.io/component': 'identity-management',
          'app.kubernetes.io/part-of': 'platform-security'
        },
        syncPolicy: {
          automated: {
            prune: true,
            selfHeal: true,
            allowEmpty: false
          },
          syncOptions: [
            'CreateNamespace=true',
            'ServerSideApply=true',
            'Replace=true' // Force replace for webhook configurations
          ],
          retry: {
            limit: 5,
            backoff: {
              duration: '10s',
              factor: 2,
              maxDuration: '3m'
            }
          }
        }
      });
    }
    
    // Workload Identity Service Accounts
    this.createApplication('workload-identity-serviceaccounts', {
      resourcePath: 'workload-identity-serviceaccounts',
      namespace: 'default', // Service accounts are created in multiple namespaces
      project: 'default',
      syncWave: '-85', // After webhook is ready
      labels: {
        'app.kubernetes.io/component': 'service-accounts',
        'app.kubernetes.io/part-of': 'platform-security'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true,
          allowEmpty: false
        },
        syncOptions: [
          'CreateNamespace=true',
          'ServerSideApply=true'
        ],
        retry: {
          limit: 5,
          backoff: {
            duration: '10s',
            factor: 2,
            maxDuration: '3m'
          }
        }
      }
    });
    
    // Azure Key Vault SecretStore
    this.createApplication('azure-keyvault-secretstore', {
      resourcePath: 'azure-keyvault-secretstore',
      namespace: 'external-secrets',
      project: 'default',
      syncWave: '-80', // After service accounts are ready
      labels: {
        'app.kubernetes.io/component': 'secret-management',
        'app.kubernetes.io/part-of': 'platform-security'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true,
          allowEmpty: false
        },
        syncOptions: [
          'CreateNamespace=true',
          'ServerSideApply=true'
        ],
        retry: {
          limit: 5,
          backoff: {
            duration: '10s',
            factor: 2,
            maxDuration: '3m'
          }
        }
      },
      // Ignore status fields that are updated by the controller
      ignoreDifferences: [{
        group: 'external-secrets.io',
        kind: 'ClusterSecretStore',
        jsonPointers: [
          '/status'
        ]
      }]
    });
    
    // Workload Identity Bootstrap Secrets
    this.createApplication('workload-identity-bootstrap', {
      resourcePath: 'workload-identity-bootstrap',
      namespace: 'argocd',
      project: 'default',
      syncWave: '-75', // After SecretStore is ready
      labels: {
        'app.kubernetes.io/component': 'bootstrap-secrets',
        'app.kubernetes.io/part-of': 'platform-security'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true,
          allowEmpty: false
        },
        syncOptions: [
          'CreateNamespace=true',
          'ServerSideApply=true',
          'RespectIgnoreDifferences=true'
        ],
        retry: {
          limit: 5,
          backoff: {
            duration: '10s',
            factor: 2,
            maxDuration: '3m'
          }
        }
      },
      // Ignore ExternalSecret status fields
      ignoreDifferences: [{
        group: 'external-secrets.io',
        kind: 'ExternalSecret',
        jsonPointers: [
          '/status',
          '/metadata/resourceVersion',
          '/metadata/generation'
        ]
      }]
    });
    
    console.log('✅ WorkloadIdentityAppChart created successfully');
  }
}
