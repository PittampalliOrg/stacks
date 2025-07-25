import { Construct } from 'constructs';
import { Application, ApplicationSpec } from '../imports/argoproj.io';
import { GitRepository, GitRepositorySpecProviderName, GitRepositorySpecSourceType } from '../imports/cnoe.io_gitrepositories-idpbuilder.cnoe.io';

export type Environment = 'local' | 'production';
export type GitProvider = 'gitea' | 'github';

export interface ApplicationConstructProps {
  /**
   * Name of the application
   */
  name: string;

  /**
   * Namespace where the Application resource will be created (usually 'argocd')
   */
  namespace?: string;

  /**
   * Environment to deploy to
   */
  environment: Environment;

  /**
   * Git provider being used
   */
  gitProvider?: GitProvider;

  /**
   * For local environment with cnoe://: relative path from the application file to the manifests directory
   * For Git repositories: path within the git repository
   */
  path: string;

  /**
   * Repository configuration
   */
  repository: {
    /**
     * For local with cnoe://: not used
     * For local with Gitea: repository name (e.g., "myapp")
     * For production: full GitHub URL (e.g., "https://github.com/myorg/myrepo.git")
     */
    url?: string;

    /**
     * Organization or owner name
     * For Gitea: organization name in Gitea
     * For GitHub: organization or user name
     */
    organization?: string;

    /**
     * Repository name (without .git extension)
     * Used for generating URLs in local environments
     */
    name?: string;

    /**
     * Whether the repository is private (requires authentication)
     */
    isPrivate?: boolean;

    /**
     * Secret name containing repository credentials
     * Expected to have 'username' and 'password' keys
     */
    credentialsSecret?: string;
  };

  /**
   * Use cnoe:// prefix for local file references
   * Only applicable in local environment
   */
  useCnoePrefix?: boolean;

  /**
   * Target revision (branch, tag, or commit SHA)
   */
  targetRevision?: string;

  /**
   * ArgoCD project name
   */
  project?: string;

  /**
   * Destination namespace for the application
   */
  destinationNamespace: string;

  /**
   * Destination server
   */
  destinationServer?: string;

  /**
   * Additional labels to apply to the Application
   */
  labels?: { [key: string]: string };

  /**
   * Enable automated sync
   */
  automatedSync?: boolean;

  /**
   * Enable self-heal when automated sync is enabled
   */
  selfHeal?: boolean;

  /**
   * Enable auto-prune to remove resources not defined in Git
   */
  prune?: boolean;

  /**
   * Create namespace if it doesn't exist
   */
  createNamespace?: boolean;

  /**
   * Sync options
   */
  syncOptions?: string[];

  /**
   * Helm specific options
   */
  helm?: {
    releaseName?: string;
    valueFiles?: string[];
    values?: string;
  };

  /**
   * Kustomize specific options
   */
  kustomize?: {
    images?: string[];
  };
}

export class ApplicationConstruct extends Construct {
  public readonly application: Application;
  public readonly gitRepository?: GitRepository;

  constructor(scope: Construct, id: string, props: ApplicationConstructProps) {
    super(scope, id);

    // Determine repository URL based on environment and provider
    const repoUrl = this.buildRepoUrl(props);

    // Create GitRepository resource if in local environment with Gitea
    if (props.environment === 'local' && props.gitProvider === 'gitea' && !props.useCnoePrefix) {
      this.gitRepository = this.createGitRepository(props);
    }

    // Build sync policy
    const syncPolicy = this.buildSyncPolicy(props);

    // Build source configuration
    const source: ApplicationSpec['source'] = {
      repoUrl: repoUrl,
      path: props.useCnoePrefix ? '.' : props.path,  // Use '.' for cnoe:// URLs
      targetRevision: props.targetRevision || 'HEAD',
    };

    // Add Helm configuration if provided
    if (props.helm) {
      (source as any).helm = {
        releaseName: props.helm.releaseName,
        valueFiles: props.helm.valueFiles,
        values: props.helm.values,
      };
    }

    // Add Kustomize configuration if provided
    if (props.kustomize) {
      (source as any).kustomize = {
        images: props.kustomize.images,
      };
    }

    // Build the application spec
    const spec: ApplicationSpec = {
      project: props.project || 'default',
      source: source,
      destination: {
        server: props.destinationServer || 'https://kubernetes.default.svc',
        namespace: props.destinationNamespace,
      },
      syncPolicy: syncPolicy,
    };

    // Create the Application resource
    this.application = new Application(this, 'Application', {
      metadata: {
        name: props.name,
        namespace: props.namespace || 'argocd',
        labels: {
          ...props.labels,
          'app.kubernetes.io/managed-by': 'cdk8s',
          'argocd.environment': props.environment,
        },
      },
      spec: spec,
    });
  }

