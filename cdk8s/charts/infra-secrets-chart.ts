// cdk8s/charts/infra-secrets-chart.ts
import { Chart, ApiObject, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { 
  ExternalSecret,
  ExternalSecretSpecTargetCreationPolicy,
  ExternalSecretSpecSecretStoreRefKind,
  ExternalSecretSpecTargetTemplateEngineVersion,
  ExternalSecretSpecDataFromSourceRefGeneratorRefKind
} from '../imports/external-secrets.io';

export class InfraSecretsChart extends Chart {
  public readonly appEnvSecret: ApiObject;
  public readonly acrSecret: ExternalSecret;
  public readonly kvVaultSecret: ApiObject;

  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    // const keyVault = this.node.tryGetContext('keyvaultName') ?? 'keyvault-thcmfmoo5oeow';

    /* ---------------------------------------------------------------------
     * 1. ServiceAccount (acr-sa) – workload-identity for ACR generator
     * -------------------------------------------------------------------*/
    const acrServiceAccount = new ApiObject(this, 'acr-sa', {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: {
        name: 'acr-sa',
        namespace: 'nextjs',
        labels: { 'azure.workload.identity/use': 'true' },
        annotations: {
          'azure.workload.identity/client-id': process.env.AZURE_CLIENT_ID || '',
          'azure.workload.identity/tenant-id': process.env.AZURE_TENANT_ID || '0c4da9c5-40ea-4e7d-9c7a-e7308d4f8e38',
          'argocd.argoproj.io/sync-wave': '-20', // Deploy early to setup workload identity
        },
      },
    });

    // Removed ACR ServiceAccount for argocd namespace - using public Docker image for CDK8s plugin
    // The nextjs namespace still needs ACR access for the chat-frontend image

    /* ---------------------------------------------------------------------
     * 2. ClusterSecretStore – Created by github-auth-chart.ts
     * Note: Removed from here to avoid duplication
     * -------------------------------------------------------------------*/

    /* ---------------------------------------------------------------------
     * 3. ACRAccessToken generator  ➜  4. ExternalSecret (docker-cfg)
     * -------------------------------------------------------------------*/
    const acrAccessToken = new ApiObject(this, 'acr-access-token', {
      apiVersion: 'generators.external-secrets.io/v1alpha1',
      kind: 'ACRAccessToken',
      metadata: { 
        name: 'vpittamp-acr-token', 
        namespace: 'nextjs',
        annotations: {
          'argocd.argoproj.io/sync-wave': '-15', // After service account, before external secret
        },
      },
      spec: {
        tenantId: '0c4da9c5-40ea-4e7d-9c7a-e7308d4f8e38',
        registry: 'vpittamp.azurecr.io',
        environmentType: 'PublicCloud',
        auth: {
          workloadIdentity: {
            serviceAccountRef: {
              name: 'acr-sa',
              namespace: 'nextjs',
              audiences: ['api://AzureADTokenExchange'],
            },
          },
        },
      },
    });

    const acrSecret = new ExternalSecret(this, 'acr-exsecret', {
      metadata: { 
        name: 'vpittamp-acr-credentials', 
        namespace: 'nextjs',
        annotations: {
          'argocd.argoproj.io/sync-wave': '-10', // Creates the actual docker pull secret
        },
      },
      spec: {
        refreshInterval: '3h',
        dataFrom: [
          {
            sourceRef: {
              generatorRef: {
                apiVersion: 'generators.external-secrets.io/v1alpha1',
                kind: ExternalSecretSpecDataFromSourceRefGeneratorRefKind.ACR_ACCESS_TOKEN,
                name: 'vpittamp-acr-token',
              },
            },
          },
        ],
        target: {
          name: 'vpittamp-acr-dockercfg',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            type: 'kubernetes.io/dockerconfigjson',
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
            data: {
              '.dockerconfigjson': `{
                "auths": {
                  "vpittamp.azurecr.io": {
                    "username": "{{ .username }}",
                    "password": "{{ .password }}"
                  }
                }
              }`,
            },
          },
        },
      },
    });
    this.acrSecret = acrSecret;

    // Kargo ACR Credentials - Required for Kargo to discover images from ACR
    // This secret uses the Kargo-specific format with the required label
    const kargoAcrSecret = new ExternalSecret(this, 'kargo-acr-credentials', {
      metadata: { 
        name: 'kargo-acr-credentials', 
        namespace: 'nextjs',
        annotations: {
          'argocd.argoproj.io/sync-wave': '-9', // After ACR docker secret
        },
      },
      spec: {
        refreshInterval: '3h',
        dataFrom: [
          {
            sourceRef: {
              generatorRef: {
                apiVersion: 'generators.external-secrets.io/v1alpha1',
                kind: ExternalSecretSpecDataFromSourceRefGeneratorRefKind.ACR_ACCESS_TOKEN,
                name: 'vpittamp-acr-token',
              },
            },
          },
        ],
        target: {
          name: 'kargo-acr-credentials',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            metadata: {
              labels: {
                'kargo.akuity.io/cred-type': 'image',
              },
            },
            type: 'Opaque',
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
            data: {
              'repoURL': 'vpittamp.azurecr.io/chat-frontend',
              'username': '{{ .username }}',
              'password': '{{ .password }}',
            },
          },
        },
      },
    });


    // Removed ACR resources for ArgoCD namespace - using public Docker image for CDK8s plugin
    // The nextjs namespace still has ACR resources above for the chat-frontend image

    /* ---------------------------------------------------------------------
     * 5-7. GitHub App access – Moved to github-auth-chart.ts
     * Note: Removed from here to avoid duplication. The following are now
     * created by github-auth-chart.ts:
     * - GithubAccessToken generator (github-auth-token)
     * - ExternalSecret (kv-github-pem) 
     * - ExternalSecret (github-repo-credentials)
     * -------------------------------------------------------------------*/

    /* ---------------------------------------------------------------------
     * 8. Generic ExternalSecret (kv-vault) – bulk import from Key Vault
     * MOVED TO all-secrets-chart.ts for consolidated secret management
     * -------------------------------------------------------------------*/
    // kv-vault ExternalSecret is now created in all-secrets-chart.ts
    this.kvVaultSecret = null as any;

    /* ---------------------------------------------------------------------
     * 9. ExternalSecret – app-env (selected keys)
     * MOVED TO all-secrets-chart.ts for consolidated secret management
     * -------------------------------------------------------------------*/
    // app-env ExternalSecret is now created in all-secrets-chart.ts
    this.appEnvSecret = null as any;

    // Add dependencies to ensure proper ordering
    acrAccessToken.addDependency(acrServiceAccount);
    acrSecret.addDependency(acrAccessToken);
    kargoAcrSecret.addDependency(acrAccessToken); // Kargo secret also needs the ACR token
    
    // Note: The acr-sa ServiceAccount depends on:
    // 1. The nextjs namespace existing (created by platform-core-chart)
    // 2. The Workload Identity Webhook being ready (deployed by infrastructure-apps)
    // 3. The AZURE_CLIENT_ID being available (from ArgoCD repo-server environment)
    // These are satisfied by the chart-level dependency on github-auth
    
    // ArgoCD namespace dependencies removed - using public Docker image
    
    // Dependencies ensure proper ordering within this chart
    // The ClusterSecretStore from github-auth-chart must be deployed first
  }
}
