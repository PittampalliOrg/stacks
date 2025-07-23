import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { 
  ExternalSecret,
  ExternalSecretSpecTargetCreationPolicy,
  ExternalSecretSpecSecretStoreRefKind,
  ExternalSecretSpecDataRemoteRefConversionStrategy,
  ExternalSecretSpecDataRemoteRefDecodingStrategy,
  ExternalSecretSpecDataRemoteRefMetadataPolicy
} from '../imports/external-secrets.io';

export interface WorkloadIdentityBootstrapChartProps extends ChartProps {
  /**
   * GitHub App ID
   */
  githubAppId?: string;
  
  /**
   * GitHub App Installation ID
   */
  githubAppInstallationId?: string;
  
  /**
   * GitHub repository URL
   * @default https://github.com/PittampalliOrg/cdk8s-project.git
   */
  githubRepoUrl?: string;
}

/**
 * Workload Identity Bootstrap Chart
 * Creates initial secrets required for ArgoCD to access private repositories
 * This includes the GitHub App credentials for repository access
 */
export class WorkloadIdentityBootstrapChart extends Chart {
  constructor(scope: Construct, id: string, props: WorkloadIdentityBootstrapChartProps = {}) {
    super(scope, id, props);

    const githubAppId = props.githubAppId || process.env.GH_APP_ID || '937905';
    const githubAppInstallationId = props.githubAppInstallationId || process.env.GH_INSTALLATION_ID || '58301875';
    const githubRepoUrl = props.githubRepoUrl || 'https://github.com/PittampalliOrg/cdk8s-project.git';

    // Create namespace for ArgoCD if it doesn't exist
    // Note: In actual deployment, this would be handled by ArgoCD app or namespace creation
    
    // GitHub PEM Key ExternalSecret
    new ExternalSecret(this, 'github-pem', {
      metadata: {
        name: 'github-pem',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'app.kubernetes.io/component': 'bootstrap',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-90',
        },
      },
      spec: {
        refreshInterval: '10m',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'github-pem',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
        },
        data: [
          {
            secretKey: 'privateKey',
            remoteRef: {
              key: 'github-app-private-key',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
              decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
              metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
            },
          },
        ],
      },
    });

    // GitHub App Repository Credentials ExternalSecret
    // This creates the secret that ArgoCD uses to authenticate with GitHub
    new ExternalSecret(this, 'github-app-repo-creds', {
      metadata: {
        name: 'github-app-repo-creds',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'app.kubernetes.io/component': 'bootstrap',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-89',
        },
      },
      spec: {
        refreshInterval: '10m',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'github-app-repo-creds',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            metadata: {
              labels: {
                'argocd.argoproj.io/secret-type': 'repository',
              },
            },
            data: {
              // Repository details
              type: 'git',
              url: githubRepoUrl,
              // GitHub App authentication
              githubAppID: githubAppId,
              githubAppInstallationID: githubAppInstallationId,
              githubAppPrivateKey: '{{ .privateKey | toString }}',
            },
          },
        },
        data: [
          {
            secretKey: 'privateKey',
            remoteRef: {
              key: 'github-app-private-key',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
              decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
              metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
            },
          },
        ],
      },
    });
  }
}