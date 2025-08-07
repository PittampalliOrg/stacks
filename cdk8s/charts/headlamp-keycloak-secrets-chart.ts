import { Construct } from 'constructs';
import { Chart, ChartProps } from 'cdk8s';
import { 
  ExternalSecret, 
  ExternalSecretSpecTargetCreationPolicy,
  ExternalSecretSpecTargetTemplateEngineVersion,
  ExternalSecretSpecSecretStoreRefKind
} from '../imports/external-secrets.io';

/**
 * Creates External Secrets for Headlamp Keycloak authentication
 * Manages OIDC client credentials for Keycloak integration
 */
export class HeadlampKeycloakSecretsChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const namespace = 'headlamp';
    const keycloakUrl = process.env.KEYCLOAK_URL || 'https://cnoe.localtest.me:8443/keycloak';
    const keycloakRealm = process.env.KEYCLOAK_REALM || 'cnoe';

    // Headlamp Keycloak OIDC Authentication Secrets
    new ExternalSecret(this, 'headlamp-oidc-secrets', {
      metadata: {
        name: 'headlamp-oidc-secrets',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-15', // Create before Headlamp deployment
        }
      },
      spec: {
        refreshInterval: '5m',
        secretStoreRef: {
          name: 'keycloak',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'headlamp-oidc-secrets',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            type: 'Opaque',
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
            data: {
              'OIDC_CLIENT_ID': '{{ .clientId }}',
              'OIDC_CLIENT_SECRET': '{{ .clientSecret }}',
              'OIDC_ISSUER_URL': `${keycloakUrl}/realms/${keycloakRealm}`,
              'OIDC_SCOPES': 'openid email profile',
              'OIDC_REDIRECT_URL': 'https://headlamp.cnoe.localtest.me:8443/oidc-callback'
            }
          }
        },
        data: [
          {
            secretKey: 'clientId',
            remoteRef: {
              key: 'headlamp-client-credentials',
              property: 'client-id'
            }
          },
          {
            secretKey: 'clientSecret',
            remoteRef: {
              key: 'headlamp-client-credentials',
              property: 'client-secret'
            }
          }
        ]
      }
    });
  }
}