/**
 * ArgoCD Sync Wave Constants
 * 
 * Sync waves control the order in which ArgoCD applies resources.
 * Lower numbers are applied first. Resources without a sync-wave annotation
 * are considered to be wave 0.
 * 
 * Best Practices:
 * - Leave gaps between waves for future additions
 * - Group related resources in the same wave when possible
 * - Ensure dependencies are in earlier waves than dependents
 */

export const SyncWaves = {
  // Phase 1: Critical Infrastructure (-100 to -50)
  NAMESPACES: -100,
  CRDS: -95,
  CLUSTER_WIDE_RESOURCES: -90,
  
  // Phase 2: Security and Secrets (-50 to -10)
  SECRET_STORES: -50,
  SERVICE_ACCOUNTS: -45,
  RBAC: -40,
  EXTERNAL_SECRETS: -30,
  SECRETS: -20,
  
  // Phase 3: Core Platform Services (-10 to 5)
  OPERATORS: -10,
  PLATFORM_SERVICES: -5,
  MONITORING_CORE: 0,
  
  // Phase 4: Applications (10 to 20)
  DATABASES: 10,
  CACHES: 10,
  APPLICATIONS: 10,
  
  // Phase 5: Dependent Resources (15 to 30)
  HPAS: 15,  // HPAs must come after their target deployments
  PDBS: 15,  // PodDisruptionBudgets after deployments
  SERVICE_MONITORS: 20,  // After services are created
  INGRESSES: 25,
  
  // Phase 5.5: AI Platform (80 to 90)
  AI_MODELS: 84,      // Model configurations
  AI_AGENTS: 85,      // AI agents depend on models
  AI_TOOLSERVERS: 86, // Tool servers depend on agents
  
  // Phase 6: Configuration and Jobs (30 to 50)
  CONFIG_JOBS: 30,
  INIT_JOBS: 35,
  CRONJOBS: 40,
  
  // Phase 7: Validation and Health Checks (50+)
  VALIDATION_JOBS: 50,
  HEALTH_CHECKS: 55,
  
  // Special: End marker to prevent truncation
  END_MARKER: 100,
} as const;

/**
 * Helper function to get sync wave annotation
 */
export function getSyncWaveAnnotation(wave: number): Record<string, string> {
  return {
    'argocd.argoproj.io/sync-wave': wave.toString(),
  };
}

/**
 * Sync options for different resource types
 */
export const SyncOptions = {
  CREATE_NAMESPACE: ['CreateNamespace=true'],
  SERVER_SIDE_APPLY: ['ServerSideApply=true'],
  REPLACE: ['Replace=true'],
  PRUNE_LAST: ['PruneLast=true'],
  RESPECT_IGNORE_DIFFERENCES: ['RespectIgnoreDifferences=true'],
} as const;

/**
 * Common sync option combinations
 */
export const CommonSyncOptions = {
  NAMESPACE_RESOURCES: [SyncOptions.CREATE_NAMESPACE[0]],
  CRD_RESOURCES: [SyncOptions.SERVER_SIDE_APPLY[0], SyncOptions.REPLACE[0]],
  CONFIGMAP_RESOURCES: [SyncOptions.PRUNE_LAST[0]],
} as const;