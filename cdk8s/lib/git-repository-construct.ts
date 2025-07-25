import { Construct } from 'constructs';
import { GitRepository, GitRepositorySpec, GitRepositorySpecProviderName, GitRepositorySpecSourceType } from '../imports/cnoe.io_gitrepositories-idpbuilder.cnoe.io';
import { ApiObjectMetadata } from 'cdk8s';

export interface GitRepositoryConstructProps {
  /**
   * Name of the GitRepository resource
   */
  name: string;

  /**
   * Namespace where the GitRepository resource will be created
   */
  namespace?: string;

  /**
   * Git provider configuration
   */
  provider: {
    /**
     * Provider type (gitea or github)
     */
    type: 'gitea' | 'github';

    /**
     * External Git server URL
     */
    gitUrl: string;

    /**
     * Internal Git server URL (for cluster access)
     */
    internalGitUrl?: string;

    /**
     * Organization or owner name
     */
    organizationName: string;
  };

  /**
   * Repository details
   */
  repository: {
    /**
     * Repository URL (full URL including .git)
     */
    url: string;

    /**
     * Git reference (branch, tag, or commit)
     */
    ref?: string;

    /**
     * Path within the repository
     */
    path?: string;

    /**
     * Clone submodules
     */
    cloneSubmodules?: boolean;
  };

  /**
   * Authentication configuration
   */
  authentication?: {
    /**
     * Secret containing credentials
     */
    secretName: string;

    /**
     * Namespace of the secret
     */
    secretNamespace?: string;
  };

  /**
   * Custom package configuration for idpbuilder
   */
  customization?: {
    /**
     * Package name to customize
     */
    packageName: string;

    /**
     * Path to customization file
     */
    filePath?: string;
  };

  /**
   * Additional labels
   */
  labels?: { [key: string]: string };

  /**
   * Additional annotations
   */
  annotations?: { [key: string]: string };
}

export class GitRepositoryConstruct extends Construct {
  public readonly gitRepository: GitRepository;

  constructor(scope: Construct, id: string, props: GitRepositoryConstructProps) {
    super(scope, id);

    // Build metadata
    const metadata: ApiObjectMetadata = {
      name: props.name,
      namespace: props.namespace,
      labels: {
        'app.kubernetes.io/managed-by': 'cdk8s',
        'idpbuilder.cnoe.io/provider': props.provider.type,
        ...props.labels,
      },
      annotations: props.annotations,
    };

    // Build spec
    const spec: GitRepositorySpec = {
      provider: {
        name: this.mapProviderType(props.provider.type),
        gitUrl: props.provider.gitUrl,
        internalGitUrl: props.provider.internalGitUrl || props.provider.gitUrl,
        organizationName: props.provider.organizationName,
      },
      source: {
        type: GitRepositorySpecSourceType.REMOTE,
        remoteRepository: {
          url: props.repository.url,
          ref: props.repository.ref || 'main',
          path: props.repository.path || '.',
          cloneSubmodules: props.repository.cloneSubmodules || false,
        },
      },
    };

    // Add authentication if provided
    if (props.authentication) {
      (spec as any).secretRef = {
        name: props.authentication.secretName,
        namespace: props.authentication.secretNamespace || props.namespace || 'default',
      };
    }

    // Add customization if provided
    if (props.customization) {
      (spec as any).customization = {
        name: props.customization.packageName,
        filePath: props.customization.filePath,
      };
    }

    // Create the GitRepository resource
    this.gitRepository = new GitRepository(this, 'GitRepository', {
      metadata,
      spec,
    });
  }

  private mapProviderType(type: 'gitea' | 'github'): GitRepositorySpecProviderName {
    switch (type) {
      case 'gitea':
        return GitRepositorySpecProviderName.GITEA;
      case 'github':
        return GitRepositorySpecProviderName.GITHUB;
      default:
        throw new Error(`Unsupported provider type: ${type}`);
    }
  }
}

/**
 * Helper class for creating GitRepository resources with common patterns
 */
export class GitRepositoryHelper {
  /**
   * Create a GitRepository for local Gitea
   */
  static createLocalGiteaRepository(
    scope: Construct,
    id: string,
    options: {
      name: string;
      namespace?: string;
      organizationName?: string;
      repositoryName: string;
      ref?: string;
      path?: string;
      isPrivate?: boolean;
      credentialsSecret?: string;
    },
  ): GitRepositoryConstruct {
    const org = options.organizationName || 'gitea';
    const giteaUrl = 'http://gitea.gitea.svc.cluster.local:3000';

    return new GitRepositoryConstruct(scope, id, {
      name: options.name,
      namespace: options.namespace,
      provider: {
        type: 'gitea',
        gitUrl: giteaUrl,
        internalGitUrl: giteaUrl,
        organizationName: org,
      },
      repository: {
        url: `${giteaUrl}/${org}/${options.repositoryName}.git`,
        ref: options.ref,
        path: options.path,
      },
      ...(options.isPrivate && options.credentialsSecret
        ? {
            authentication: {
              secretName: options.credentialsSecret,
              secretNamespace: options.namespace,
            },
          }
        : {}),
    });
  }

  /**
   * Create a GitRepository for GitHub
   */
  static createGitHubRepository(
    scope: Construct,
    id: string,
    options: {
      name: string;
      namespace?: string;
      organizationName: string;
      repositoryName: string;
      ref?: string;
      path?: string;
      isPrivate?: boolean;
      credentialsSecret?: string;
    },
  ): GitRepositoryConstruct {
    return new GitRepositoryConstruct(scope, id, {
      name: options.name,
      namespace: options.namespace,
      provider: {
        type: 'github',
        gitUrl: 'https://github.com',
        organizationName: options.organizationName,
      },
      repository: {
        url: `https://github.com/${options.organizationName}/${options.repositoryName}.git`,
        ref: options.ref,
        path: options.path,
      },
      ...(options.isPrivate && options.credentialsSecret
        ? {
            authentication: {
              secretName: options.credentialsSecret,
              secretNamespace: options.namespace,
            },
          }
        : {}),
    });
  }
}