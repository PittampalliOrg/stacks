import { Construct } from 'constructs';
import { KubeSecret } from '../imports/k8s';
import { ApplicationConstruct, ApplicationConstructProps, Environment } from './application-construct';
import { GitRepositoryConstruct, GitRepositoryHelper } from './git-repository-construct';

export interface RepositoryCredentials {
  username: string;
  password: string;
}

export interface ArgoCDEnvironmentConfig {
  /**
   * Environment type
   */
  environment: Environment;

  /**
   * Default namespace for ArgoCD resources
   */
  argoCDNamespace?: string;

  /**
   * Default destination server
   */
  destinationServer?: string;

  /**
   * Default sync options
   */
  defaultSyncOptions?: string[];

  /**
   * Git provider configuration
   */
  gitProvider?: {
    /**
     * For local: 'gitea', for production: 'github'
     */
    type: 'gitea' | 'github';

    /**
     * Base URL for the Git provider
     */
    baseUrl?: string;

    /**
     * Default organization
     */
    defaultOrganization?: string;
  };
}

export class ArgoCDEnvironmentFactory {
  private config: ArgoCDEnvironmentConfig;

  constructor(config: ArgoCDEnvironmentConfig) {
    this.config = {
      ...config,
      argoCDNamespace: config.argoCDNamespace || 'argocd',
      destinationServer: config.destinationServer || 'https://kubernetes.default.svc',
    };

    // Set defaults based on environment
    if (config.environment === 'local' && !config.gitProvider) {
      this.config.gitProvider = {
        type: 'gitea',
        baseUrl: 'http://gitea.gitea.svc.cluster.local:3000',
        defaultOrganization: 'gitea',
      };
    } else if (config.environment === 'production' && !config.gitProvider) {
      this.config.gitProvider = {
        type: 'github',
        baseUrl: 'https://github.com',
      };
    }
  }

  /**
   * Create an ArgoCD Application with appropriate configuration for the environment
   */
  createApplication(
    scope: Construct,
    id: string,
    props: Partial<ApplicationConstructProps> & {
      name: string;
      path: string;
      destinationNamespace: string;
      repository: {
        name?: string;
        organization?: string;
        url?: string;
        isPrivate?: boolean;
      };
    },
  ): ApplicationConstruct {
    const fullProps: ApplicationConstructProps = {
      ...props,
      environment: this.config.environment,
      namespace: props.namespace || this.config.argoCDNamespace,
      destinationServer: props.destinationServer || this.config.destinationServer,
      gitProvider: this.config.gitProvider?.type,
      repository: {
        ...props.repository,
        organization: props.repository.organization || this.config.gitProvider?.defaultOrganization,
      },
      syncOptions: [...(this.config.defaultSyncOptions || []), ...(props.syncOptions || [])],
    };

    return new ApplicationConstruct(scope, id, fullProps);
  }

