import { Chart, ChartProps, JsonPatch } from 'cdk8s';
import { Construct } from 'constructs';
import * as argo from '@opencdk8s/cdk8s-argocd-resources';

/**
 * Creates ArgoCD AppProjects for different application categories
 * This provides RBAC and isolation between different types of applications
 */
export class AppProjectsChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    // Platform Project - for core infrastructure
    const platformProject = new argo.ArgoCdProject(this, 'platform-project', {
      metadata: {
        name: 'platform',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-200' // Very early
        }
      },
      spec: {
        description: 'Core platform infrastructure components',
        sourceRepos: [
          'https://github.com/PittampalliOrg/cdk8s-project.git',
          'https://charts.jetstack.io',
          'https://azure.github.io/azure-workload-identity/charts',
          'https://charts.external-secrets.io',
          'https://argoproj.github.io/argo-helm',
          'https://github.com/kubernetes-sigs/gateway-api',
          'https://open-feature.github.io/open-feature-operator',
          'ghcr.io/akuity/kargo-charts',
          'ghcr.io/terasky-oss/kubernetes-dependecy-tracker'
        ],
        destination: [{
          server: 'https://kubernetes.default.svc',
          namespace: '*'
        }],
        clusterResourceWhiteList: [{
          group: '*',
          kind: '*'
        }],
        namespaceResourceWhitelist: [{
          group: '*',
          kind: '*'
        }],
        roles: [{
          name: 'admin',
          description: 'Admin access to platform project',
          policies: [
            'p, proj:platform:admin, applications, *, platform/*, allow',
            'p, proj:platform:admin, repositories, *, *, allow'
          ],
          groups: ['argocd-admins']
        }]
      }
    });

    // Fix CDK8s ArgoCD library bugs for ArgoCD v3 compatibility
    platformProject.addJsonPatch(
      JsonPatch.move('/spec/clusterResourceWhiteList', '/spec/clusterResourceWhitelist')
    );
    platformProject.addJsonPatch(
      JsonPatch.move('/spec/destination', '/spec/destinations')
    );

    // Observability Project - for monitoring and logging
    const observabilityProject = new argo.ArgoCdProject(this, 'observability-project', {
      metadata: {
        name: 'observability',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-190'
        }
      },
      spec: {
        description: 'Observability stack including monitoring, logging, and tracing',
        sourceRepos: [
          'https://github.com/PittampalliOrg/cdk8s-project.git',
          'https://grafana.github.io/helm-charts',
          'https://github.com/grafana/helm-charts',
          'https://kubernetes-sigs.github.io/headlamp/'
        ],
        destination: [{
          server: 'https://kubernetes.default.svc',
          namespace: 'monitoring'
        }, {
          server: 'https://kubernetes.default.svc',
          namespace: 'observability'
        }, {
          server: 'https://kubernetes.default.svc',
          namespace: 'mcp-servers'
        }, {
          server: 'https://kubernetes.default.svc',
          namespace: 'nextjs'
        }],
        namespaceResourceWhitelist: [{
          group: '*',
          kind: '*'
        }],
        // Allow ClusterRole and ClusterRoleBinding for Prometheus
        clusterResourceWhiteList: [{
          group: 'rbac.authorization.k8s.io',
          kind: 'ClusterRole'
        }, {
          group: 'rbac.authorization.k8s.io',
          kind: 'ClusterRoleBinding'
        }],
        roles: [{
          name: 'viewer',
          description: 'Read-only access to observability apps',
          policies: [
            'p, proj:observability:viewer, applications, get, observability/*, allow'
          ],
          groups: ['developers']
        }]
      }
    });

    // Fix destination field name and clusterResourceWhiteList
    observabilityProject.addJsonPatch(
      JsonPatch.move('/spec/destination', '/spec/destinations')
    );
    observabilityProject.addJsonPatch(
      JsonPatch.move('/spec/clusterResourceWhiteList', '/spec/clusterResourceWhitelist')
    );

    // AI Platform Project - for Kagent and MCP components
    const aiPlatformProject = new argo.ArgoCdProject(this, 'ai-platform-project', {
      metadata: {
        name: 'ai-platform',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-180'
        }
      },
      spec: {
        description: 'AI platform components including Kagent agents and MCP servers',
        sourceRepos: [
          'https://github.com/PittampalliOrg/cdk8s-project.git',
          'https://github.com/kagent-dev/kagent.git',
          'ghcr.io/kagent-dev/kagent/helm',
          'cr.kgateway.dev/kgateway-dev/charts'
        ],
        destination: [{
          server: 'https://kubernetes.default.svc',
          namespace: 'kagent'
        }, {
          server: 'https://kubernetes.default.svc',
          namespace: 'kgateway-system'
        }, {
          server: 'https://kubernetes.default.svc',
          namespace: 'mcp-servers'
        }, {
          server: 'https://kubernetes.default.svc',
          namespace: 'mcp-tools'
        }, {
          server: 'https://kubernetes.default.svc',
          namespace: 'ollama'
        }],
        namespaceResourceWhitelist: [{
          group: '*',
          kind: '*'
        }],
        // Allow CRDs for AI resources
        clusterResourceWhiteList: [{
          group: 'apiextensions.k8s.io',
          kind: 'CustomResourceDefinition'
        }, {
          group: 'rbac.authorization.k8s.io',
          kind: 'ClusterRole'
        }, {
          group: 'rbac.authorization.k8s.io',
          kind: 'ClusterRoleBinding'
        }, {
          group: 'kagent.dev',
          kind: '*'
        }, {
          group: 'gateway.kgateway.dev',
          kind: '*'
        }, {
          group: 'gateway.networking.k8s.io',
          kind: 'GatewayClass'
        }, {
          group: '',
          kind: 'Namespace'
        }]
      }
    });

    // Fix CDK8s ArgoCD library bugs
    aiPlatformProject.addJsonPatch(
      JsonPatch.move('/spec/clusterResourceWhiteList', '/spec/clusterResourceWhitelist')
    );
    aiPlatformProject.addJsonPatch(
      JsonPatch.move('/spec/destination', '/spec/destinations')
    );

    // Applications Project - for user applications
    const applicationsProject = new argo.ArgoCdProject(this, 'applications-project', {
      metadata: {
        name: 'applications',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-170'
        }
      },
      spec: {
        description: 'User applications and services',
        sourceRepos: [
          'https://github.com/PittampalliOrg/cdk8s-project.git'
        ],
        destination: [{
          server: 'https://kubernetes.default.svc',
          namespace: 'nextjs'
        }, {
          server: 'https://kubernetes.default.svc',
          namespace: 'default'
        }],
        namespaceResourceWhitelist: [{
          group: '*',
          kind: '*'
        }],
        // Block access to sensitive resources
        namespaceResourceBlacklist: [{
          group: '',
          kind: 'Secret'
        }, {
          group: 'external-secrets.io',
          kind: 'ExternalSecret'
        }],
        roles: [{
          name: 'developer',
          description: 'Developer access to applications',
          policies: [
            'p, proj:applications:developer, applications, *, applications/*, allow',
            'p, proj:applications:developer, logs, get, applications/*, allow',
            'p, proj:applications:developer, exec, create, applications/*, allow'
          ],
          groups: ['developers']
        }]
      }
    });

    // Fix destination field name
    applicationsProject.addJsonPatch(
      JsonPatch.move('/spec/destination', '/spec/destinations')
    );

    // Development Tools Project - for CI/CD and developer tools
    const devtoolsProject = new argo.ArgoCdProject(this, 'devtools-project', {
      metadata: {
        name: 'devtools',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-160'
        }
      },
      spec: {
        description: 'Development tools including Argo Workflows, Kargo, and vCluster',
        sourceRepos: [
          'https://github.com/PittampalliOrg/cdk8s-project.git',
          'https://argoproj.github.io/argo-helm',
          'https://charts.loft.sh',
          'ghcr.io/akuity/kargo-charts'
        ],
        destination: [{
          server: 'https://kubernetes.default.svc',
          namespace: 'argo'
        }, {
          server: 'https://kubernetes.default.svc',
          namespace: 'kargo'
        }, {
          server: 'https://kubernetes.default.svc',
          namespace: 'vcluster-*'
        }, {
          server: 'https://kubernetes.default.svc',
          namespace: 'argocd'
        }, {
          server: 'https://kubernetes.default.svc',
          namespace: 'nextjs'
        }],
        namespaceResourceWhitelist: [{
          group: '*',
          kind: '*'
        }],
        // Allow ApplicationSets for vCluster and ClusterWorkflowTemplates for Argo Workflows
        clusterResourceWhiteList: [{
          group: 'argoproj.io',
          kind: 'ApplicationSet'
        }, {
          group: 'argoproj.io',
          kind: 'ClusterWorkflowTemplate'
        }, {
          group: 'kargo.akuity.io',
          kind: 'Project'
        }, {
          group: 'rbac.authorization.k8s.io',
          kind: 'ClusterRole'
        }, {
          group: 'rbac.authorization.k8s.io',
          kind: 'ClusterRoleBinding'
        }]
      }
    });

    // Fix CDK8s ArgoCD library bugs
    devtoolsProject.addJsonPatch(
      JsonPatch.move('/spec/clusterResourceWhiteList', '/spec/clusterResourceWhitelist')
    );
    devtoolsProject.addJsonPatch(
      JsonPatch.move('/spec/destination', '/spec/destinations')
    );
  }
}