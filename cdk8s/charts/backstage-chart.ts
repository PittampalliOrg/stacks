import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';
import { Quantity } from '../imports/k8s';
import { getImage } from '../lib/image-loader';

export class BackstageChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const namespace = 'backstage';
    const appName = 'backstage';
    const environment = process.env.ENVIRONMENT || 'dev';

    // Construct baseUrl from INGRESS_HOST
    const ingressHost = process.env.INGRESS_HOST || 'localtest.me';
    const enableTls = process.env.ENABLE_TLS === 'true';
    const protocol = enableTls ? 'https' : 'http';
    // Use localhost:7007 for local development (Azure AD compatibility)
    const backstageBaseUrl = environment === 'dev' && ingressHost === 'localtest.me' 
      ? 'http://localhost:7007' 
      : `${protocol}://backstage.${ingressHost}`;

    // Namespace is managed by platform-core-chart

    // Create Docker registry secret for GHCR using External Secrets
    new ApiObject(this, 'ghcr-dockercfg-external', {
      apiVersion: 'external-secrets.io/v1',
      kind: 'ExternalSecret',
      metadata: {
        name: 'ghcr-dockercfg-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'ghcr-dockercfg',
          'app.kubernetes.io/part-of': 'backstage'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-10', // Create before deployment
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
          creationPolicy: 'Owner',
          template: {
            type: 'kubernetes.io/dockerconfigjson',
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
              conversionStrategy: 'Default',
              decodingStrategy: 'None',
              metadataPolicy: 'None'
            }
          }
        ]
      }
    });

    // Create External Secret for Neon Database credentials
    new ApiObject(this, 'backstage-neon-db-external', {
      apiVersion: 'external-secrets.io/v1',
      kind: 'ExternalSecret',
      metadata: {
        name: 'backstage-neon-db-external',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'backstage-neon-db',
          'app.kubernetes.io/part-of': 'backstage'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-10', // Create before deployment
        }
      },
      spec: {
        refreshInterval: '1h',
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore',
        },
        target: {
          name: 'backstage-neon-db-secrets',
          creationPolicy: 'Owner',
          template: {
            data: {
              'host': `{{ (.BACKSTAGE_NEON_DB | fromJson).${environment}.POSTGRES_HOST }}`,
              'password': `{{ (.BACKSTAGE_NEON_DB | fromJson).${environment}.POSTGRES_PASSWORD }}`
            }
          }
        },
        data: [
          {
            secretKey: 'BACKSTAGE_NEON_DB',
            remoteRef: {
              key: 'BACKSTAGE-NEON-DB',
              conversionStrategy: 'Default',
              decodingStrategy: 'None',
              metadataPolicy: 'None'
            }
          }
        ]
      }
    });

    // PostgreSQL connection details - Using Neon database
    const postgresPort = process.env.POSTGRES_PORT || '5432';
    const postgresUser = process.env.POSTGRES_USER || 'neondb_owner';
    const postgresDatabase = process.env.POSTGRES_DATABASE || 'neondb';
    const postgresSslMode = process.env.POSTGRES_SSL_MODE || 'require';
    const postgresChannelBinding = process.env.POSTGRES_CHANNEL_BINDING || 'require';

    // ConfigMap removed - using environment variables and app-config.yaml from Docker image

    // Service Account
    const serviceAccount = new k8s.KubeServiceAccount(this, 'service-account', {
      metadata: {
        name: appName,
        namespace
      }
    });

    // ClusterRole for Kubernetes access - includes permissions for Kubernetes Ingestor plugin
    const clusterRole = new k8s.KubeClusterRole(this, 'cluster-role', {
      metadata: {
        name: `${appName}-kubernetes-access`
      },
      rules: [{
        apiGroups: [''],
        resources: ['pods', 'pods/log', 'services', 'configmaps', 'namespaces', 'limitranges', 'resourcequotas', 'secrets'],
        verbs: ['get', 'list', 'watch']
      }, {
        apiGroups: ['apps'],
        resources: ['deployments', 'replicasets', 'statefulsets', 'daemonsets'],
        verbs: ['get', 'list', 'watch']
      }, {
        apiGroups: ['batch'],
        resources: ['jobs', 'cronjobs'],
        verbs: ['get', 'list', 'watch']
      }, {
        apiGroups: ['networking.k8s.io'],
        resources: ['ingresses'],
        verbs: ['get', 'list', 'watch']
      }, {
        apiGroups: ['metrics.k8s.io'],
        resources: ['pods'],
        verbs: ['get', 'list']
      }, {
        apiGroups: ['apiextensions.k8s.io'],
        resources: ['customresourcedefinitions'],
        verbs: ['get', 'list', 'watch']
      }, {
        apiGroups: ['autoscaling'],
        resources: ['horizontalpodautoscalers'],
        verbs: ['get', 'list', 'watch']
      }]
    });

    // ClusterRoleBinding
    new k8s.KubeClusterRoleBinding(this, 'cluster-role-binding', {
      metadata: {
        name: `${appName}-kubernetes-access`
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: clusterRole.name
      },
      subjects: [{
        kind: 'ServiceAccount',
        name: serviceAccount.name,
        namespace: namespace
      }]
    });

    // Deployment
    new k8s.KubeDeployment(this, 'deployment', {
      metadata: {
        name: appName,
        namespace,
        labels: {
          'app.kubernetes.io/name': appName,
          'app.kubernetes.io/component': 'backend',
          'app.kubernetes.io/part-of': 'backstage'
        }
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            'app.kubernetes.io/name': appName
          }
        },
        template: {
          metadata: {
            labels: {
              'app.kubernetes.io/name': appName,
              'app.kubernetes.io/component': 'backend',
              'app.kubernetes.io/part-of': 'backstage'
            }
          },
          spec: {
            serviceAccountName: serviceAccount.name,
            containers: [{
              name: 'backstage',
              image: getImage('backstage'),
              ports: [{ containerPort: 7007, name: 'http' }],
              env: [
                { name: 'NODE_ENV', value: 'production' }, // Ensure production mode
                {
                  name: 'POSTGRES_HOST',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'backstage-neon-db-secrets',
                      key: 'host'
                    }
                  }
                },
                { name: 'POSTGRES_PORT', value: postgresPort },
                { name: 'POSTGRES_USER', value: postgresUser },
                { name: 'POSTGRES_DATABASE', value: postgresDatabase },
                { name: 'PGSSLMODE', value: postgresSslMode }, // Neon requires SSL
                { name: 'PGCHANNELBINDING', value: postgresChannelBinding }, // Neon channel binding
                { name: 'APP_BASE_URL', value: process.env.BACKSTAGE_BASE_URL || backstageBaseUrl },
                { name: 'BACKEND_BASE_URL', value: process.env.BACKSTAGE_BASE_URL || backstageBaseUrl },
                { name: 'BACKEND_LISTEN', value: ':7007' }, // Configure listen address
                { name: 'ENVIRONMENT', value: process.env.ENVIRONMENT || 'dev' },
                { name: 'K8S_CLUSTER_URL', value: 'https://kubernetes.default.svc' }, // In-cluster URL
                { name: 'K8S_CLUSTER_NAME', value: process.env.CLUSTER_NAME || 'local' },
                { name: 'ARGOCD_API_URL', value: 'http://argocd-server.argocd:80' }, // Use internal service URL
                {
                  name: 'POSTGRES_PASSWORD',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'backstage-neon-db-secrets',
                      key: 'password'
                    }
                  }
                },
                {
                  name: 'GITHUB_TOKEN',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'github-token',
                      key: 'token',
                      optional: true
                    }
                  }
                },
                {
                  name: 'AUTH_MICROSOFT_CLIENT_ID',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'backstage-auth-secrets',
                      key: 'microsoft-client-id',
                      optional: true
                    }
                  }
                },
                {
                  name: 'AUTH_MICROSOFT_CLIENT_SECRET',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'backstage-auth-secrets',
                      key: 'microsoft-client-secret',
                      optional: true
                    }
                  }
                },
                {
                  name: 'AUTH_MICROSOFT_TENANT_ID',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'backstage-auth-secrets',
                      key: 'microsoft-tenant-id',
                      optional: true
                    }
                  }
                },
                {
                  name: 'AUTH_MICROSOFT_DOMAIN_HINT',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'backstage-auth-secrets',
                      key: 'microsoft-domain-hint',
                      optional: true
                    }
                  }
                },
                {
                  name: 'BACKEND_SECRET',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'backstage-auth-secrets',
                      key: 'backend-secret',
                      optional: true
                    }
                  }
                },
                {
                  name: 'ARGOCD_BASE_URL',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'backstage-argocd-secrets',
                      key: 'base-url',
                      optional: true
                    }
                  }
                },
                {
                  name: 'ARGOCD_AUTH_TOKEN',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'backstage-argocd-secrets',
                      key: 'auth-token',
                      optional: true
                    }
                  }
                },
                // Iframe domain configuration
                {
                  name: 'IFRAME_DOMAIN',
                  value: process.env.INGRESS_HOST || 'localtest.me'
                },
                // GitHub OAuth Integration
                {
                  name: 'AUTH_GITHUB_CLIENT_ID',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'backstage-github-oauth-secrets',
                      key: 'client-id',
                      optional: true
                    }
                  }
                },
                {
                  name: 'AUTH_GITHUB_CLIENT_SECRET',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'backstage-github-oauth-secrets',
                      key: 'client-secret',
                      optional: true
                    }
                  }
                },
                // ArgoCD Credentials
                {
                  name: 'ARGOCD_USERNAME',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'backstage-argocd-credentials',
                      key: 'username',
                      optional: true
                    }
                  }
                },
                {
                  name: 'ARGOCD_PASSWORD',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'backstage-argocd-credentials',
                      key: 'password',
                      optional: true
                    }
                  }
                },
                // GitHub App Integration environment variables
                {
                  name: 'AUTH_ORG_APP_ID',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'github-app-secrets',
                      key: 'app-id',
                      optional: true
                    }
                  }
                },
                {
                  name: 'AUTH_ORG_CLIENT_ID',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'github-app-secrets',
                      key: 'client-id',
                      optional: true
                    }
                  }
                },
                {
                  name: 'AUTH_ORG_CLIENT_SECRET',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'github-app-secrets',
                      key: 'client-secret',
                      optional: true
                    }
                  }
                },
                {
                  name: 'AUTH_ORG_WEBHOOK_SECRET',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'github-app-secrets',
                      key: 'webhook-secret',
                      optional: true
                    }
                  }
                },
                {
                  name: 'AUTH_ORG1_PRIVATE_KEY',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'github-app-secrets',
                      key: 'private-key',
                      optional: true
                    }
                  }
                },
                // GitHub Webhook Secret for Events
                {
                  name: 'GITHUB_WEBHOOK_SECRET',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'backstage-github-webhook-secret',
                      key: 'webhook-secret',
                      optional: false
                    }
                  }
                }
                // AKS environment variables removed - using in-cluster service account authentication
              ],
              resources: {
                requests: {
                  cpu: Quantity.fromString('200m'),
                  memory: Quantity.fromString('2Gi')  // Increased from 512Mi for yarn install
                },
                limits: {
                  cpu: Quantity.fromString('1000m'),
                  memory: Quantity.fromString('4Gi')  // Increased from 2Gi for development with DevSpace
                }
              },
              livenessProbe: {
                httpGet: {
                  path: '/healthcheck',
                  port: k8s.IntOrString.fromNumber(7007)
                },
                initialDelaySeconds: 60,
                periodSeconds: 30
              },
              readinessProbe: {
                httpGet: {
                  path: '/healthcheck',
                  port: k8s.IntOrString.fromNumber(7007)
                },
                initialDelaySeconds: 30,
                periodSeconds: 10
              }
            }],
            imagePullSecrets: [{
              name: 'ghcr-dockercfg'
            }]
          }
        }
      }
    });

    // Service
    const service = new k8s.KubeService(this, 'service', {
      metadata: {
        name: appName,
        namespace,
        labels: {
          'app.kubernetes.io/name': appName
        }
      },
      spec: {
        type: 'ClusterIP',
        selector: {
          'app.kubernetes.io/name': appName
        },
        ports: [{
          port: 80,
          targetPort: k8s.IntOrString.fromNumber(7007),
          protocol: 'TCP',
          name: 'http'
        }]
      }
    });

    // Ingress
    new k8s.KubeIngress(this, 'ingress', {
      metadata: {
        name: `${appName}-ingress`,
        namespace,
        annotations: {
          'nginx.ingress.kubernetes.io/proxy-body-size': '10m',
          'nginx.ingress.kubernetes.io/proxy-read-timeout': '600',
          'nginx.ingress.kubernetes.io/proxy-send-timeout': '600',
          'nginx.ingress.kubernetes.io/configuration-snippet': `
            more_clear_headers "Content-Security-Policy";
            more_clear_headers "Upgrade-Insecure-Requests";
            add_header Content-Security-Policy "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http: https:; frame-src 'self' http: https:; child-src 'self' http: https:; frame-ancestors 'self' http://localhost:* https://localhost:*;" always;
            add_header X-Content-Type-Options "nosniff" always;
            add_header X-Frame-Options "SAMEORIGIN" always;
          `,
          ...(enableTls && { 'cert-manager.io/cluster-issuer': process.env.CLUSTER_ISSUER || 'letsencrypt-prod' })
        }
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [{
          host: `backstage.${process.env.INGRESS_HOST || 'localtest.me'}`,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: service.name,
                  port: {
                    number: 80
                  }
                }
              }
            }]
          }
        }],
        ...(enableTls && {
          tls: [{
            hosts: [`backstage.${ingressHost}`],
            secretName: `${appName}-tls`
          }]
        })
      }
    });

    // NetworkPolicy
    new k8s.KubeNetworkPolicy(this, 'network-policy', {
      metadata: {
        name: `${appName}-network-policy`,
        namespace
      },
      spec: {
        podSelector: {
          matchLabels: {
            'app.kubernetes.io/name': appName
          }
        },
        policyTypes: ['Ingress', 'Egress'],
        ingress: [{
          from: [{
            namespaceSelector: {
              matchLabels: {
                'kubernetes.io/metadata.name': 'ingress-nginx'
              }
            }
          }],
          ports: [{
            port: k8s.IntOrString.fromNumber(7007),
            protocol: 'TCP'
          }]
        }],
        egress: [{
          // Allow all egress traffic
          ports: [],
          to: []
        }]
      }
    });
  }
}