import { ChartProps } from 'cdk8s';

/**
 * Configuration for an IDPBuilder application package
 */
export interface ApplicationConfig {
  /**
   * Application name (used for package directory and ArgoCD app name)
   */
  name: string;
  
  /**
   * Target Kubernetes namespace
   */
  namespace: string;
  
  /**
   * Chart configuration
   */
  chart: {
    /**
     * Chart class name (must be registered with factory)
     */
    type: string;
    
    /**
     * Chart-specific properties
     */
    props?: Record<string, any>;
  };
  
  /**
   * Optional dependencies for this chart
   */
  dependencies?: {
    [key: string]: {
      type: string;
      props?: Record<string, any>;
    };
  };
  
  /**
   * ArgoCD-specific configuration
   */
  argocd?: {
    /**
     * Sync wave annotation
     */
    syncWave?: string;
    
    /**
     * Additional labels for the ArgoCD application
     */
    labels?: Record<string, string>;
    
    /**
     * Sync policy configuration
     */
    syncPolicy?: {
      automated?: {
        prune?: boolean;
        selfHeal?: boolean;
        allowEmpty?: boolean;
      };
      syncOptions?: string[];
      retry?: {
        limit?: number;
        backoff?: {
          duration?: string;
          factor?: number;
          maxDuration?: string;
        };
      };
    };
    
    /**
     * Ignore differences configuration
     */
    ignoreDifferences?: Array<{
      group?: string;
      kind: string;
      name?: string;
      jsonPointers?: string[];
    }>;
    
    /**
     * Multi-source configuration for ArgoCD applications
     * If provided, will use 'sources' instead of 'source' in the Application spec
     */
    sources?: Array<{
      /**
       * Repository URL (Git or Helm)
       */
      repoURL: string;
      
      /**
       * Path within the repository (for Git sources)
       */
      path?: string;
      
      /**
       * Target revision (for Git sources)
       */
      targetRevision?: string;
      
      /**
       * Helm chart name (for Helm sources)
       */
      chart?: string;
      
      /**
       * Helm configuration
       */
      helm?: {
        valueFiles?: string[];
        values?: string;
        parameters?: Array<{
          name: string;
          value: string;
        }>;
      };
      
      /**
       * Reference name for multi-source apps
       */
      ref?: string;
    }>;
  };
}

/**
 * Chart constructor type for factory registration
 */
export type ChartConstructor = new (
  scope: any,
  id: string,
  props?: any
) => any;

/**
 * Enhanced ChartProps with potential dependencies
 */
export interface ChartPropsWithDependencies extends ChartProps {
  [key: string]: any;
}