  /**
   * Create a Git repository secret for authentication
   */
  createRepositorySecret(
    scope: Construct,
    id: string,
    options: {
      name: string;
      namespace?: string;
      credentials: RepositoryCredentials;
      labels?: { [key: string]: string };
    },
  ): KubeSecret {
    return new KubeSecret(scope, id, {
      metadata: {
        name: options.name,
        namespace: options.namespace || this.config.argoCDNamespace,
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'argocd.argoproj.io/secret-type': 'repository',
          ...options.labels,
        },
      },
      stringData: {
        username: options.credentials.username,
        password: options.credentials.password,
      },
    });
  }

  /**
   * Create a GitRepository resource for idpbuilder
   */
  createGitRepository(
    scope: Construct,
    id: string,
    options: {
      name: string;
      namespace?: string;
      repositoryName: string;
      organizationName?: string;
      ref?: string;
      path?: string;
      isPrivate?: boolean;
      credentialsSecret?: string;
    },
  ): GitRepositoryConstruct | undefined {
    // Only create GitRepository for local environment with Gitea
    if (this.config.environment !== 'local' || this.config.gitProvider?.type !== 'gitea') {
      return undefined;
    }

    return GitRepositoryHelper.createLocalGiteaRepository(scope, id, {
      ...options,
      namespace: options.namespace || this.config.argoCDNamespace,
      organizationName: options.organizationName || this.config.gitProvider.defaultOrganization,
    });
  }

  /**
   * Create both Application and GitRepository (if needed) in one call
   */
  createApplicationWithRepository(
    scope: Construct,
    id: string,
    props: {
      name: string;
      path: string;
      destinationNamespace: string;
      repository: {
        name?: string;
        organization?: string;
        url?: string;
        isPrivate?: boolean;
        credentials?: RepositoryCredentials;
      };
      targetRevision?: string;
      automatedSync?: boolean;
      createNamespace?: boolean;
      labels?: { [key: string]: string };
    },
  ): {
    application: ApplicationConstruct;
    gitRepository?: GitRepositoryConstruct;
    credentialsSecret?: KubeSecret;
  } {
    let credentialsSecret: KubeSecret | undefined;
    let credentialsSecretName: string | undefined;

    // Create credentials secret if needed
    if (props.repository.isPrivate && props.repository.credentials) {
      credentialsSecret = this.createRepositorySecret(scope, `${id}-credentials`, {
        name: `${props.name}-repo-credentials`,
        credentials: props.repository.credentials,
      });
      credentialsSecretName = credentialsSecret.name;
    }

    // Create GitRepository if in local environment
    const gitRepository = this.createGitRepository(scope, `${id}-gitrepo`, {
      name: `${props.name}-repo`,
      repositoryName: props.repository.name || props.name,
      organizationName: props.repository.organization,
      ref: props.targetRevision,
      path: props.path,
      isPrivate: props.repository.isPrivate,
      credentialsSecret: credentialsSecretName,
    });

    // Create Application
    const application = this.createApplication(scope, `${id}-app`, {
      ...props,
      repository: {
        ...props.repository,
        credentialsSecret: credentialsSecretName,
      },
    });

    return {
      application,
      gitRepository,
      credentialsSecret,
    };
  }

  /**
   * Get the Git URL for a repository based on the environment
   */
  getRepositoryUrl(organization: string, repositoryName: string): string {
    if (this.config.environment === 'local' && this.config.gitProvider?.type === 'gitea') {
      const baseUrl = this.config.gitProvider.baseUrl || 'http://gitea.gitea.svc.cluster.local:3000';
      return `${baseUrl}/${organization}/${repositoryName}.git`;
    } else if (this.config.environment === 'production' && this.config.gitProvider?.type === 'github') {
      return `https://github.com/${organization}/${repositoryName}.git`;
    }
    throw new Error(`Unsupported environment or git provider configuration`);
  }

  /**
   * Check if GitRepository resources are needed
   */
  needsGitRepository(): boolean {
    return this.config.environment === 'local' && this.config.gitProvider?.type === 'gitea';
  }
}

/**
 * Factory functions for common scenarios
 */
export class ArgoCDFactories {
  /**
   * Create a factory configured for local development with idpbuilder
   */
  static createLocalFactory(options?: {
    argoCDNamespace?: string;
    giteaOrganization?: string;
  }): ArgoCDEnvironmentFactory {
    return new ArgoCDEnvironmentFactory({
      environment: 'local',
      argoCDNamespace: options?.argoCDNamespace,
      gitProvider: {
        type: 'gitea',
        defaultOrganization: options?.giteaOrganization || 'gitea',
      },
      defaultSyncOptions: ['CreateNamespace=true'],
    });
  }

  /**
   * Create a factory configured for production with GitHub
   */
  static createProductionFactory(options?: {
    argoCDNamespace?: string;
    githubOrganization?: string;
    destinationServer?: string;
  }): ArgoCDEnvironmentFactory {
    return new ArgoCDEnvironmentFactory({
      environment: 'production',
      argoCDNamespace: options?.argoCDNamespace,
      destinationServer: options?.destinationServer,
      gitProvider: {
        type: 'github',
        defaultOrganization: options?.githubOrganization,
      },
    });
  }
}