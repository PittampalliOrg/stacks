import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { KubeConfigMap } from '../imports/k8s';

/**
 * Kargo CA Certificates Chart
 * Creates a ConfigMap with CA certificates for Kargo to trust self-signed certificates
 */
export class KargoCACertificatesChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    // The IDPBuilder certificate from the default namespace
    // This is the self-signed certificate used by all services in the cluster
    const idpBuilderCert = `-----BEGIN CERTIFICATE-----
MIIBsDCCAVWgAwIBAgIRAMtLWGHIUr7Ysh+sJ4QcA0IwCgYIKoZIzj0EAwIwEjEQ
MA4GA1UEChMHY25vZS5pbzAeFw0yNTA4MDcxMTAxMzhaFw0yNjA4MDcxNzAxMzha
MBIxEDAOBgNVBAoTB2Nub2UuaW8wWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAARo
vosSwCmKcDiV2z/wvW1QPHYCJ4xDPBSAVheRrc6HzCeQ3IcYm9YSfZS1WTW4UjRU
fVdq5dXLnZNClec4fnlqo4GLMIGIMA4GA1UdDwEB/wQEAwIChDATBgNVHSUEDDAK
BggrBgEFBQcDATAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBRPki9370HSdDwN
+KDNTvsRSaRPXjAxBgNVHREEKjAoghFjbm9lLmxvY2FsdGVzdC5tZYITKi5jbm9l
LmxvY2FsdGVzdC5tZTAKBggqhkjOPQQDAgNJADBGAiEAhRoQYfSMa4P1f0ydIV7M
iaZNK27ARuk6nfZr23FSdisCIQCvDXgXEwEsMeo1tfRUer8vFryegrj2bDsKvYwh
jGDOSw==
-----END CERTIFICATE-----`;

    // Create ConfigMap with CA certificates in kargo-pipelines namespace
    new KubeConfigMap(this, 'gitea-ca-cert', {
      metadata: {
        name: 'gitea-ca-cert',
        namespace: 'kargo-pipelines',
        labels: {
          'app.kubernetes.io/name': 'gitea-ca-cert',
          'app.kubernetes.io/part-of': 'kargo-pipelines',
          'app.kubernetes.io/component': 'certificates'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-20' // Deploy before other resources
        }
      },
      data: {
        'ca.crt': idpBuilderCert,
        'gitea-ca.crt': idpBuilderCert // Also available under this name
      }
    });

    // Create the same ConfigMap in kargo namespace for the controller
    new KubeConfigMap(this, 'gitea-ca-cert-kargo', {
      metadata: {
        name: 'gitea-ca-cert',
        namespace: 'kargo',
        labels: {
          'app.kubernetes.io/name': 'gitea-ca-cert',
          'app.kubernetes.io/part-of': 'kargo',
          'app.kubernetes.io/component': 'certificates'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-20' // Deploy before Kargo
        }
      },
      data: {
        'ca.crt': idpBuilderCert,
        'gitea-ca.crt': idpBuilderCert
      }
    });
  }
}