import { Construct } from 'constructs';
import { Chart, ChartProps } from 'cdk8s';
import { 
  ExternalSecretV1Beta1 as ExternalSecret, 
  ExternalSecretV1Beta1SpecDataRemoteRef as ExternalSecretSpecDataRemoteRef, 
  ExternalSecretV1Beta1SpecTargetCreationPolicy as ExternalSecretSpecTargetCreationPolicy, 
  ExternalSecretV1Beta1SpecTargetTemplateEngineVersion as ExternalSecretSpecTargetTemplateEngineVersion 
} from '../imports/external-secrets.io';

/**
 * Creates external secrets for Backstage application
 * Pulls secrets from Azure KeyVault using the configured ClusterSecretStore
 */
export class BackstageSecretsChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const namespace = 'backstage';

    // GitHub Container Registry Credentials
    new ExternalSecret(this, 'ghcr-dockercfg-external', {
      metadata: {
        name: 'ghcr-dockercfg-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'ghcr-dockercfg',
          'app.kubernetes.io/part-of': 'backstage'
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore',
        },
        target: {
          name: 'ghcr-dockercfg',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
            type: 'kubernetes.io/dockerconfigjson',
            data: {
              '.dockerconfigjson': `{
                "auths": {
                  "ghcr.io": {
                    "username": "pittampalliorg",
                    "password": "{{ .pat }}",
                    "auth": "{{ (printf "%s:%s" "pittampalliorg" .pat) | b64enc }}"
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
              key: 'GITHUB-PAT'
            } as ExternalSecretSpecDataRemoteRef
          }
        ]
      }
    });
  }
}