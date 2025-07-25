import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { 
  ExternalSecretV1Beta1 as ExternalSecret,
  ExternalSecretV1Beta1SpecTargetCreationPolicy as ExternalSecretSpecTargetCreationPolicy,
  ExternalSecretV1Beta1SpecTargetTemplateEngineVersion as ExternalSecretSpecTargetTemplateEngineVersion,
  ExternalSecretV1Beta1SpecTargetTemplateMergePolicy as ExternalSecretSpecTargetTemplateMergePolicy,
  ExternalSecretV1Beta1SpecDataRemoteRefConversionStrategy as ExternalSecretSpecDataRemoteRefConversionStrategy,
  ExternalSecretV1Beta1SpecDataRemoteRefDecodingStrategy as ExternalSecretSpecDataRemoteRefDecodingStrategy,
  ExternalSecretV1Beta1SpecDataRemoteRefMetadataPolicy as ExternalSecretSpecDataRemoteRefMetadataPolicy
} from '../imports/external-secrets.io';

export interface NextJsSecretsChartProps extends ChartProps {
  // Additional props can be added here as needed
}

export class NextJsSecretsChart extends Chart {
  constructor(scope: Construct, id: string, props: NextJsSecretsChartProps = {}) {
    super(scope, id, props);

    const namespace = 'nextjs';

    // Note: ClusterSecretStore 'azure-keyvault-store' is created by bootstrap
    // We just reference it here

    // ---------------------------------------------------------------------
    // 1. Application Environment Variables (AI API keys, etc.)
    // ---------------------------------------------------------------------
    new ExternalSecret(this, 'app-env', {
      metadata: { 
        name: 'app-env', 
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '80', // After data services, before NextJS
        },
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: { 
          name: 'azure-keyvault-store', 
          kind: 'ClusterSecretStore' 
        },
        target: { 
          name: 'app-env', 
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
            mergePolicy: ExternalSecretSpecTargetTemplateMergePolicy.REPLACE,
            data: {
              // AI Provider API Keys
              'OPENAI_API_KEY': '{{ .OPENAI_API_KEY }}',
              'AZURE_API_KEY': '{{ .AZURE_API_KEY }}',
              'ANTHROPIC_API_KEY': '{{ .ANTHROPIC_API_KEY }}',
              'GEMINI_API_KEY': '{{ .GEMINI_API_KEY }}',
              'XAI_API_KEY': '{{ .XAI_API_KEY }}',
              
              // Authentication
              'AUTH_SECRET': '{{ .AUTH_SECRET }}',
              
              // Database
              'POSTGRES_PASSWORD': '{{ .POSTGRES_PASSWORD }}',
              'POSTGRES_URL': '{{ .POSTGRES_URL }}',
              
              // Other APIs
              'TIMEZONE_DB_API_KEY': '{{ .TIMEZONE_DB_API_KEY }}',
              
              // Neon specific
              'NEON_DATABASE_PASSWORD': '{{ .NEON_DATABASE_PASSWORD }}',
              'NEON_API_KEY': '{{ .NEON_API_KEY }}',
              'NEON_PROJECT_ID': '{{ .NEON_PROJECT_ID }}',
            },
          },
        },
        data: [
          { secretKey: 'OPENAI_API_KEY',       remoteRef: { key: 'OPENAI-API-KEY' } },
          { secretKey: 'AZURE_API_KEY',        remoteRef: { key: 'AZURE-API-KEY' } },
          { secretKey: 'ANTHROPIC_API_KEY',    remoteRef: { key: 'ANTHROPIC-API-KEY' } },
          { secretKey: 'GEMINI_API_KEY',       remoteRef: { key: 'GEMINI-API-KEY' } },
          { secretKey: 'XAI_API_KEY',          remoteRef: { key: 'XAI-API-KEY' } },
          { secretKey: 'AUTH_SECRET',          remoteRef: { key: 'AUTH-SECRET' } },
          { secretKey: 'POSTGRES_PASSWORD',    remoteRef: { key: 'POSTGRES-PASSWORD' } },
          { secretKey: 'POSTGRES_URL',         remoteRef: { key: 'POSTGRES-URL' } },
          { secretKey: 'TIMEZONE_DB_API_KEY',  remoteRef: { key: 'TIMEZONE-DB-API-KEY' } },
          { secretKey: 'NEON_DATABASE_PASSWORD', remoteRef: { key: 'NEON-DATABASE-PASSWORD' } },
          { secretKey: 'NEON_API_KEY',         remoteRef: { key: 'NEON-API-KEY' } },
          { secretKey: 'NEON_PROJECT_ID',      remoteRef: { key: 'NEON-PROJECT-ID' } },
        ],
      },
    });

    // ---------------------------------------------------------------------
    // 2. Neon Database Credentials
    // ---------------------------------------------------------------------
    new ExternalSecret(this, 'neon-database-credentials', {
      metadata: { 
        name: 'neon-database-credentials', 
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '80',
        },
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: { 
          name: 'azure-keyvault-store', 
          kind: 'ClusterSecretStore' 
        },
        target: { 
          name: 'neon-database-credentials', 
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
            data: {
              // Construct DATABASE_URL for Neon
              'DATABASE_URL': 'postgresql://vpittamp:{{ .password }}@ep-wispy-math-a8k8xapb-pooler.eastus2.azure.neon.tech/devdb?sslmode=require',
              'POSTGRES_URL': '{{ .url }}',
              'POSTGRES_PASSWORD': '{{ .password }}',
              'POSTGRES_USER': 'vpittamp',
              'POSTGRES_DB': 'devdb',
              'POSTGRES_HOST': 'ep-wispy-math-a8k8xapb-pooler.eastus2.azure.neon.tech',
            },
          },
        },
        data: [
          { secretKey: 'password', remoteRef: { key: 'NEON-DATABASE-PASSWORD' } },
          { secretKey: 'url',      remoteRef: { key: 'POSTGRES-URL' } },
        ],
      },
    });

    // ---------------------------------------------------------------------
    // 3. GitHub Container Registry Credentials
    // ---------------------------------------------------------------------
    new ExternalSecret(this, 'ghcr-dockercfg-external', {
      metadata: {
        name: 'ghcr-dockercfg-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'ghcr-dockercfg',
          'app.kubernetes.io/part-of': 'nextjs'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-10', // Create before deployment
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore',
        },
        target: {
          name: 'ghcr-dockercfg',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            type: 'kubernetes.io/dockerconfigjson',
            data: {
              '.dockerconfigjson': `{
                "auths": {
                  "ghcr.io": {
                    "username": "pittampalliorg",
                    "password": "{{ .pat }}",
                    "auth": "{{ printf "%s:%s" "pittampalliorg" .pat | b64enc }}"
                  }
                }
              }`
            }
          }
        },
        data: [
          {
            secretKey: 'pat',
            remoteRef: {
              key: 'GITHUB-PAT',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
              decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
              metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
            }
          }
        ]
      }
    });

    // ---------------------------------------------------------------------
    // 4. NextAuth/Auth.js Credentials
    // ---------------------------------------------------------------------
    new ExternalSecret(this, 'nextauth-credentials', {
      metadata: { 
        name: 'nextauth-credentials', 
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '80',
        },
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: { 
          name: 'azure-keyvault-store', 
          kind: 'ClusterSecretStore' 
        },
        target: { 
          name: 'nextauth-credentials', 
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER 
        },
        data: [
          { secretKey: 'AUTH_SECRET',     remoteRef: { key: 'AUTH-SECRET' } },
          { secretKey: 'NEXTAUTH_SECRET', remoteRef: { key: 'AUTH-SECRET' } }, // Some versions use NEXTAUTH_SECRET
        ]
      }
    });
  }
}