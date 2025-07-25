import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { Application } from './imports/argoproj.io';

export type Environment = 'dev' | 'staging' | 'production';

export interface EnvironmentAwareApplicationProps extends ChartProps {
  /**
   * Name of the application
   */
  appName: string;

  /**
   * Namespace where the Application resource will be created (usually 'argocd')
   */
  appNamespace?: string;

  /**
   * Environment to deploy to
   */
  environment: Environment;

  /**
   * For dev environment: relative path from the application file to the manifests directory
   * For prod/staging: path within the git repository
   */
  sourcePath: string;

  /**
   * For prod/staging environments: GitHub repository URL
   * Example: https://github.com/myorg/myrepo.git
   */
  gitRepoUrl?: string;

  /**
   * Target revision (branch, tag, or commit SHA)
   */
  targetRevision?: string;

  /**
   * ArgoCD project name
   */
  project?: string;

  /**
   * Destination namespace where the application will be deployed
   */
  destinationNamespace: string;

  /**
   * Destination Kubernetes server
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
   * Create namespace if it doesn't exist
   */
  createNamespace?: boolean;
}

export class EnvironmentAwareApplication extends Chart {
  constructor(scope: Construct, id: string, props: EnvironmentAwareApplicationProps) {
    super(scope, id, props);

    // Determine repository URL based on environment
    let repoURL: string;
    let path: string;

    if (props.environment === 'dev') {
      // For dev environment with idpbuilder, use cnoe:// prefix
      // This tells idpbuilder to:
      // 1. Create a local Gitea repository
      // 2. Sync the contents from the local directory
      // 3. Replace the repoURL with the Gitea repository URL
      repoURL = `cnoe://${props.sourcePath}`;
      path = '.'; // ArgoCD will sync from the root of the cnoe:// path
    } else {
      // For staging/production, use GitHub repository
      if (!props.gitRepoUrl) {
        throw new Error('gitRepoUrl is required for staging and production environments');
      }
      repoURL = props.gitRepoUrl;
      path = props.sourcePath;
      
      // TODO: GitHub Private Repository Authentication
      // For private repositories, you'll need to configure authentication.
      // Options include:
      // 
      // 1. SSH Key Method:
      //    - Create a Secret with SSH private key
      //    - Configure ArgoCD repo-creds with the secret
      //    - Use git@github.com:org/repo.git URL format
      // 
      // 2. Personal Access Token Method:
      //    - Create a Secret with GitHub PAT
      //    - Configure ArgoCD repo-creds with username/token
      //    - Use https://github.com/org/repo.git URL format
      // 
      // 3. GitHub App Method:
      //    - Register a GitHub App
      //    - Configure ArgoCD with app credentials
      //    - More secure for organization-wide access
      // 
      // Example Secret for PAT method:
      // apiVersion: v1
      // kind: Secret
      // metadata:
      //   name: github-repo-creds
      //   namespace: argocd
      //   labels:
      //     argocd.argoproj.io/secret-type: repo-creds
      // stringData:
      //   type: git
      //   url: https://github.com/myorg
      //   username: not-used
      //   password: <github-personal-access-token>
    }

    // Build sync policy
    const syncPolicy: any = {};
    
    if (props.automatedSync) {
      syncPolicy.automated = {
        selfHeal: props.selfHeal !== false, // Default to true
      };
    }
    
    if (props.createNamespace) {
      syncPolicy.syncOptions = ['CreateNamespace=true'];
    }

    // Create the Application resource
    new Application(this, 'Application', {
      metadata: {
        name: props.appName,
        namespace: props.appNamespace || 'argocd',
        labels: props.labels,
      },
      spec: {
        project: props.project || 'default',
        source: {
          repoUrl: repoURL,
          path: path,
          targetRevision: props.targetRevision || 'HEAD',
        },
        destination: {
          server: props.destinationServer || 'https://kubernetes.default.svc',
          namespace: props.destinationNamespace,
        },
        syncPolicy: Object.keys(syncPolicy).length > 0 ? syncPolicy : undefined,
      },
    });
  }
}