  private buildRepoUrl(props: ApplicationConstructProps): string {
    // Handle cnoe:// prefix for local file references
    if (props.environment === 'local' && props.useCnoePrefix) {
      return `cnoe://${props.path}`;
    }

    // Handle local Gitea repositories
    if (props.environment === 'local' && props.gitProvider === 'gitea') {
      const org = props.repository.organization || 'gitea';
      const repoName = props.repository.name || props.name;
      // Use internal Gitea service URL
      return `http://gitea.gitea.svc.cluster.local:3000/${org}/${repoName}.git`;
    }

    // Handle production GitHub repositories
    if (props.environment === 'production') {
      if (!props.repository.url) {
        // Build GitHub URL from components
        const org = props.repository.organization;
        const repoName = props.repository.name;
        if (!org || !repoName) {
          throw new Error('For production environment, either repository.url or both repository.organization and repository.name must be provided');
        }
        return `https://github.com/${org}/${repoName}.git`;
      }
      return props.repository.url;
    }

    throw new Error(`Unsupported environment: ${props.environment}`);
  }

  private buildSyncPolicy(props: ApplicationConstructProps): ApplicationSpec['syncPolicy'] {
    const syncOptions: string[] = props.syncOptions || [];
    
    if (props.createNamespace) {
      syncOptions.push('CreateNamespace=true');
    }

    const syncPolicy: ApplicationSpec['syncPolicy'] = {
      syncOptions: syncOptions.length > 0 ? syncOptions : undefined,
    };

    if (props.automatedSync) {
      (syncPolicy as any).automated = {
        prune: props.prune || false,
        selfHeal: props.selfHeal !== false, // Default to true
      };
    }

    // Return undefined if syncPolicy is empty
    if (!syncPolicy.automated && (!syncPolicy.syncOptions || syncPolicy.syncOptions.length === 0)) {
      return undefined;
    }

    return syncPolicy;
  }

  private createGitRepository(props: ApplicationConstructProps): GitRepository {
    const org = props.repository.organization || 'gitea';
    const repoName = props.repository.name || props.name;

    return new GitRepository(this, 'GitRepository', {
      metadata: {
        name: `${props.name}-repo`,
        namespace: props.namespace || 'argocd',
      },
      spec: {
        provider: {
          name: GitRepositorySpecProviderName.GITEA,
          gitUrl: 'http://gitea.gitea.svc.cluster.local:3000',
          internalGitUrl: 'http://gitea.gitea.svc.cluster.local:3000',
          organizationName: org,
        },
        source: {
          type: GitRepositorySpecSourceType.REMOTE,
          remoteRepository: {
            url: `http://gitea.gitea.svc.cluster.local:3000/${org}/${repoName}.git`,
            ref: props.targetRevision || 'main',
            path: props.path || '.',
            cloneSubmodules: false,
          },
        },
        // Add secret reference if repository is private
        ...(props.repository.isPrivate && props.repository.credentialsSecret
          ? {
              secretRef: {
                name: props.repository.credentialsSecret,
                namespace: props.namespace || 'argocd',
              },
            }
          : {}),
      },
    });
  }
}