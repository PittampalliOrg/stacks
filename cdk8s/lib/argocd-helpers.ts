import { ApiObject } from 'cdk8s';
import { SyncWaves, getSyncWaveAnnotation } from './sync-waves';

/**
 * ArgoCD Helper Functions
 * 
 * Utilities for managing ArgoCD-specific annotations and configurations
 * in CDK8s applications.
 */

/**
 * Adds ArgoCD sync-wave annotation to a resource
 * Note: This modifies the resource's metadata in place during construction
 */
export function addSyncWave(resource: ApiObject, wave: number): void {
  const metadata = (resource as any).props.metadata;
  metadata.annotations = metadata.annotations || {};
  Object.assign(metadata.annotations, getSyncWaveAnnotation(wave));
}

/**
 * Adds ArgoCD hook annotation to a resource
 */
export function addSyncHook(resource: ApiObject, hook: 'PreSync' | 'Sync' | 'PostSync' | 'SyncFail'): void {
  const metadata = (resource as any).props.metadata;
  metadata.annotations = metadata.annotations || {};
  metadata.annotations['argocd.argoproj.io/hook'] = hook;
}

/**
 * Adds ArgoCD hook deletion policy
 */
export function addHookDeletePolicy(resource: ApiObject, policy: 'HookSucceeded' | 'HookFailed' | 'BeforeHookCreation'): void {
  const metadata = (resource as any).props.metadata;
  metadata.annotations = metadata.annotations || {};
  metadata.annotations['argocd.argoproj.io/hook-delete-policy'] = policy;
}

/**
 * Configure sync options on an ArgoCD Application resource
 */
export function addSyncOptions(resource: ApiObject, options: string[]): void {
  if (resource.kind !== 'Application' || resource.apiVersion !== 'argoproj.io/v1alpha1') {
    throw new Error('Sync options can only be added to ArgoCD Application resources');
  }
  
  const props = (resource as any).props;
  props.spec = props.spec || {};
  props.spec.syncPolicy = props.spec.syncPolicy || {};
  props.spec.syncPolicy.syncOptions = options;
}

/**
 * Makes a resource creation conditional on CRD availability
 * This prevents sync failures when optional CRDs are not installed
 */
export function makeConditionalOnCRD(resource: ApiObject, crdGroup: string, crdKind: string): void {
  const metadata = (resource as any).props.metadata;
  metadata.annotations = metadata.annotations || {};
  metadata.annotations['argocd.argoproj.io/sync-options'] = 'SkipDryRunOnMissingResource=true';
}

/**
 * Helper to create a proper Azure Workload Identity annotation set
 */
export function addAzureWorkloadIdentityAnnotations(
  resource: ApiObject,
  clientId: string,
  tenantId: string
): void {
  if (resource.kind !== 'ServiceAccount') {
    throw new Error('Azure Workload Identity annotations can only be added to ServiceAccount resources');
  }
  
  const metadata = (resource as any).props.metadata;
  metadata.annotations = metadata.annotations || {};
  metadata.annotations['azure.workload.identity/client-id'] = clientId;
  metadata.annotations['azure.workload.identity/tenant-id'] = tenantId;
  metadata.annotations['azure.workload.identity/use'] = 'true';
}

/**
 * Adds common ArgoCD labels to a resource
 */
export function addArgoCDLabels(resource: ApiObject, appName: string, component?: string): void {
  const metadata = (resource as any).props.metadata;
  metadata.labels = metadata.labels || {};
  metadata.labels['app.kubernetes.io/instance'] = appName;
  metadata.labels['app.kubernetes.io/managed-by'] = 'argocd';
  if (component) {
    metadata.labels['app.kubernetes.io/component'] = component;
  }
}

/**
 * Helper to ensure HPA resources are created after their target deployments
 */
export function configureHPAForDeployment(hpa: ApiObject, targetDeploymentWave: number = SyncWaves.APPLICATIONS): void {
  if (hpa.kind !== 'HorizontalPodAutoscaler') {
    throw new Error('This helper can only be used with HorizontalPodAutoscaler resources');
  }
  
  // HPAs should always be created after their target deployments
  addSyncWave(hpa, targetDeploymentWave + 5);
}

/**
 * Helper to configure resources that depend on CRDs
 */
export function configureCRDDependentResource(resource: ApiObject, options: {
  crdGroup: string;
  crdKind: string;
  syncWave?: number;
  makeOptional?: boolean;
}): void {
  // Set appropriate sync wave
  if (options.syncWave !== undefined) {
    addSyncWave(resource, options.syncWave);
  } else {
    // Default to after operators are installed
    addSyncWave(resource, SyncWaves.PLATFORM_SERVICES);
  }
  
  // Make it optional if specified
  if (options.makeOptional) {
    makeConditionalOnCRD(resource, options.crdGroup, options.crdKind);
  }
}

/**
 * Validation helper to check for common sync issues
 */
export interface SyncValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateSyncConfiguration(resources: ApiObject[]): SyncValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check for duplicate resources
  const resourceKeys = new Set<string>();
  resources.forEach(resource => {
    const metadata = (resource as any).props?.metadata || {};
    const key = `${resource.apiVersion}/${resource.kind}/${metadata.namespace || 'cluster'}/${metadata.name}`;
    if (resourceKeys.has(key)) {
      errors.push(`Duplicate resource found: ${key}`);
    }
    resourceKeys.add(key);
  });
  
  // Check HPA sync waves
  resources.forEach(resource => {
    if (resource.kind === 'HorizontalPodAutoscaler') {
      const metadata = (resource as any).props?.metadata || {};
      const syncWave = parseInt(metadata.annotations?.['argocd.argoproj.io/sync-wave'] || '0');
      if (syncWave <= SyncWaves.APPLICATIONS) {
        warnings.push(`HPA ${metadata.name} may be created before its target deployment (sync-wave: ${syncWave})`);
      }
    }
  });
  
  // Check for ServiceMonitors without CRD handling
  resources.forEach(resource => {
    if (resource.kind === 'ServiceMonitor' && resource.apiVersion?.includes('monitoring.coreos.com')) {
      const metadata = (resource as any).props?.metadata || {};
      const hasSkipOption = metadata.annotations?.['argocd.argoproj.io/sync-options']?.includes('SkipDryRunOnMissingResource');
      if (!hasSkipOption) {
        warnings.push(`ServiceMonitor ${metadata.name} may fail if Prometheus CRDs are not installed`);
      }
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}