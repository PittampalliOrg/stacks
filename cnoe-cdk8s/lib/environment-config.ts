/**
 * Environment types supported by the application
 */
export type Environment = 'dev' | 'staging' | 'production';

/**
 * Sync policy configuration for ArgoCD Applications
 */
export interface SyncPolicyConfig {
  /**
   * Enable automated sync
   */
  automated?: boolean;
  
  /**
   * Enable self-heal when automated sync is enabled
   */
  selfHeal?: boolean;
  
  /**
   * Enable pruning of resources
   */
  prune?: boolean;
  
  /**
   * Create namespace if it doesn't exist
   */
  createNamespace?: boolean;
  
  /**
   * Additional sync options
   */
  syncOptions?: string[];
}

/**
 * Destination configuration for ArgoCD Applications
 */
export interface DestinationConfig {
  /**
   * Kubernetes namespace where the application will be deployed
   */
  namespace: string;
  
  /**
   * Kubernetes API server URL
   */
  server?: string;
}

/**
 * Base configuration for ArgoCD Applications
 */
export interface BaseApplicationConfig {
  /**
   * Name of the application
   */
  name: string;
  
  /**
   * Namespace where the Application resource will be created (usually 'argocd')
   */
  namespace?: string;
  
  /**
   * ArgoCD project name
   */
  project?: string;
  
  /**
   * Additional labels to apply to the Application
   */
  labels?: { [key: string]: string };
  
  /**
   * Additional annotations to apply to the Application
   */
  annotations?: { [key: string]: string };
}

/**
 * Environment-specific configuration
 */
export interface EnvironmentConfig {
  /**
   * Environment name
   */
  environment: Environment;
  
  /**
   * Git repository configuration for non-dev environments
   */
  gitConfig?: {
    organization: string;
    repository: string;
    isPrivate?: boolean;
    baseUrl?: string;
  };
  
  /**
   * Default target revision for this environment
   */
  defaultTargetRevision?: string;
  
  /**
   * Default sync policy for this environment
   */
  defaultSyncPolicy?: SyncPolicyConfig;
}

/**
 * Predefined environment configurations
 */
export const ENVIRONMENT_DEFAULTS: Record<Environment, Partial<EnvironmentConfig>> = {
  dev: {
    environment: 'dev',
    defaultTargetRevision: 'HEAD',
    defaultSyncPolicy: {
      automated: true,
      selfHeal: true,
      createNamespace: true,
    },
  },
  staging: {
    environment: 'staging',
    defaultTargetRevision: 'main',
    defaultSyncPolicy: {
      automated: true,
      selfHeal: true,
      createNamespace: true,
    },
  },
  production: {
    environment: 'production',
    defaultTargetRevision: 'main',
    defaultSyncPolicy: {
      automated: false, // Manual sync for production
      createNamespace: false, // Namespaces should already exist in prod
    },
  },
};

/**
 * Helper function to merge environment defaults with custom config
 */
export function getEnvironmentConfig(
  environment: Environment,
  customConfig?: Partial<EnvironmentConfig>
): EnvironmentConfig {
  return {
    ...ENVIRONMENT_DEFAULTS[environment],
    ...customConfig,
    environment,
    defaultSyncPolicy: {
      ...ENVIRONMENT_DEFAULTS[environment].defaultSyncPolicy,
      ...customConfig?.defaultSyncPolicy,
    },
  } as EnvironmentConfig;
}