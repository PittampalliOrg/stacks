import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { 
  ExternalSecret,
  ExternalSecretSpecTargetCreationPolicy,
  ExternalSecretSpecTargetTemplateEngineVersion,
  ExternalSecretSpecDataRemoteRefConversionStrategy,
  ExternalSecretSpecDataRemoteRefDecodingStrategy,
  ExternalSecretSpecDataRemoteRefMetadataPolicy,
  ExternalSecretSpecSecretStoreRefKind
} from '../../imports/external-secrets.io';
import { JsonPatch } from 'cdk8s';
import { createDockerConfigJsonExternalSecret } from '../../lib/eso-helpers';

export interface BackstageSecretsChartProps extends ChartProps {
  // Additional props can be added here as needed
}

export class BackstageSecretsChart extends Chart {
  constructor(scope: Construct, id: string, props: BackstageSecretsChartProps = {}) {
    super(scope, id, props);

    const namespace = 'backstage';

    // Note: ClusterSecretStore 'azure-keyvault-store' is created by bootstrap
    // We just reference it here

    // ---------------------------------------------------------------------
    // GitHub Container Registry Credentials for pulling private images
    // ---------------------------------------------------------------------
    const ghcr = createDockerConfigJsonExternalSecret(this, 'ghcr-dockercfg-external', {
      name: 'ghcr-dockercfg',
      namespace,
      registry: 'ghcr.io',
      usernameTemplate: 'pittampalliorg',
      passwordKey: 'GITHUB-PAT',
      refreshInterval: '1h',
      secretStoreRef: { name: 'azure-keyvault-store', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
      engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
    });
    ghcr.addJsonPatch(
      JsonPatch.add('/metadata/labels', {
        'app.kubernetes.io/name': 'ghcr-dockercfg',
        'app.kubernetes.io/part-of': 'backstage',
      }),
    );
    ghcr.addJsonPatch(
      JsonPatch.add('/metadata/annotations', {
        'argocd.argoproj.io/sync-wave': '-10',
      }),
    );
  }
}
