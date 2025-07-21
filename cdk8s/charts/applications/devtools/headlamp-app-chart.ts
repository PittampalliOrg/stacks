import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';

/**
 * Creates ArgoCD Application for Headlamp Kubernetes Dashboard
 * 
 * Headlamp is an easy-to-use and extensible Kubernetes web UI that provides
 * a modern interface for managing Kubernetes resources.
 */
export class HeadlampAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Determine environment for conditional configuration
    const environment = process.env.ENVIRONMENT || 'dev';
    const isLocalDev = environment === 'dev';
    const ingressHost = process.env.INGRESS_HOST || 'localtest.me';

    // Deploy Headlamp via Helm
    this.createHelmApplication('headlamp', {
      chart: 'headlamp',
      helmRepoURL: 'https://kubernetes-sigs.github.io/headlamp/',
      helmVersion: '0.32.1', // Latest stable version
      helmReleaseName: 'headlamp',
      resourcePath: 'headlamp',
      namespace: 'monitoring', // Deploy with other monitoring/dashboard tools
      project: 'observability',
      syncWave: '55', // After core platform services, with other dev tools
      labels: {
        'app.kubernetes.io/component': 'dashboard',
        'app.kubernetes.io/part-of': 'headlamp',
        'app.kubernetes.io/name': 'headlamp',
        'app.kubernetes.io/managed-by': 'cdk8s'
      },
      syncOptions: [
        'CreateNamespace=true',
        'ServerSideApply=true'
      ],
      helmValues: {
        replicaCount: 1,
        image: {
          registry: 'ghcr.io',
          repository: 'headlamp-k8s/headlamp',
          pullPolicy: 'IfNotPresent'
        },
        serviceAccount: {
          create: true,
          name: 'headlamp'
        },
        service: {
          type: isLocalDev ? 'NodePort' : 'ClusterIP',
          port: 80,
          ...(isLocalDev && { nodePort: 30003 })
        },
        ingress: {
          enabled: !isLocalDev, // Disable ingress for local dev, use NodePort instead
          className: 'nginx',
          annotations: {
            'nginx.ingress.kubernetes.io/ssl-redirect': 'false'
          },
          hosts: [
            {
              host: `headlamp.${process.env.INGRESS_HOST || 'localtest.me'}`,
              paths: [
                {
                  path: '/',
                  type: 'Prefix'
                }
              ]
            }
          ]
        },
        resources: {
          requests: {
            cpu: '100m',
            memory: '128Mi'
          },
          limits: {
            cpu: '500m',
            memory: '512Mi'
          }
        },
        // Security context for the pod
        podSecurityContext: {
          runAsNonRoot: true,
          runAsUser: 100,
          fsGroup: 101
        },
        // Security context for the container
        securityContext: {
          allowPrivilegeEscalation: false,
          readOnlyRootFilesystem: false, // Headlamp needs write access for config and temp files
          runAsNonRoot: true,
          runAsUser: 100,
          capabilities: {
            drop: ['ALL']
          }
        },
        // Enable plugin auto-updates and OIDC configuration
        config: {
          pluginsDir: '/headlamp/plugins',
          watchPlugins: true,
          oidc: {
            externalSecret: {
              enabled: true,
              name: 'headlamp-auth-secrets'
            },
            issuerURL: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || '0c4da9c5-40ea-4e7d-9c7a-e7308d4f8e38'}/v2.0`,
            scopes: 'openid email profile',
            useAccessToken: true,
            redirectURL: isLocalDev 
              ? 'http://localhost:30003/oidc-callback'
              : `https://headlamp.${ingressHost}/oidc-callback`
          }
        },
        // Configure RBAC with appropriate permissions
        clusterRoleBinding: {
          create: true,
          clusterRoleName: 'cluster-admin' // For full dashboard functionality
        }
      },
      ignoreDifferences: [
        {
          group: 'apps',
          kind: 'Deployment',
          jsonPointers: [
            '/spec/replicas',
            '/spec/template/metadata/labels',
            '/spec/template/spec/containers/*/resources',
            '/spec/selector/matchLabels'
          ]
        },
        {
          group: '',
          kind: 'Service',
          jsonPointers: [
            '/spec/clusterIP',
            '/spec/clusterIPs',
            '/metadata/annotations'
          ]
        },
        {
          group: '',
          kind: 'ServiceAccount',
          jsonPointers: [
            '/metadata/annotations',
            '/secrets'
          ]
        }
      ]
    });
  }
}