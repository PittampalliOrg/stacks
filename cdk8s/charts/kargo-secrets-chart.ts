import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { ExternalSecret, ExternalSecretSpecTargetCreationPolicy, ExternalSecretSpecTargetTemplateEngineVersion, ExternalSecretSpecSecretStoreRefKind } from '../imports/external-secrets.io';
import { KubeSecret } from '../imports/k8s';

export interface KargoSecretsChartProps extends ChartProps {
  namespace?: string;
}

export class KargoSecretsChart extends Chart {
  constructor(scope: Construct, id: string, props: KargoSecretsChartProps = {}) {
    super(scope, id, props);

    const namespace = props.namespace || 'kargo';

    // Create External Secret for Kargo admin credentials
    new ExternalSecret(this, 'kargo-admin-external-secret', {
      metadata: {
        name: 'kargo-admin-credentials',
        namespace: namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-50', // Deploy before Kargo
        },
      },
      spec: {
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE
        },
        target: {
          name: 'kargo-admin-credentials',
          creationPolicy: ExternalSecretSpecTargetCreationPolicy.OWNER,
          template: {
            engineVersion: ExternalSecretSpecTargetTemplateEngineVersion.V2,
            type: 'Opaque',
            data: {
              // The password hash should be generated using:
              // htpasswd -bnBC 10 "" <password> | tr -d ':\n'
              passwordHash: '{{ .KARGO_ADMIN_PASSWORD_HASH }}',
              // The signing key should be generated using:
              // openssl rand -base64 48 | tr -d "=+/" | head -c 32
              tokenSigningKey: '{{ .KARGO_ADMIN_TOKEN_SIGNING_KEY }}',
            }
          }
        },
        refreshInterval: '1h',
        data: [
          {
            secretKey: 'KARGO_ADMIN_PASSWORD_HASH',
            remoteRef: {
              key: 'KARGO-ADMIN-PASSWORD-HASH'
            }
          },
          {
            secretKey: 'KARGO_ADMIN_TOKEN_SIGNING_KEY',
            remoteRef: {
              key: 'KARGO-ADMIN-TOKEN-SIGNING-KEY'
            }
          }
        ]
      }
    });

    // Create a ConfigMap with instructions for setting up Kargo secrets
    new KubeSecret(this, 'kargo-setup-instructions', {
      metadata: {
        name: 'kargo-setup-instructions',
        namespace: namespace,
      },
      stringData: {
        'setup-instructions.txt': `Kargo Admin Credentials Setup
=============================

1. Generate a secure password:
   pass=$(openssl rand -base64 48 | tr -d "=+/" | head -c 32)
   echo "Password: $pass"

2. Generate the password hash:
   echo "Password Hash: $(htpasswd -bnBC 10 "" $pass | tr -d ':\\n')"

3. Generate a token signing key:
   echo "Signing Key: $(openssl rand -base64 48 | tr -d "=+/" | head -c 32)"

4. Add these values to Azure Key Vault:
   - KARGO-ADMIN-PASSWORD-HASH: <the password hash from step 2>
   - KARGO-ADMIN-TOKEN-SIGNING-KEY: <the signing key from step 3>

5. The External Secret will automatically sync these values to Kubernetes

Note: Keep the plain password from step 1 secure - you'll need it to log into Kargo.
The admin username is: admin
`,
      }
    });
  }
}