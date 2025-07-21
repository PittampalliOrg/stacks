import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

export interface PlatformCoreChartProps extends ChartProps {
  config?: {
    branch?: string;
    environment?: string;
    [key: string]: any;
  };
}

/**
 * Platform Core Chart - Essential platform resources
 * Includes namespaces, configmaps, and RBAC configuration
 * 
 * This chart manages ALL platform namespaces to avoid duplication
 * with static YAML files.
 */
export class PlatformCoreChart extends Chart {
  constructor(scope: Construct, id: string, props: PlatformCoreChartProps = {}) {
    super(scope, id, props);

    const config = props.config || {};
    const branch = config.branch || 'main';
    const environment = config.environment || 'dev';

    // Core namespaces with proper ordering
    // These are ALL the namespaces managed by CDK8s
    const namespaces = [
      // Removed argocd namespace - it's managed by ArgoCD installation itself
      // Having CDK8s manage the namespace ArgoCD runs in causes comparison errors
      { name: 'crossplane-system', wave: '-95' },
      { name: 'external-secrets', wave: '-95' },
      { name: 'azure-workload-identity-system', wave: '-95' },
      { name: 'cert-manager', wave: '-95' },
      { name: 'nextjs', wave: '-90' },
      { name: 'vcluster-dev', wave: '-85' },
      { name: 'monitoring', wave: '-80' },
      { name: 'argo', wave: '-80' },
      { name: 'kargo', wave: '-80' },
      { name: 'mcp-tools', wave: '-75' },
      { name: 'mcp-servers', wave: '-75' },
      { name: 'backstage', wave: '-70' },
      // Removed: 'agent-gateway' - deprecated in favor of kgateway
    ];

    // Create namespaces
    namespaces.forEach(ns => {
      const labels: { [key: string]: string } = {
        'app.kubernetes.io/managed-by': 'cdk8s',
        'app.kubernetes.io/part-of': 'platform-core',
        'app.kubernetes.io/instance': environment,
      };
      
      // Add Kargo project label for nextjs namespace
      if (ns.name === 'nextjs') {
        labels['kargo.akuity.io/project'] = 'true';
      }
      
      new k8s.KubeNamespace(this, `${ns.name}-namespace`, {
        metadata: {
          name: ns.name,
          labels: labels,
          annotations: {
            'argocd.argoproj.io/sync-wave': ns.wave,
          },
        },
      });
    });

    // Platform configuration ConfigMap
    new k8s.KubeConfigMap(this, 'platform-config', {
      metadata: {
        name: 'platform-config',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'app.kubernetes.io/part-of': 'platform-core',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-99',
        },
      },
      data: {
        branch: branch,
        environment: environment,
        repository: 'https://github.com/PittampalliOrg/cdk8s-project.git',
        'argocd-namespace': 'argocd',
        'cluster-name': 'in-cluster',
      },
    });

    // Branch-specific configuration
    new k8s.KubeConfigMap(this, 'branch-config', {
      metadata: {
        name: 'branch-config',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'app.kubernetes.io/part-of': 'platform-core',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-99',
        },
      },
      data: {
        BRANCH: branch,
        TARGET_REVISION: branch,
        APP_PREFIX: branch === 'main' ? '' : `${branch}-`,
      },
    });

    // ArgoCD RBAC resources (ClusterRole and ClusterRoleBinding) are now managed
    // in argocd-config-chart.ts to prevent circular dependencies and UI crashes 
    // during CDK8s hard refresh operations

    // Create shared ClusterRole for flagd-ui-nextjs (used by all environment deployments)
    // This prevents conflicts when multiple environment apps try to create the same ClusterRole
    const flagdUiClusterRole = new k8s.KubeClusterRole(this, 'flagd-ui-nextjs-cluster-role', {
      metadata: {
        name: 'flagd-ui-nextjs-editor',
        labels: {
          'app.kubernetes.io/name': 'flagd-ui-nextjs',
          'app.kubernetes.io/component': 'ui',
          'app.kubernetes.io/managed-by': 'cdk8s',
          'app.kubernetes.io/part-of': 'platform-core',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-90',
        },
      },
      rules: [{
        apiGroups: ['core.openfeature.dev'],
        resources: ['featureflags'],
        verbs: ['get', 'list', 'watch', 'update', 'patch'],
      }],
    });

    // Note: The ClusterRoleBinding is created per-environment in the flagd-ui-nextjs-chart
    // to bind to the namespace-specific ServiceAccount

    // ArgoCD Server Ingress
    // Moved from bootstrap to CDK8s for declarative management
    // Uses a low sync wave to ensure it's created early after nginx-ingress is ready
    new k8s.KubeIngress(this, 'argocd-server-ingress', {
      metadata: {
        name: 'argocd-server-ingress',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/component': 'server',
          'app.kubernetes.io/name': 'argocd-server',
          'app.kubernetes.io/part-of': 'argocd',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-85', // Early in the process
          // Disable SSL redirect for local development
          'nginx.ingress.kubernetes.io/ssl-redirect': 'false',
          'nginx.ingress.kubernetes.io/force-ssl-redirect': 'false',
          // ArgoCD server uses HTTP internally
          'nginx.ingress.kubernetes.io/backend-protocol': 'HTTP',
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [{
          host: `argocd.${process.env.INGRESS_HOST || 'localtest.me'}`,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: 'argocd-server',
                  port: {
                    number: 80,
                  },
                },
              },
            }],
          },
        }],
      },
    });
  }
}