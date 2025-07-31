import { ApplicationConfig } from '../lib/idpbuilder-types';

/**
 * AI Platform Engineering configuration for Azure Key Vault integration
 * 
 * This configuration uses the V2 chart which supports configurable secret stores.
 * To use this configuration:
 * 
 * 1. Set environment variable: export AI_PLATFORM_SECRET_STORE=azure-keyvault-store
 * 2. Update applications.ts to use this configuration
 * 3. Ensure Azure Key Vault secrets are created as documented
 */
export const aiPlatformAzureConfig: ApplicationConfig = {
  name: 'ai-platform-engineering',
  namespace: 'ai-platform-engineering',
  chart: {
    type: 'AiPlatformEngineeringChartV2',
    props: {
      secretStore: 'azure-keyvault-store',
      useExternalSecrets: true
    }
  },
  argocd: {
    syncWave: '100',
    labels: {
      'app.kubernetes.io/component': 'ai-platform',
      'app.kubernetes.io/part-of': 'platform',
      'app.kubernetes.io/name': 'ai-platform-engineering'
    },
    syncPolicy: {
      automated: {
        prune: true,
        selfHeal: true
      },
      syncOptions: ['CreateNamespace=true', 'ServerSideApply=true']
    }
  }
};

/**
 * Original AI Platform Engineering configuration using Vault
 */
export const aiPlatformVaultConfig: ApplicationConfig = {
  name: 'ai-platform-engineering',
  namespace: 'ai-platform-engineering',
  chart: {
    type: 'AiPlatformEngineeringChart'
  },
  argocd: {
    syncWave: '100',
    labels: {
      'app.kubernetes.io/component': 'ai-platform',
      'app.kubernetes.io/part-of': 'platform',
      'app.kubernetes.io/name': 'ai-platform-engineering'
    },
    syncPolicy: {
      automated: {
        prune: true,
        selfHeal: true
      },
      syncOptions: ['CreateNamespace=true', 'ServerSideApply=true']
    }
  }
};