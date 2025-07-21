import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { ApiObject } from 'cdk8s';
import * as k8s from '../imports/k8s';
import { 
  ExternalSecret,
  ExternalSecretSpecTargetCreationPolicy,
  ExternalSecretSpecTargetTemplateEngineVersion,
  ExternalSecretSpecTargetTemplateMergePolicy,
  ExternalSecretSpecSecretStoreRefKind,
  ExternalSecretSpecDataRemoteRefConversionStrategy,
  ExternalSecretSpecDataRemoteRefDecodingStrategy,
  ExternalSecretSpecDataRemoteRefMetadataPolicy
} from '../imports/external-secrets.io';

export class AllSecretsChart extends Chart {
  // Expose key secrets that other charts need
  public readonly kvVaultSecret: ExternalSecret;
  public readonly githubPemSecret: ApiObject | null; // Null because it's managed by bootstrap
  public readonly githubTokenSecret: ApiObject;
  public readonly acrSecret: ApiObject;
  public readonly appEnvSecret: ExternalSecret;

  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    // ---------------------------------------------------------------------
    // 1. ClusterSecretStore – Created by bootstrap
    // ---------------------------------------------------------------------
    // NOTE: ClusterSecretStore 'azure-keyvault-store' is created by
    // bootstrap/github-credentials-bootstrap.yaml to avoid duplication
    // and ensure it exists before any CDK8s applications are deployed

    // ---------------------------------------------------------------------
    // 2. GitHub Authentication Secrets
    // ---------------------------------------------------------------------
    
    // GitHub App Private Key - REMOVED
    // The github-pem secret is created by the bootstrap ExternalSecret in
    // bootstrap/github-credentials-bootstrap.yaml to avoid circular dependencies
    // during initial setup. The bootstrap version creates the secret with key 'privateKey'
    // from Azure KeyVault key 'github-app-private-key'. 
    // NOTE: This was causing "target is owned by another ExternalSecret" error
    this.githubPemSecret = null; // Set to null since it's managed by bootstrap

    // GitHub Authentication Resources - Created by bootstrap
    // NOTE: The following resources are created by bootstrap/github-credentials-bootstrap.yaml:
    // - GithubAccessToken 'github-auth-token' in argocd namespace
    // - ExternalSecret 'github-repo-credentials' in argocd namespace
    // These are created during bootstrap phase to ensure GitHub authentication
    // is available before CDK8s applications are deployed
    
    // Set githubTokenSecret to null since it's managed by bootstrap
    this.githubTokenSecret = null as any;

    // ---------------------------------------------------------------------
    // 3. Azure Container Registry Secrets
    // ---------------------------------------------------------------------
    
    // NOTE: ACR secrets (Service Account, ACRAccessToken generator, and ExternalSecret)
    // are ALL managed by infra-secrets-chart.ts to avoid duplication.
    // The infra-secrets-chart.ts creates:
    // - acr-sa ServiceAccount
    // - vpittamp-acr-token ACRAccessToken generator
    // - vpittamp-acr-credentials ExternalSecret
    // - kargo-acr-credentials ExternalSecret (for Kargo image discovery)
    
    // Set acrSecret to null since it's managed by infra-secrets-chart.ts
    this.acrSecret = null as any; // Type assertion to maintain interface compatibility

    // ---------------------------------------------------------------------
    // 4. Key Vault "Catch-All" Secret (all KeyVault secrets)
    // ---------------------------------------------------------------------
    const kvVaultSecret = new ExternalSecret(this, 'kv-vault', {
      metadata: { 
        name: 'kv-vault', 
        namespace: 'nextjs',
        annotations: {
          'argocd.argoproj.io/sync-wave': '-30',
        },
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: { 
          name: 'azure-keyvault-store', 
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE 
        },
        target: { 
          name: 'kv-vault', 
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER 
        },
        dataFrom: [
          {
            find: {
              name: {
                regexp: '.*'  // Import all secrets from KeyVault
              }
            }
          }
        ]
      }
    });
    this.kvVaultSecret = kvVaultSecret;

