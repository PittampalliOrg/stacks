import { Construct } from 'constructs';
import { Application, ApplicationSpec } from '../imports/argoproj.io';
import { GitSourceProvider } from './git-source-provider';
import { 
  BaseApplicationConfig, 
  DestinationConfig, 
  SyncPolicyConfig 
} from './environment-config';

/**
 * Properties for BaseArgoApplication
 */
export interface BaseArgoApplicationProps extends BaseApplicationConfig {
  /**
   * Git source provider for the application
   */
  sourceProvider: GitSourceProvider;
  
  /**
   * Path within the source repository
   */
  sourcePath: string;
  
  /**
   * Target revision (branch, tag, or commit SHA)
   * If not specified, the provider's default will be used
   */
  targetRevision?: string;
  
  /**
   * Destination configuration
   */
  destination: DestinationConfig;
  
  /**
   * Sync policy configuration
   */
  syncPolicy?: SyncPolicyConfig;
  
  /**
   * Whether to print setup instructions for authentication
   */
  printSetupInstructions?: boolean;
}

/**
 * Base ArgoCD Application construct that uses GitSourceProvider
 * for environment-specific source configuration
 */
export class BaseArgoApplication extends Construct {
  public readonly application: Application;
  
  constructor(scope: Construct, id: string, props: BaseArgoApplicationProps) {
    super(scope, id);
    
    // Get source configuration from provider
    const source = props.sourceProvider.getSource(
      props.sourcePath,
      props.targetRevision
    );
    
    // Build sync policy
    let syncPolicy: ApplicationSpec['syncPolicy'] = undefined;
    
    if (props.syncPolicy) {
      const policy: any = {};
      
      if (props.syncPolicy.automated) {
        policy.automated = {
          selfHeal: props.syncPolicy.selfHeal !== false,
          prune: props.syncPolicy.prune === true,
        };
      }
      
      const syncOptions: string[] = [];
      if (props.syncPolicy.createNamespace) {
        syncOptions.push('CreateNamespace=true');
      }
      if (props.syncPolicy.syncOptions) {
        syncOptions.push(...props.syncPolicy.syncOptions);
      }
      
      if (syncOptions.length > 0) {
        policy.syncOptions = syncOptions;
      }
      
      if (Object.keys(policy).length > 0) {
        syncPolicy = policy;
      }
    }
    
    // Create the Application
    this.application = new Application(this, 'Application', {
      metadata: {
        name: props.name,
        namespace: props.namespace || 'argocd',
        labels: props.labels,
        annotations: props.annotations,
      },
      spec: {
        project: props.project || 'default',
        source: source,
        destination: {
          server: props.destination.server || 'https://kubernetes.default.svc',
          namespace: props.destination.namespace,
        },
        syncPolicy: syncPolicy,
      },
    });
    
    // Print setup instructions if needed
    if (props.printSetupInstructions !== false) {
      const additionalConfig = props.sourceProvider.getAdditionalConfig?.();
      if (additionalConfig?.setupInstructions) {
        console.log(`\n=== Setup Instructions for ${props.name} ===`);
        additionalConfig.setupInstructions.forEach(instruction => {
          console.log(instruction);
        });
        console.log('=====================================\n');
      }
    }
  }
  
  /**
   * Get the application name
   */
  get applicationName(): string {
    return this.application.metadata.name || '';
  }
  
  /**
   * Get the application namespace
   */
  get applicationNamespace(): string {
    return this.application.metadata.namespace || 'argocd';
  }
}