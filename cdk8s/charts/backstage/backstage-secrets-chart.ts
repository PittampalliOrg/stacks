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
import { createDockerConfigJsonExternalSecret, createEnvExternalSecret } from '../../lib/eso-helpers';
import { JsonPatch } from 'cdk8s';
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
    const backstageOidc = createEnvExternalSecret(this, 'backstage-oidc-external', {
      externalName: 'backstage-oidc',
      name: 'backstage-env-vars',
      namespace: 'backstage',
      refreshInterval: '0',
      secretStoreRef: { name: 'keycloak', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
      engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
      templateData: {
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
      },
      mappings: [
        { key: 'ARGOCD_SESSION_TOKEN', remoteRef: { key: 'keycloak-clients', property: 'ARGOCD_SESSION_TOKEN' } },
        { key: 'BACKSTAGE_CLIENT_SECRET', remoteRef: { key: 'keycloak-clients', property: 'BACKSTAGE_CLIENT_SECRET' } },
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
          rewrite: [ { transform: { template: 'POSTGRES_PASSWORD' } } ]
        },
        {
          sourceRef: {
            generatorRef: {
              apiVersion: 'generators.external-secrets.io/v1alpha1',
              kind: ExternalSecretSpecDataFromSourceRefGeneratorRefKind.PASSWORD,
              name: 'backstage-session'
            }
          },
          rewrite: [ { transform: { template: 'SESSION_SECRET' } } ]
        }
      ],
    });

    // Gitea credentials - REMOVED: Not needed for public repositories
    // Authentication is handled by IDPBuilder for public repo access

    // GHCR Docker registry secret with retry policy
    const ghcr = createDockerConfigJsonExternalSecret(this, 'ghcr-dockercfg-external', {
      name: 'ghcr-dockercfg',
      namespace: 'backstage',
      registry: 'ghcr.io',
      usernameTemplate: 'pittampalliorg',
      passwordKey: 'GITHUB-PAT',
      refreshInterval: '30s',
      secretStoreRef: { name: 'azure-keyvault-store', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
      engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
    });
    ghcr.addJsonPatch(JsonPatch.add('/metadata/labels', {
      'app.kubernetes.io/name': 'ghcr-dockercfg',
      'app.kubernetes.io/part-of': 'backstage'
    }));
    ghcr.addJsonPatch(JsonPatch.add('/metadata/annotations', {
      'argocd.argoproj.io/sync-wave': '-10',
      'argocd.argoproj.io/sync-options': 'Retry=true'
    }));

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
    const backstageAuth = createEnvExternalSecret(this, 'backstage-auth-external', {
      externalName: 'backstage-auth',
      name: 'backstage-auth',
      namespace: 'backstage',
      refreshInterval: '1h',
      secretStoreRef: { name: 'azure-keyvault-store', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
      engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
      templateData: {
        'AUTH_MICROSOFT_CLIENT_ID': '{{ .backstageAuth | fromJson | dig "microsoft-client-id" "" }}',
        'AUTH_MICROSOFT_CLIENT_SECRET': '{{ .backstageAuth | fromJson | dig "microsoft-client-secret" "" }}',
        'AUTH_MICROSOFT_TENANT_ID': '{{ .backstageAuth | fromJson | dig "microsoft-tenant-id" "" }}',
        'AUTH_MICROSOFT_DOMAIN_HINT': '{{ .backstageAuth | fromJson | dig "microsoft-domain-hint" "" }}',
        'BACKSTAGE_BACKEND_SECRET': '{{ .backstageAuth | fromJson | dig "backend-secret" "" }}',
        'BACKEND_SECRET': '{{ .backstageAuth | fromJson | dig "backend-secret" "" }}',
      },
      mappings: [ { key: 'backstageAuth', remote: 'BACKSTAGE-AUTH' } ],
    });
    backstageAuth.addJsonPatch(JsonPatch.add('/metadata/labels', {
      'app.kubernetes.io/name': 'backstage-auth',
      'app.kubernetes.io/part-of': 'backstage'
    }));

    // Gitea Docker registry secret - REMOVED: Not needed for public registry
    // The Gitea registry in IDPBuilder allows anonymous pulls for public images
  }
}
