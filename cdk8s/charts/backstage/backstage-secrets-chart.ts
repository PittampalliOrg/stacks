import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { 
  ExternalSecretV1Beta1 as ExternalSecret,
  ExternalSecretV1Beta1SpecTargetCreationPolicy as ExternalSecretSpecTargetCreationPolicy,
  ExternalSecretV1Beta1SpecDataRemoteRefConversionStrategy as ExternalSecretSpecDataRemoteRefConversionStrategy,
  ExternalSecretV1Beta1SpecTargetTemplateEngineVersion as ExternalSecretSpecTargetTemplateEngineVersion
} from '../../imports/external-secrets.io';
import { Password } from '../../imports/generators.external-secrets.io';

/**
 * Chart that manages ExternalSecrets and Password generators for Backstage
 */
export class BackstageSecretsChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    // Password generator for PostgreSQL
    new Password(this, 'postgres-password', {
      metadata: {
        name: 'backstage',
        namespace: 'backstage'
      },
      spec: {
        length: 36,
        digits: 5,
        symbols: 5,
        symbolCharacters: '/-+',
        noUpper: false,
        allowRepeat: true
      }
    });

    // Password generator for session secret
    new Password(this, 'session-password', {
      metadata: {
        name: 'backstage-session',
        namespace: 'backstage'
      },
      spec: {
        length: 64,
        digits: 10,
        symbols: 10,
        symbolCharacters: '/-+=',
        noUpper: false,
        allowRepeat: true
      }
    });

    // Main Backstage OIDC secret
    new ExternalSecret(this, 'backstage-oidc', {
      metadata: {
        name: 'backstage-oidc',
        namespace: 'backstage'
      },
      spec: {
        secretStoreRef: {
          name: 'keycloak',
          kind: 'ClusterSecretStore'
        },
        refreshInterval: '0',
        target: {
          name: 'backstage-env-vars',
          template: {
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
            data: {
              'BACKSTAGE_FRONTEND_URL': 'https://cnoe.localtest.me:8443/backstage',
              'POSTGRES_HOST': 'postgresql.backstage.svc.cluster.local',
              'POSTGRES_PORT': '5432',
              'POSTGRES_DB': 'backstage',
              'POSTGRES_USER': 'backstage',
              'POSTGRES_PASSWORD': '{{.POSTGRES_PASSWORD}}',
              'BACKSTAGE_SESSION_SECRET': '{{.SESSION_SECRET}}',
              'ARGO_WORKFLOWS_URL': 'https://cnoe.localtest.me:8443/argo-workflows',
              'KEYCLOAK_NAME_METADATA': 'https://cnoe.localtest.me:8443/keycloak/realms/cnoe/.well-known/openid-configuration',
              'KEYCLOAK_CLIENT_SECRET': '{{.BACKSTAGE_CLIENT_SECRET}}',
              'ARGOCD_AUTH_TOKEN': 'argocd.token={{.ARGOCD_SESSION_TOKEN}}',
              'ARGO_CD_URL': 'https://argocd-server.argocd.svc.cluster.local/api/v1/'
            }
          }
        },
        data: [
          {
            secretKey: 'ARGOCD_SESSION_TOKEN',
            remoteRef: {
              key: 'keycloak-clients',
              property: 'ARGOCD_SESSION_TOKEN'
            }
          },
          {
            secretKey: 'BACKSTAGE_CLIENT_SECRET',
            remoteRef: {
              key: 'keycloak-clients',
              property: 'BACKSTAGE_CLIENT_SECRET'
            }
          }
        ],
        dataFrom: [
          {
            sourceRef: {
              generatorRef: {
                apiVersion: 'generators.external-secrets.io/v1alpha1',
                kind: 'Password',
                name: 'backstage'
              }
            },
            rewrite: [
              {
                transform: {
                  template: 'POSTGRES_PASSWORD'
                }
              }
            ]
          },
          {
            sourceRef: {
              generatorRef: {
                apiVersion: 'generators.external-secrets.io/v1alpha1',
                kind: 'Password',
                name: 'backstage-session'
              }
            },
            rewrite: [
              {
                transform: {
                  template: 'SESSION_SECRET'
                }
              }
            ]
          }
        ]
      }
    });

    // Gitea credentials
    new ExternalSecret(this, 'gitea-credentials', {
      metadata: {
        name: 'gitea-credentials',
        namespace: 'backstage'
      },
      spec: {
        secretStoreRef: {
          name: 'gitea',
          kind: 'ClusterSecretStore'
        },
        refreshInterval: '0',
        target: {
          name: 'gitea-credentials'
        },
        data: [
          {
            secretKey: 'GITEA_USERNAME',
            remoteRef: {
              key: 'gitea-credential',
              property: 'username'
            }
          },
          {
            secretKey: 'GITEA_PASSWORD',
            remoteRef: {
              key: 'gitea-credential',
              property: 'password'
            }
          }
        ]
      }
    });

    // GHCR Docker registry secret
    new ExternalSecret(this, 'ghcr-dockercfg', {
      metadata: {
        name: 'ghcr-dockercfg-external',
        namespace: 'backstage',
        labels: {
          'app.kubernetes.io/name': 'ghcr-dockercfg',
          'app.kubernetes.io/part-of': 'backstage'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-10'
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore'
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
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT
            }
          }
        ]
      }
    });
  }
}