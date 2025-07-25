import { ApplicationSpecSource } from '../imports/argoproj.io';

/**
 * Interface for providing git source configuration for ArgoCD Applications
 * based on different environments and git providers
 */
export interface GitSourceProvider {
  /**
   * Get the ArgoCD source configuration
   */
  getSource(path: string, targetRevision?: string): ApplicationSpecSource;
  
  /**
   * Get any additional configuration needed (e.g., secrets for authentication)
   */
  getAdditionalConfig?(): GitSourceAdditionalConfig;
}

/**
 * Additional configuration that might be needed for git sources
 */
export interface GitSourceAdditionalConfig {
  /**
   * Secret references for authentication
   */
  secretRef?: {
    name: string;
    namespace: string;
  };
  
  /**
   * Instructions for manual setup
   */
  setupInstructions?: string[];
}

/**
 * Local development provider using cnoe:// prefix for idpbuilder
 */
export class GiteaLocalProvider implements GitSourceProvider {
  getSource(path: string, targetRevision: string = 'HEAD'): ApplicationSpecSource {
    return {
      repoUrl: `cnoe://${path}`,
      path: '.',
      targetRevision: targetRevision,
    };
  }
}

/**
 * GitHub provider for private repositories
 */
export class GitHubPrivateProvider implements GitSourceProvider {
  constructor(
    private readonly organization: string,
    private readonly repository: string,
    private readonly baseUrl: string = 'https://github.com'
  ) {}

  getSource(path: string, targetRevision: string = 'main'): ApplicationSpecSource {
    return {
      repoUrl: `${this.baseUrl}/${this.organization}/${this.repository}.git`,
      path: path,
      targetRevision: targetRevision,
    };
  }

  getAdditionalConfig(): GitSourceAdditionalConfig {
    return {
      secretRef: {
        name: `github-${this.repository}-creds`,
        namespace: 'argocd',
      },
      setupInstructions: [
        `Create a GitHub Personal Access Token with 'repo' scope`,
        `Create the secret with:`,
        `kubectl create secret generic github-${this.repository}-creds \\`,
        `  --namespace=argocd \\`,
        `  --from-literal=type=git \\`,
        `  --from-literal=url=${this.baseUrl}/${this.organization} \\`,
        `  --from-literal=username=not-used \\`,
        `  --from-literal=password=<YOUR-GITHUB-PAT>`,
        ``,
        `Label the secret for ArgoCD:`,
        `kubectl label secret github-${this.repository}-creds \\`,
        `  --namespace=argocd \\`,
        `  argocd.argoproj.io/secret-type=repo-creds`,
      ],
    };
  }
}

/**
 * GitHub provider for public repositories (no authentication needed)
 */
export class GitHubPublicProvider implements GitSourceProvider {
  constructor(
    private readonly organization: string,
    private readonly repository: string,
    private readonly baseUrl: string = 'https://github.com'
  ) {}

  getSource(path: string, targetRevision: string = 'main'): ApplicationSpecSource {
    return {
      repoUrl: `${this.baseUrl}/${this.organization}/${this.repository}.git`,
      path: path,
      targetRevision: targetRevision,
    };
  }
}

/**
 * Factory for creating git source providers based on environment
 */
export class GitSourceProviderFactory {
  static forEnvironment(
    environment: 'dev' | 'staging' | 'production',
    config?: {
      organization?: string;
      repository?: string;
      isPrivate?: boolean;
    }
  ): GitSourceProvider {
    if (environment === 'dev') {
      return new GiteaLocalProvider();
    }
    
    if (!config?.organization || !config?.repository) {
      throw new Error('GitHub organization and repository are required for non-dev environments');
    }
    
    if (config.isPrivate !== false) {
      // Default to private repositories for safety
      return new GitHubPrivateProvider(config.organization, config.repository);
    }
    
    return new GitHubPublicProvider(config.organization, config.repository);
  }
}