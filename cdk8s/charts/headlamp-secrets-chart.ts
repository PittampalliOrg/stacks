import { Construct } from 'constructs';
import { Chart, ChartProps } from 'cdk8s';
import { ExternalSecret, ExternalSecretSpecSecretStoreRefKind, ExternalSecretSpecTargetCreationPolicy, ExternalSecretSpecDataRemoteRefConversionStrategy, ExternalSecretSpecDataRemoteRefDecodingStrategy, ExternalSecretSpecDataRemoteRefMetadataPolicy } from '../imports/external-secrets.io';

/**
 * Creates External Secrets for Headlamp authentication
 * Pulls Azure AD OIDC credentials from Azure Key Vault
 */
export class HeadlampSecretsChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const namespace = 'monitoring';

    // Headlamp Azure AD Authentication Secrets
    new ExternalSecret(this, 'headlamp-auth-secrets', {
      metadata: {
        name: 'headlamp-auth-secrets',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-15', // Create before Headlamp deployment
        }
      },
      spec: {
        refreshInterval: '5m',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'headlamp-auth-secrets',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            type: 'Opaque',
            data: {
              'OIDC_CLIENT_ID': '{{ .OIDC_CLIENT_ID }}',
              'OIDC_CLIENT_SECRET': '{{ .OIDC_CLIENT_SECRET }}',
              'OIDC_ISSUER_URL': `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || '0c4da9c5-40ea-4e7d-9c7a-e7308d4f8e38'}/v2.0`,
              'OIDC_SCOPES': 'openid email profile',
              'OIDC_USE_ACCESS_TOKEN': 'true'
            }
          }
        },
        data: [
          {
            secretKey: 'OIDC_CLIENT_ID',
            remoteRef: {
              key: 'HEADLAMP-AZUREADAPP',
              property: 'microsoft-client-id',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
              decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
              metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
            }
          },
          {
            secretKey: 'OIDC_CLIENT_SECRET',
            remoteRef: {
              key: 'HEADLAMP-AZUREADAPP',
              property: 'microsoft-client-secret',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT,
              decodingStrategy: ExternalSecretSpecDataRemoteRefDecodingStrategy.NONE,
              metadataPolicy: ExternalSecretSpecDataRemoteRefMetadataPolicy.NONE
            }
          }
        ]
      }
    });
  }
}