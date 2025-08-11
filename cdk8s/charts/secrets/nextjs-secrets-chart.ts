import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { 
  ExternalSecret,
  ExternalSecretSpecTargetCreationPolicy,
  ExternalSecretSpecTargetTemplateEngineVersion,
  ExternalSecretSpecTargetTemplateMergePolicy as ExternalSecretSpecTargetTemplateMergePolicy,
  ExternalSecretSpecDataRemoteRefConversionStrategy,
  ExternalSecretSpecDataRemoteRefDecodingStrategy as ExternalSecretSpecDataRemoteRefDecodingStrategy,
  ExternalSecretSpecDataRemoteRefMetadataPolicy as ExternalSecretSpecDataRemoteRefMetadataPolicy,
  ExternalSecretSpecSecretStoreRefKind
} from '../../imports/external-secrets.io';
import { JsonPatch } from 'cdk8s';
import { createDockerConfigJsonExternalSecret, createEnvExternalSecret } from '../../lib/eso-helpers';

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
    const appEnv = createEnvExternalSecret(this, 'app-env-external', {
      externalName: 'app-env', // match original ExternalSecret name
      name: 'app-env',
      namespace,
      refreshInterval: '1h',
      secretStoreRef: { name: 'azure-keyvault-store', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
      engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
      mergePolicy: ExternalSecretSpecTargetTemplateMergePolicy.REPLACE,
      mappings: [
        { key: 'OPENAI_API_KEY', remote: 'OPENAI-API-KEY' },
        { key: 'AZURE_API_KEY', remote: 'AZURE-API-KEY' },
        { key: 'ANTHROPIC_API_KEY', remote: 'ANTHROPIC-API-KEY' },
        { key: 'GEMINI_API_KEY', remote: 'GEMINI-API-KEY' },
        { key: 'XAI_API_KEY', remote: 'XAI-API-KEY' },
        { key: 'AUTH_SECRET', remote: 'AUTH-SECRET' },
        { key: 'POSTGRES_PASSWORD', remote: 'POSTGRES-PASSWORD' },
        { key: 'POSTGRES_URL', remote: 'POSTGRES-URL' },
        { key: 'TIMEZONE_DB_API_KEY', remote: 'TIMEZONE-DB-API-KEY' },
        { key: 'NEON_DATABASE_PASSWORD', remote: 'NEON-DATABASE-PASSWORD' },
        { key: 'NEON_API_KEY', remote: 'NEON-API-KEY' },
        { key: 'NEON_PROJECT_ID', remote: 'NEON-PROJECT-ID' },
      ],
    });
    appEnv.addJsonPatch(JsonPatch.add('/metadata/annotations', { 'argocd.argoproj.io/sync-wave': '80' }));

    // ---------------------------------------------------------------------
    // 2. Neon Database Credentials
    // ---------------------------------------------------------------------
    const neon = createEnvExternalSecret(this, 'neon-database-credentials-external', {
      externalName: 'neon-database-credentials',
      name: 'neon-database-credentials',
      namespace,
      refreshInterval: '1h',
      secretStoreRef: { name: 'azure-keyvault-store', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
      engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
      mappings: [
        { key: 'password', remote: 'NEON-DATABASE-PASSWORD' },
        { key: 'url', remote: 'POSTGRES-URL' },
      ],
      templateData: {
        'DATABASE_URL': 'postgresql://vpittamp:{{ .password }}@ep-wispy-math-a8k8xapb-pooler.eastus2.azure.neon.tech/devdb?sslmode=require',
        'POSTGRES_URL': '{{ .url }}',
        'POSTGRES_PASSWORD': '{{ .password }}',
        'POSTGRES_USER': 'vpittamp',
        'POSTGRES_DB': 'devdb',
        'POSTGRES_HOST': 'ep-wispy-math-a8k8xapb-pooler.eastus2.azure.neon.tech',
      },
    });
    neon.addJsonPatch(JsonPatch.add('/metadata/annotations', { 'argocd.argoproj.io/sync-wave': '80' }));

    // ---------------------------------------------------------------------
    // 3. GitHub Container Registry Credentials
    // ---------------------------------------------------------------------
    const ghcr = createDockerConfigJsonExternalSecret(this, 'ghcr-dockercfg-external', {
      name: 'ghcr-dockercfg',
      namespace,
      registry: 'ghcr.io',
      usernameTemplate: 'pittampalliorg',
      passwordKey: 'GITHUB-PAT',
      refreshInterval: '1h',
      secretStoreRef: { name: 'azure-keyvault-store', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
    });
    ghcr.addJsonPatch(
      JsonPatch.add('/metadata/labels', {
        'app.kubernetes.io/name': 'ghcr-dockercfg',
        'app.kubernetes.io/part-of': 'nextjs',
      }),
    );
    ghcr.addJsonPatch(
      JsonPatch.add('/metadata/annotations', {
        'argocd.argoproj.io/sync-wave': '-10',
      }),
    );
    ghcr.addJsonPatch(
      JsonPatch.add('/spec/target/creationPolicy', ExternalSecretSpecTargetCreationPolicy.OWNER as unknown as any),
    );
    ghcr.addJsonPatch(
      JsonPatch.add('/spec/target/template/engineVersion', ExternalSecretSpecTargetTemplateEngineVersion.V2 as unknown as any),
    );

    // ---------------------------------------------------------------------
    // 4. NextAuth/Auth.js Credentials
    // ---------------------------------------------------------------------
    const nextAuth = createEnvExternalSecret(this, 'nextauth-credentials-external', {
      externalName: 'nextauth-credentials',
      name: 'nextauth-credentials',
      namespace,
      refreshInterval: '1h',
      secretStoreRef: { name: 'azure-keyvault-store', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
      mappings: [
        { key: 'AUTH_SECRET', remote: 'AUTH-SECRET' },
        { key: 'NEXTAUTH_SECRET', remote: 'AUTH-SECRET' },
      ],
    });
    nextAuth.addJsonPatch(JsonPatch.add('/metadata/annotations', { 'argocd.argoproj.io/sync-wave': '80' }));
  }
}
