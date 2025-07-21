import { Chart, ChartProps, JsonPatch } from 'cdk8s';
import { Construct } from 'constructs';
import * as argo from '@opencdk8s/cdk8s-argocd-resources';

export interface ApplicationProps {
  /**
   * The path to the resources directory (relative to dist/resources)
   */
  resourcePath: string;
  
  /**
   * The namespace where resources will be deployed
   */
  namespace: string;
  
  /**
   * The ArgoCD project (defaults to 'default')
   */
  project?: string;
  
  /**
   * ArgoCD sync wave annotation
   */
  syncWave?: string;
  
  /**
   * Override the default sync policy
   */
  syncPolicy?: argo.ApplicationSyncPolicy;
  
  /**
   * Additional sync options
   */
  syncOptions?: string[];
  
  /**
   * Git repository URL (defaults to the CDK8s project repo)
   */
  repoURL?: string;
  
  /**
   * Git target revision (defaults to 'app')
   */
  targetRevision?: string;
  
  /**
   * Ignore differences configuration
   */
  ignoreDifferences?: argo.ResourceIgnoreDifferences[];
  
  /**
   * Additional labels for the Application
   */
  labels?: { [key: string]: string };
  
  /**
   * Additional annotations for the Application
   */
  annotations?: { [key: string]: string };
}

/**
 * Base class for creating ArgoCD Application resources
 * This follows the App of Apps pattern where Applications manage their own resources
 */
export abstract class ArgoCdApplicationChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);
  }
  
  /**
   * Creates an ArgoCD Application resource
   */
  protected createApplication(name: string, props: ApplicationProps): argo.ArgoCdApplication {
    // Build annotations including sync wave if provided
    const annotations: { [key: string]: string } = {
      ...props.annotations
    };
    
    if (props.syncWave) {
      annotations['argocd.argoproj.io/sync-wave'] = props.syncWave;
    }
    
    // Default sync options
    const defaultSyncOptions = [
      'CreateNamespace=true',
      'ServerSideApply=true',
      'ApplyOutOfSyncOnly=false'
    ];
    
    // Merge provided sync options with defaults
    const syncOptions = props.syncOptions 
      ? [...new Set([...defaultSyncOptions, ...props.syncOptions])]
      : defaultSyncOptions;
    
    // Default sync policy
    const defaultSyncPolicy: argo.ApplicationSyncPolicy = {
      automated: {
        prune: true,
        selfHeal: true,
        allowEmpty: false
      },
      syncOptions,
      retry: {
        limit: 5,
        backoff: {
          duration: '10s',
          factor: 2,
          maxDuration: '3m'
        }
      }
    };
    
    // Use provided sync policy or default, ensuring syncOptions are included
    let syncPolicy = props.syncPolicy || defaultSyncPolicy;
    
    // Ensure syncOptions are included
    if (!syncPolicy.syncOptions) {
      syncPolicy = {
        ...syncPolicy,
        syncOptions
      };
    }
    
    const app = new argo.ArgoCdApplication(this, name, {
      metadata: {
        name,
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'app.kubernetes.io/part-of': 'platform',
          ...props.labels
        },
        annotations,
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: props.project || 'default',
        source: {
          repoURL: props.repoURL || 'https://github.com/PittampalliOrg/cdk8s-project.git',
          targetRevision: props.targetRevision || process.env.ENVIRONMENT || 'dev',
          path: 'dist'
        },
        destination: {
          server: 'https://kubernetes.default.svc',
          namespace: props.namespace
        },
        syncPolicy,
        ignoreDifferences: props.ignoreDifferences
      }
    });
    
    // Add include filter for specific chart file (with wildcard for numbered prefix)
    // Use exact pattern to avoid matching similar chart names (e.g., nextjs vs flagd-ui-nextjs)
    app.addJsonPatch(
      JsonPatch.add('/spec/source/directory', {
        include: `[0-9][0-9][0-9][0-9]-${props.resourcePath}.k8s.yaml`,
        jsonnet: {} // ArgoCD adds this automatically, include it to prevent OutOfSync
      })
    );
    
    return app;
  }
  
  /**
   * Creates an Application that points to a Helm chart
   * Note: For complex Helm values, consider using a values file in the repo
   */
  protected createHelmApplication(name: string, props: ApplicationProps & {
    chart: string;
    helmRepoURL: string;
    helmVersion: string;
    helmValues?: { [key: string]: any };  // Will be stringified for ArgoCD
    helmReleaseName?: string;
  }): argo.ArgoCdApplication {
    // Build annotations including sync wave if provided
    const annotations: { [key: string]: string } = {
      ...props.annotations
    };
    
    if (props.syncWave) {
      annotations['argocd.argoproj.io/sync-wave'] = props.syncWave;
    }
    
    // Default sync options for Helm
    const defaultSyncOptions = [
      'CreateNamespace=true',
      'ServerSideApply=true'
    ];
    
    const syncOptions = props.syncOptions 
      ? [...new Set([...defaultSyncOptions, ...props.syncOptions])]
      : defaultSyncOptions;
    
    let syncPolicy = props.syncPolicy || {
      automated: {
        prune: true,
        selfHeal: true,
        allowEmpty: false
      },
      syncOptions,
      retry: {
        limit: 5,
        backoff: {
          duration: '10s',
          factor: 2,
          maxDuration: '3m'
        }
      }
    };
    
    return new argo.ArgoCdApplication(this, name, {
      metadata: {
        name,
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'app.kubernetes.io/part-of': 'platform',
          ...props.labels
        },
        annotations,
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: props.project || 'default',
        source: {
          repoURL: props.helmRepoURL,
          targetRevision: props.helmVersion,
          chart: props.chart,
          helm: {
            releaseName: props.helmReleaseName || name,
            ...(props.helmValues && { values: JSON.stringify(props.helmValues, null, 2) })
          } as any
        },
        destination: {
          server: 'https://kubernetes.default.svc',
          namespace: props.namespace
        },
        syncPolicy,
        ignoreDifferences: props.ignoreDifferences
      }
    });
  }
}