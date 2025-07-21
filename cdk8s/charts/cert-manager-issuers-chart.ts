import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { ClusterIssuer } from '../imports/cert-manager.io';

/**
 * Cert Manager ClusterIssuers Chart
 * 
 * Creates Let's Encrypt ClusterIssuers for staging and production certificates.
 * These are used by cert-manager to automatically provision TLS certificates.
 */
export class CertManagerIssuersChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    // Get email from environment variable or use default
    const acmeEmail = process.env.ACME_EMAIL || 'admin@example.com';
    
    // Let's Encrypt Staging ClusterIssuer
    // Use this for testing to avoid rate limits
    new ClusterIssuer(this, 'letsencrypt-staging', {
      metadata: {
        name: 'letsencrypt-staging',
        annotations: {
          'argocd.argoproj.io/sync-wave': '-290', // After cert-manager
        },
      },
      spec: {
        acme: {
          // The ACME server URL for Let's Encrypt staging
          server: 'https://acme-staging-v02.api.letsencrypt.org/directory',
          // Email address used for ACME registration
          email: acmeEmail,
          // Name of a secret used to store the ACME account private key
          privateKeySecretRef: {
            name: 'letsencrypt-staging-key',
          },
          // Enable the HTTP-01 challenge provider
          solvers: [
            {
              http01: {
                ingress: {
                  class: 'nginx',
                },
              },
            },
          ],
        },
      },
    });

    // Let's Encrypt Production ClusterIssuer
    // Use this for real certificates after testing with staging
    new ClusterIssuer(this, 'letsencrypt-prod', {
      metadata: {
        name: 'letsencrypt-prod',
        annotations: {
          'argocd.argoproj.io/sync-wave': '-290', // After cert-manager
        },
      },
      spec: {
        acme: {
          // The ACME server URL for Let's Encrypt production
          server: 'https://acme-v02.api.letsencrypt.org/directory',
          // Email address used for ACME registration
          email: acmeEmail,
          // Name of a secret used to store the ACME account private key
          privateKeySecretRef: {
            name: 'letsencrypt-prod-key',
          },
          // Enable the HTTP-01 challenge provider
          solvers: [
            {
              http01: {
                ingress: {
                  class: 'nginx',
                },
              },
            },
          ],
        },
      },
    });

    // Optional: Self-signed ClusterIssuer for local development
    // This can be used when you don't have internet access or DNS
    new ClusterIssuer(this, 'selfsigned', {
      metadata: {
        name: 'selfsigned',
        annotations: {
          'argocd.argoproj.io/sync-wave': '-290', // After cert-manager
        },
      },
      spec: {
        selfSigned: {},
      },
    });
  }
}