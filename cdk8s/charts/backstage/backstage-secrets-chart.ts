import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { 
  ExternalSecret,
  ExternalSecretSpecTargetCreationPolicy,
  ExternalSecretSpecSecretStoreRefKind,
  ExternalSecretSpecDataRemoteRefConversionStrategy,
  ExternalSecretSpecTargetTemplateEngineVersion,
  ExternalSecretSpecDataFromSourceRefGeneratorRefKind
} from '../../imports/external-secrets.io';
import { Password, GithubAccessToken } from '../../imports/generators.external-secrets.io';

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

    // GitHub Access Token generator - Commented out, using PAT instead
    // new GithubAccessToken(this, 'github-token', {
    //   metadata: {
    //     name: 'github-token',
    //     namespace: 'backstage'
    //   },
    //   spec: {
    //     appId: '1272071',
    //     installId: '66754705',
    //     auth: {
    //       privateKey: {
    //         secretRef: {
    //           name: 'github-app-private-key',
    //           namespace: 'backstage',
    //           key: 'private-key'
    //         }
    //       }
    //     },
    //     // repositories: ['backstage-app'], // Commented out to allow access to all repositories
    //     permissions: {
    //       packages: 'read'
    //     }
    //   }
    // });

    // GitHub App Private Key secret - Commented out, using PAT instead
    // new ExternalSecret(this, 'github-app-private-key', {
    //   metadata: {
    //     name: 'github-app-private-key',
    //     namespace: 'backstage'
    //   },
    //   spec: {
    //     refreshInterval: '1h',
    //     secretStoreRef: {
    //       name: 'azure-keyvault-store',
    //       kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
    //     },
    //     target: {
    //       name: 'github-app-private-key',
    //       creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER
    //     },
    //     data: [
    //       {
    //         secretKey: 'private-key',
    //         remoteRef: {
    //           key: 'GITHUB-APP-PRIVATE-KEY',
    //           conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT
    //         }
    //       }
    //     ]
    //   }
    // });

    // Main Backstage OIDC secret
    new ExternalSecret(this, 'backstage-oidc', {
      metadata: {
        name: 'backstage-oidc',
        namespace: 'backstage'
      },
      spec: {
        secretStoreRef: {
          name: 'keycloak',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
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
              'ARGO_CD_URL': 'https://argocd-server.argocd.svc.cluster.local/api/v1/',
              'BACKSTAGE_SERVICE_TOKEN': '46Y8Je+VWx4djespJvjKg7Q1FKKE7eBM'
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
                kind: ExternalSecretSpecDataFromSourceRefGeneratorRefKind.PASSWORD,
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
                kind: ExternalSecretSpecDataFromSourceRefGeneratorRefKind.PASSWORD,
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
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
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
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
        },
        target: {
          name: 'ghcr-dockercfg',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            type: 'kubernetes.io/dockerconfigjson',
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
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

    // GitHub App credentials from Azure Key Vault
    new ExternalSecret(this, 'backstage-github-app', {
      metadata: {
        name: 'backstage-github-app',
        namespace: 'backstage',
        labels: {
          'app.kubernetes.io/name': 'backstage-github-app',
          'app.kubernetes.io/part-of': 'backstage'
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
        },
        target: {
          name: 'backstage-github-app',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
            data: {
              'AUTH_ORG_APP_ID': '{{ .githubApp | fromJson | dig "app-id" "" }}',
              'AUTH_ORG_CLIENT_ID': '{{ .githubApp | fromJson | dig "client-id" "" }}',
              'AUTH_ORG_CLIENT_SECRET': '{{ .githubApp | fromJson | dig "client-secret" "" }}',
              'AUTH_ORG1_PRIVATE_KEY': '{{ .githubApp | fromJson | dig "private-key" "" }}',
              'AUTH_ORG_WEBHOOK_SECRET': '{{ .githubApp | fromJson | dig "webhook-secret" "" }}'
            }
          }
        },
        data: [
          {
            secretKey: 'githubApp',
            remoteRef: {
              key: 'BACKSTAGE-GITHUB-APP',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT
            }
          }
        ]
      }
    });

    // GitHub OAuth credentials from Azure Key Vault
    new ExternalSecret(this, 'backstage-github-oauth', {
      metadata: {
        name: 'backstage-github-oauth',
        namespace: 'backstage',
        labels: {
          'app.kubernetes.io/name': 'backstage-github-oauth',
          'app.kubernetes.io/part-of': 'backstage'
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
        },
        target: {
          name: 'backstage-github-oauth',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
            data: {
              'AUTH_GITHUB_CLIENT_ID': '{{ .githubOAuth | fromJson | dig "dev" "client-id" "" }}',
              'AUTH_GITHUB_CLIENT_SECRET': '{{ .githubOAuth | fromJson | dig "dev" "client-secret" "" }}'
            }
          }
        },
        data: [
          {
            secretKey: 'githubOAuth',
            remoteRef: {
              key: 'BACKSTAGE-GITHUB-OAUTH',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT
            }
          }
        ]
      }
    });

    // Microsoft Auth credentials from Azure Key Vault
    new ExternalSecret(this, 'backstage-auth', {
      metadata: {
        name: 'backstage-auth',
        namespace: 'backstage',
        labels: {
          'app.kubernetes.io/name': 'backstage-auth',
          'app.kubernetes.io/part-of': 'backstage'
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
        },
        target: {
          name: 'backstage-auth',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
            data: {
              'AUTH_MICROSOFT_CLIENT_ID': '{{ .backstageAuth | fromJson | dig "microsoft-client-id" "" }}',
              'AUTH_MICROSOFT_CLIENT_SECRET': '{{ .backstageAuth | fromJson | dig "microsoft-client-secret" "" }}',
              'AUTH_MICROSOFT_TENANT_ID': '{{ .backstageAuth | fromJson | dig "microsoft-tenant-id" "" }}',
              'AUTH_MICROSOFT_DOMAIN_HINT': '{{ .backstageAuth | fromJson | dig "microsoft-domain-hint" "" }}',
              'BACKSTAGE_BACKEND_SECRET': '{{ .backstageAuth | fromJson | dig "backend-secret" "" }}'
            }
          }
        },
        data: [
          {
            secretKey: 'backstageAuth',
            remoteRef: {
              key: 'BACKSTAGE-AUTH',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT
            }
          }
        ]
      }
    });

    // Gitea Docker registry secret
    new ExternalSecret(this, 'gitea-dockercfg', {
      metadata: {
        name: 'gitea-dockercfg-external',
        namespace: 'backstage',
        labels: {
          'app.kubernetes.io/name': 'gitea-dockercfg',
          'app.kubernetes.io/part-of': 'backstage'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-10'
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'gitea',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
        },
        target: {
          name: 'gitea-dockercfg',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            type: 'kubernetes.io/dockerconfigjson',
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
            data: {
              '.dockerconfigjson': '{"auths":{"gitea.cnoe.localtest.me:8443":{"username":"{{ .username }}","password":"{{ .password }}","auth":"{{ printf "%s:%s" .username .password | b64enc }}"}}}'
            }
          }
        },
        data: [
          {
            secretKey: 'username',
            remoteRef: {
              key: 'gitea-credential',
              property: 'username',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT
            }
          },
          {
            secretKey: 'password',
            remoteRef: {
              key: 'gitea-credential',
              property: 'password',
              conversionStrategy: ExternalSecretSpecDataRemoteRefConversionStrategy.DEFAULT
            }
          }
        ]
      }
    });
  }
}