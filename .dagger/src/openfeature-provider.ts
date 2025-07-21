/**
 * OpenFeature Provider for Dagger
 * 
 * This module provides integration with OpenFeature for retrieving
 * configuration values from Kubernetes ConfigMaps managed by OpenFeature.
 */

interface ConfigValues {
  environment: string;
  azureClientId: string;
  azureTenantId: string;
  azureKeyvaultName: string;
  githubAppId: string;
  githubInstallationId: string;
  logLevel: string;
  nextjsBaseUrl: string;
  nodeEnv: string;
  otelEndpoint: string;
  clusterType: string;
  ingressHost: string;
  enableTls: string;
  tlsIssuer: string;
}

/**
 * Get configuration from OpenFeature ConfigMap
 * 
 * Since we're running in Dagger (not in a Kubernetes pod), we'll read from
 * the ConfigMap that OpenFeature creates for legacy applications.
 * 
 * @param namespace The Kubernetes namespace containing the ConfigMap
 * @returns Configuration values
 */
export async function getConfigFromFeatureFlags(namespace: string = 'default'): Promise<ConfigValues> {
  // In a real Kubernetes environment, we would use:
  // - @openfeature/server-sdk with @openfeature/kubernetes-provider
  // - Or read from the ConfigMap using Kubernetes API
  
  // For Dagger, we'll provide a mechanism to read from environment variables
  // that can be populated from the ConfigMap or directly set
  
  return {
    environment: process.env.ENVIRONMENT || 'dev',
    azureClientId: process.env.AZURE_CLIENT_ID || '',
    azureTenantId: process.env.AZURE_TENANT_ID || '',
    azureKeyvaultName: process.env.AZURE_KEYVAULT_NAME || '',
    githubAppId: process.env.GH_APP_ID || process.env.GITHUB_APP_ID || '',
    githubInstallationId: process.env.GH_INSTALLATION_ID || process.env.GITHUB_INSTALLATION_ID || '',
    logLevel: process.env.LOG_LEVEL || 'info',
    nextjsBaseUrl: process.env.NEXTJS_BASE_URL || '',
    nodeEnv: process.env.NODE_ENV || 'development',
    otelEndpoint: process.env.OTEL_ENDPOINT || '',
    clusterType: process.env.CLUSTER_TYPE || 'kind',
    ingressHost: process.env.INGRESS_HOST || 'chat.localtest.me',
    enableTls: process.env.ENABLE_TLS || 'false',
    tlsIssuer: process.env.TLS_ISSUER || ''
  };
}

/**
 * Alternative: Get configuration from Kubernetes ConfigMap via kubectl
 * This would be used if running Dagger in a Kubernetes environment
 */
export async function getConfigFromConfigMap(
  configMapName: string = 'openfeature-env-config',
  namespace: string = 'default'
): Promise<ConfigValues> {
  // This is a placeholder for actual implementation that would:
  // 1. Use kubectl or Kubernetes API to read the ConfigMap
  // 2. Parse the data and return as ConfigValues
  
  // For now, fallback to environment variables
  return getConfigFromFeatureFlags(namespace);
}