    // ---------------------------------------------------------------------
    // 5. Application Environment Variables (transforms hyphenated to underscores)
    // ---------------------------------------------------------------------
    const appEnvSecret = new ExternalSecret(this, 'app-env-es', {
      metadata: { 
        name: 'app-env', 
        namespace: 'nextjs',
        annotations: {
          'argocd.argoproj.io/sync-wave': '-25', // After kv-vault, before app-specific secrets
        },
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: { name: 'azure-keyvault-store', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
        target: { 
          name: 'app-env', 
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
            mergePolicy: ExternalSecretSpecTargetTemplateMergePolicy.REPLACE,
            data: {
              // Pass through all fetched secrets
              'OPENAI_API_KEY': '{{ .OPENAI_API_KEY }}',
              'AZURE_API_KEY': '{{ .AZURE_API_KEY }}',
              'ANTHROPIC_API_KEY': '{{ .ANTHROPIC_API_KEY }}',
              'GEMINI_API_KEY': '{{ .GEMINI_API_KEY }}',
              'XAI_API_KEY': '{{ .XAI_API_KEY }}',
              'AUTH_SECRET': '{{ .AUTH_SECRET }}',
              'POSTGRES_PASSWORD': '{{ .POSTGRES_PASSWORD }}',
              'TIMEZONE_DB_API_KEY': '{{ .TIMEZONE_DB_API_KEY }}',
              'NEON_DATABASE_PASSWORD': '{{ .NEON_DATABASE_PASSWORD }}',
              'NEON_API_KEY': '{{ .NEON_API_KEY }}',
              'NEON_PROJECT_ID': '{{ .NEON_PROJECT_ID }}',
              // Construct POSTGRES_URL for Neon Local proxy
              'POSTGRES_URL': '{{ .POSTGRES_URL }}',
            },
          },
        },
        data: [
          { secretKey: 'OPENAI_API_KEY',       remoteRef: { key: 'OPENAI-API-KEY', conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT, decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE, metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE } },
          { secretKey: 'AZURE_API_KEY',        remoteRef: { key: 'AZURE-API-KEY', conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT, decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE, metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE } },
          { secretKey: 'ANTHROPIC_API_KEY',    remoteRef: { key: 'ANTHROPIC-API-KEY', conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT, decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE, metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE } },
          { secretKey: 'GEMINI_API_KEY',       remoteRef: { key: 'GEMINI-API-KEY', conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT, decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE, metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE } },
          { secretKey: 'XAI_API_KEY',          remoteRef: { key: 'XAI-API-KEY', conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT, decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE, metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE } },
          { secretKey: 'AUTH_SECRET',          remoteRef: { key: 'AUTH-SECRET', conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT, decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE, metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE } },
          { secretKey: 'POSTGRES_PASSWORD',    remoteRef: { key: 'POSTGRES-PASSWORD', conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT, decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE, metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE } },
          { secretKey: 'TIMEZONE_DB_API_KEY',  remoteRef: { key: 'TIMEZONE-DB-API-KEY', conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT, decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE, metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE } },
          // Pull Neon credentials from KeyVault
          { secretKey: 'NEON_DATABASE_PASSWORD', remoteRef: { key: 'NEON-DATABASE-PASSWORD', conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT, decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE, metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE } },
          { secretKey: 'NEON_API_KEY',         remoteRef: { key: 'NEON-API-KEY', conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT, decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE, metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE } },
          { secretKey: 'NEON_PROJECT_ID',      remoteRef: { key: 'NEON-PROJECT-ID', conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT, decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE, metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE } },
          { secretKey: 'POSTGRES_URL',         remoteRef: { key: 'POSTGRES-URL', conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT, decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE, metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE } },
        ],
      },
    });
    this.appEnvSecret = appEnvSecret;

    // ---------------------------------------------------------------------
    // 6. Other Application-Specific Secrets
    // ---------------------------------------------------------------------
    
    // NextAuth/Auth.js Credentials
    new ExternalSecret(this, 'nextauth-credentials', {
      metadata: { 
        name: 'nextauth-credentials', 
        namespace: 'nextjs',
        annotations: {
          'argocd.argoproj.io/sync-wave': '-20',
        },
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: { 
          name: 'azure-keyvault-store', 
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE 
        },
        target: { 
          name: 'nextauth-credentials', 
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER 
        },
        data: [
          { secretKey: 'AUTH_SECRET', remoteRef: { key: 'AUTH-SECRET', conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT, decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE, metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE } },
          { secretKey: 'NEXTAUTH_SECRET', remoteRef: { key: 'AUTH-SECRET', conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT, decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE, metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE } }, // Some versions use NEXTAUTH_SECRET
        ]
      }
    });

    // Kagent Secrets - MOVED TO kagent-resources-chart.ts
    // NOTE: Kagent ExternalSecrets have been moved to kagent-resources-chart.ts
    // to avoid duplication and keep them with other Kagent resources

    // Note: Grafana API Token ExternalSecret for monitoring namespace
    // is created in grafana-token-job-chart.ts to ensure proper sync-wave ordering

    // ---------------------------------------------------------------------
    // 6. Kargo Git Credentials - Using Personal Access Token
    // ---------------------------------------------------------------------
    
    // Kargo GitHub Credentials using PAT from Azure Key Vault
    const kargoGitCredentials = new ExternalSecret(this, 'kargo-git-credentials-pat', {
      metadata: {
        name: 'kargo-git-credentials-pat',
        namespace: 'nextjs',
        annotations: {
          'argocd.argoproj.io/sync-wave': '-25',
        },
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'kargo-git-credentials-pat',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            metadata: {
              labels: {
                'kargo.akuity.io/cred-type': 'git', // Required for Kargo discovery
              },
            },
            type: 'Opaque',
            data: {
              repoURL: 'https://github.com/PittampalliOrg/cdk8s-project.git',
              username: 'x-access-token', // GitHub expects this for PAT auth
              password: '{{ .pat }}',
              type: 'git',
            },
          },
        },
        data: [
          {
            secretKey: 'pat',
            remoteRef: {
              key: 'GITHUB-PAT', // Your existing PAT in Key Vault
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
              decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
              metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
            },
          },
        ],
      },
    });

    // MCP Server Secrets - github-token moved to kgateway-mcp-servers-chart.ts
    // to avoid duplication 

    new ExternalSecret(this, 'grafana-mcp-secrets', {
      metadata: { 
        name: 'grafana-mcp-secrets-external', 
        namespace: 'mcp-servers',
        annotations: {
          'argocd.argoproj.io/sync-wave': '-20',
        },
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: { 
          name: 'azure-keyvault-store', 
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE 
        },
        target: { 
          name: 'grafana-mcp-secrets', 
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER 
        },
        data: [
          { secretKey: 'api-key', remoteRef: { key: 'GRAFANA-API-KEY', conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT, decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE, metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE } },
        ]
      }
    });

    // ---------------------------------------------------------------------
    // Dependencies
    // ---------------------------------------------------------------------
    // Note: ClusterSecretStore and GitHub resources are created by bootstrap,
    // so we don't need to manage dependencies for them here
    
    // Kargo Git credentials dependency removed - ClusterSecretStore is created by bootstrap
    
    // ACR dependencies removed - all ACR resources are managed by infra-secrets-chart.ts
    
    // kvVaultSecret and appEnvSecret don't need explicit dependencies on ClusterSecretStore
    // since it's created during bootstrap before CDK8s apps are deployed

  }
}