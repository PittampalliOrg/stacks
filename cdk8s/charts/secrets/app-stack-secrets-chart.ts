import { Chart, ChartProps, JsonPatch } from 'cdk8s';
import { Construct } from 'constructs';
import { 
  ExternalSecret,
  ExternalSecretSpecTargetCreationPolicy,
  ExternalSecretSpecSecretStoreRefKind
} from '../../imports/external-secrets.io';
import { createDockerConfigJsonExternalSecret } from '../../lib/eso-helpers';

/**
 * Chart that manages ExternalSecrets for the application stack
 * Creates ExternalSecrets for NextJS, Redis, and Postgres
 */
export class AppStackSecretsChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const namespace = 'nextjs';

    // Postgres/Neon Database Credentials
    new ExternalSecret(this, 'neon-database-secret', {
      metadata: {
        name: 'neon-database-credentials',
        namespace: namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-25' // Before applications
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'neon-database-credentials',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
        },
        data: [
          { secretKey: 'DATABASE_URL', remoteRef: { key: 'POSTGRES-URL' } },
          { secretKey: 'POSTGRES_URL', remoteRef: { key: 'POSTGRES-URL' } },
          { secretKey: 'POSTGRES_PRISMA_URL', remoteRef: { key: 'POSTGRES-URL' } },
          { secretKey: 'POSTGRES_URL_NON_POOLING', remoteRef: { key: 'POSTGRES-URL' } },
          { secretKey: 'NEON_API_KEY', remoteRef: { key: 'NEON-API-KEY' } },
          { secretKey: 'NEON_PROJECT_ID', remoteRef: { key: 'NEON-PROJECT-ID' } },
        ],
      },
    });

    // Docker registry secret for GHCR (using helper for consistency)
    const ghcr = createDockerConfigJsonExternalSecret(this, 'ghcr-dockercfg-external', {
      name: 'ghcr-dockercfg',
      namespace,
      registry: 'ghcr.io',
      usernameTemplate: 'pittampalliorg',
      passwordKey: 'GITHUB-PAT',
      secretStoreRef: { name: 'azure-keyvault-store', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      externalName: 'ghcr-dockercfg-external',
      creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
      refreshInterval: '1h',
    });
    ghcr.addJsonPatch(JsonPatch.add('/metadata/annotations', { 'argocd.argoproj.io/sync-wave': '-10' }));
    ghcr.addJsonPatch(JsonPatch.add('/metadata/labels', { 'app.kubernetes.io/name': 'ghcr-dockercfg', 'app.kubernetes.io/part-of': 'nextjs' }));

    // Redis Credentials (if needed in the future)
    // Uncomment and configure when Redis requires authentication
    /*
    new ApiObject(this, 'redis-credentials', {
      apiVersion: 'external-secrets.io/v1',
      kind: 'ExternalSecret',
      metadata: {
        name: 'redis-credentials',
        namespace: namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-25'
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE,
        },
        target: {
          name: 'redis-credentials',
          creationPolicy: 'Owner',
        },
        data: [
          {
            secretKey: 'REDIS_PASSWORD',
            remoteRef: {
              key: 'REDIS-PASSWORD',
            },
          },
        ],
      },
    });
    */

    // Additional application secrets can be added here
    // For example: API keys, service credentials, etc.
  }
}
