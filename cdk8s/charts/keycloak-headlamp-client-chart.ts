import { Construct } from 'constructs';
import { Chart, ChartProps } from 'cdk8s';
import * as k8s from '../imports/k8s';

/**
 * Creates a Kubernetes Secret for Headlamp Keycloak client credentials
 * This secret will be populated manually after creating the client in Keycloak
 */
export class KeycloakHeadlampClientChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const namespace = 'keycloak';
    
    // Create a placeholder secret that will be manually updated with actual client credentials
    // This ensures the secret exists for the ExternalSecret to reference
    new k8s.KubeSecret(this, 'headlamp-client-secret', {
      metadata: {
        name: 'headlamp-client-credentials',
        namespace,
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'app.kubernetes.io/name': 'headlamp',
          'app.kubernetes.io/component': 'oidc-client',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-50', // Early deployment
          'argocd.argoproj.io/sync-options': 'SkipDryRunOnMissingResource=true',
        }
      },
      stringData: {
        'client-id': 'headlamp',
        'client-secret': 'sP6EFCYaY9kDRXplxd1OBW16ZZVQmuAA',
      },
      type: 'Opaque',
    });

    // Create a ConfigMap with Keycloak client configuration template
    // This can be used as reference for manual client creation
    new k8s.KubeConfigMap(this, 'headlamp-client-config', {
      metadata: {
        name: 'headlamp-client-config',
        namespace,
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'app.kubernetes.io/name': 'headlamp',
          'app.kubernetes.io/component': 'oidc-client-config',
        },
      },
      data: {
        'client-config.json': JSON.stringify({
          clientId: 'headlamp',
          name: 'Headlamp Kubernetes Dashboard',
          description: 'OIDC client for Headlamp dashboard authentication',
          rootUrl: 'https://cnoe.localtest.me/headlamp',
          adminUrl: 'https://cnoe.localtest.me/headlamp',
          baseUrl: '/headlamp',
          surrogateAuthRequired: false,
          enabled: true,
          alwaysDisplayInConsole: false,
          clientAuthenticatorType: 'client-secret',
          secret: 'GENERATED_IN_KEYCLOAK',
          redirectUris: [
            'https://cnoe.localtest.me/headlamp/oidc-callback',
            'http://localhost:4466/oidc-callback',
            'http://localhost:8000/*'
          ],
          webOrigins: [
            'https://cnoe.localtest.me',
            'http://localhost:4466',
            'http://localhost:8000'
          ],
          notBefore: 0,
          bearerOnly: false,
          consentRequired: false,
          standardFlowEnabled: true,
          implicitFlowEnabled: false,
          directAccessGrantsEnabled: true,
          serviceAccountsEnabled: false,
          publicClient: false,
          frontchannelLogout: false,
          protocol: 'openid-connect',
          attributes: {
            'backchannel.logout.session.required': 'true',
            'backchannel.logout.revoke.offline.tokens': 'false'
          },
          authenticationFlowBindingOverrides: {},
          fullScopeAllowed: true,
          nodeReRegistrationTimeout: -1,
          defaultClientScopes: [
            'web-origins',
            'profile',
            'roles',
            'email'
          ],
          optionalClientScopes: [
            'address',
            'phone',
            'offline_access',
            'microprofile-jwt'
          ],
          access: {
            view: true,
            configure: true,
            manage: true
          }
        }, null, 2),
        'instructions.txt': `Headlamp Keycloak Client Setup Instructions
==========================================

1. Access Keycloak Admin Console:
   - URL: https://cnoe.localtest.me/keycloak/admin
   - Login with admin credentials

2. Navigate to the idpbuilder realm:
   - Select "idpbuilder" from the realm dropdown

3. Create a new client:
   - Go to Clients → Create client
   - Client type: OpenID Connect
   - Client ID: headlamp
   - Name: Headlamp Kubernetes Dashboard
   - Always display in UI: OFF

4. Configure Capability config:
   - Client authentication: ON
   - Authorization: OFF
   - Authentication flow: Standard flow, Direct access grants
   - Uncheck other flows

5. Configure Login settings:
   - Root URL: https://cnoe.localtest.me/headlamp
   - Home URL: https://cnoe.localtest.me/headlamp
   - Valid redirect URIs:
     * https://cnoe.localtest.me/headlamp/oidc-callback
     * http://localhost:4466/oidc-callback
     * http://localhost:8000/*
   - Valid post logout redirect URIs:
     * https://cnoe.localtest.me/headlamp
   - Web origins:
     * https://cnoe.localtest.me
     * http://localhost:4466
     * http://localhost:8000

6. Save the client

7. Get the client secret:
   - Go to the Credentials tab
   - Copy the Client secret value

8. Update the Kubernetes secret:
   kubectl edit secret headlamp-client-credentials -n keycloak
   
   Replace the client-secret value with the base64 encoded secret:
   echo -n "YOUR_CLIENT_SECRET" | base64

9. Verify the secret is updated:
   kubectl get secret headlamp-client-credentials -n keycloak -o jsonpath='{.data.client-secret}' | base64 -d

10. The ExternalSecret in the headlamp namespace will automatically sync the credentials.
`
      }
    });
  }
}