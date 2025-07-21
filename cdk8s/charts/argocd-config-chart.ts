import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

export interface ArgoCDConfigChartProps extends ChartProps {}

/**
 * ArgoCD Configuration Chart
 * Manages all ArgoCD configuration including ConfigMaps, Secrets, and RBAC
 * Replaces imperative configuration from Makefile
 */
export class ArgoCDConfigChart extends Chart {
  constructor(scope: Construct, id: string, props: ArgoCDConfigChartProps = {}) {
    super(scope, id, props);

    // ArgoCD namespace - not created here as it's managed by ArgoCD installation
    const namespace = 'argocd';

    // ArgoCD CM - Main configuration
    new k8s.KubeConfigMap(this, 'argocd-cm', {
      metadata: {
        name: 'argocd-cm',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'argocd-cm',
          'app.kubernetes.io/part-of': 'argocd',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-95',
        },
      },
      data: {
        // Enable web-based terminal feature
        'exec.enabled': 'true',
        'exec.shells': 'bash,sh',
        // ArgoCD v3.0 specific RBAC settings
        'server.rbac.disableApplicationFineGrainedRBACInheritance': 'false',
        // ArgoCD configuration
        'application.instanceLabelKey': 'argocd.argoproj.io/instance',
        'timeout.reconciliation': '180s',
        'url': `http://argocd.${process.env.INGRESS_HOST || 'localtest.me'}`,
        // Account configuration
        'accounts.backstage': 'apiKey',
        'accounts.backstage.enabled': 'true',
        // Health checks for External Secrets
        'resource.customizations.health.external-secrets.io_ClusterSecretStore': `
hs = {}
if obj.status ~= nil then
  if obj.status.conditions ~= nil then
    for i, condition in ipairs(obj.status.conditions) do
      if condition.type == "Ready" then
        if condition.status == "True" then
          hs.status = "Healthy"
          hs.message = condition.message
          return hs
        else
          hs.status = "Degraded"
          hs.message = condition.message
          return hs
        end
      end
    end
  end
end
hs.status = "Progressing"
hs.message = "Waiting for ClusterSecretStore to be ready"
return hs`,
        'resource.customizations.health.external-secrets.io_ExternalSecret': `
hs = {}
if obj.status ~= nil then
  if obj.status.conditions ~= nil then
    for i, condition in ipairs(obj.status.conditions) do
      if condition.type == "Ready" then
        if condition.status == "True" then
          hs.status = "Healthy"
          hs.message = condition.message
          return hs
        else
          hs.status = "Degraded"
          hs.message = condition.message
          return hs
        end
      end
    end
  end
end
hs.status = "Progressing"
hs.message = "Waiting for ExternalSecret to be ready"
return hs`,
        'resource.customizations.health.external-secrets.io_SecretStore': `
hs = {}
if obj.status ~= nil then
  if obj.status.conditions ~= nil then
    for i, condition in ipairs(obj.status.conditions) do
      if condition.type == "Ready" then
        if condition.status == "True" then
          hs.status = "Healthy"
          hs.message = condition.message
          return hs
        else
          hs.status = "Degraded"
          hs.message = condition.message
          return hs
        end
      end
    end
  end
end
hs.status = "Progressing"
hs.message = "Waiting for SecretStore to be ready"
return hs`,
        // Progressive sync configuration
        'application.progressive.sync': 'true',
        'application.progressive.maxTargets': '5',
        'application.progressive.initialPause': '10s',
        'application.progressive.subsequentPause': '5s',
        // ExternalSecret ignore differences for CRD defaults
        'resource.customizations.ignoreDifferences.external-secrets.io_ExternalSecret': `
jqPathExpressions:
- .spec.data[].remoteRef.conversionStrategy
- .spec.data[].remoteRef.decodingStrategy
- .spec.data[].remoteRef.metadataPolicy
- .spec.dataFrom[].find.conversionStrategy
- .spec.dataFrom[].find.decodingStrategy
- .spec.dataFrom[].extract.conversionStrategy
- .spec.dataFrom[].extract.decodingStrategy
`,
      },
    });

    // ArgoCD RBAC CM - RBAC configuration
    new k8s.KubeConfigMap(this, 'argocd-rbac-cm', {
      metadata: {
        name: 'argocd-rbac-cm',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'argocd-rbac-cm',
          'app.kubernetes.io/part-of': 'argocd',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-95',
        },
      },
      data: {
        'policy.default': 'role:admin',
        'policy.csv': `
# Built-in admin policy - admin role has full access
p, role:admin, applications, *, */*, allow
p, role:admin, applicationsets, *, */*, allow
p, role:admin, clusters, *, *, allow
p, role:admin, repositories, *, *, allow
p, role:admin, certificates, *, *, allow
p, role:admin, projects, *, *, allow
p, role:admin, accounts, *, *, allow
p, role:admin, gpgkeys, *, *, allow
p, role:admin, exec, create, */*, allow
p, role:admin, extensions, invoke, *, allow

# Backstage account permissions
p, backstage, applications, get, */*, allow
p, backstage, applications, list, */*, allow
p, backstage, clusters, get, *, allow
p, backstage, clusters, list, *, allow
p, backstage, repositories, get, *, allow
p, backstage, repositories, list, *, allow
p, backstage, projects, get, *, allow
p, backstage, projects, list, *, allow

# Additional custom policies can be added below
`,
        'scopes': '[groups]',
      },
    });

    // ArgoCD CMD Params CM - Command parameters
    new k8s.KubeConfigMap(this, 'argocd-cmd-params-cm', {
      metadata: {
        name: 'argocd-cmd-params-cm',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'argocd-cmd-params-cm',
          'app.kubernetes.io/part-of': 'argocd',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-95',
        },
      },
      data: {
        // Enable insecure mode for local development
        'server.insecure': 'true',
        // Add Content Security Policy to allow iframe embedding from Backstage
        'server.content.security.policy': `frame-ancestors 'self' https://backstage.ai401kchat.com http://backstage.${process.env.INGRESS_HOST || 'localtest.me'} http://localhost:3000 http://localhost:7007 http://localhost:30009;`,
        // Disable X-Frame-Options header
        'server.x.frame.options': 'disabled',
        // Enable gRPC-Web for better API compatibility
        'server.grpc.web': 'true',
        // Disable auth for health endpoint to avoid issues with iframe health checks
        'server.disable.auth': 'false',
        // Set longer session duration for better iframe experience
        'server.login.attempts.expiration': '10m',
        // Enable CORS for cross-origin iframe access
        'server.cors.allowed.origins': 'http://localhost:7007,http://localhost:3000,http://backstage.localtest.me',
        'server.cors.allowed.headers': 'Content-Type,Authorization,Cookie',
        'server.cors.allow.credentials': 'true',
        // Configure session cookies for cross-origin access
        'server.session.cookie.samesite': 'None',
        'server.session.cookie.secure': 'false', // For local HTTP development
        'server.session.cookie.httponly': 'true',
        'server.session.cookie.domain': '.localtest.me', // Allow subdomain access
        // Extend session duration
        'server.session.maxage': '86400', // 24 hours
      },
    });

    // ArgoCD Secret - Admin password
    new k8s.KubeSecret(this, 'argocd-secret', {
      metadata: {
        name: 'argocd-secret',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'argocd-secret',
          'app.kubernetes.io/part-of': 'argocd',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-95',
        },
      },
      type: 'Opaque',
      stringData: {
        // Bcrypt hash for 'password' - generated by ArgoCD CLI
        'admin.password': '$2a$10$O15JfqgYYda/enZTZv2D7O4UkAY4NtlQtlBljaRTT64ZbIzqgVwP.',
        'admin.passwordMtime': '2024-01-01T00:00:00Z',
        // Server secret key for JWT signing - base64 encoded random 32 bytes
        'server.secretkey': 'RVJTTklhanNkZmFzZGZhc2RmYXNkZmFzZGZhc2RmYXNkZg==',
      },
    });

    // ArgoCD Initial Admin Secret - For UI display
    new k8s.KubeSecret(this, 'argocd-initial-admin-secret', {
      metadata: {
        name: 'argocd-initial-admin-secret',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'argocd-initial-admin-secret',
          'app.kubernetes.io/part-of': 'argocd',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-95',
        },
      },
      type: 'Opaque',
      stringData: {
        password: 'password',
      },
    });

    // Critical RBAC resources for ArgoCD operation
    // These are managed here instead of through ArgoCD to prevent circular dependencies
    const argocdServerClusterRole = new k8s.KubeClusterRole(this, 'argocd-server', {
      metadata: {
        name: 'argocd-server',
        labels: {
          'app.kubernetes.io/component': 'server',
          'app.kubernetes.io/name': 'argocd-server',
          'app.kubernetes.io/part-of': 'argocd',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-100',
        },
      },
      rules: [
        {
          apiGroups: ['*'],
          resources: ['*'],
          verbs: ['*'],
        },
        {
          nonResourceUrLs: ['*'],
          verbs: ['*'],
        },
      ],
    });

    new k8s.KubeClusterRoleBinding(this, 'argocd-server-binding', {
      metadata: {
        name: 'argocd-server',
        labels: {
          'app.kubernetes.io/component': 'server',
          'app.kubernetes.io/name': 'argocd-server',
          'app.kubernetes.io/part-of': 'argocd',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-100',
        },
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: argocdServerClusterRole.name,
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'argocd-server',
          namespace: 'argocd',
        },
      ],
    });

    const argocdAppControllerClusterRole = new k8s.KubeClusterRole(this, 'argocd-application-controller', {
      metadata: {
        name: 'argocd-application-controller',
        labels: {
          'app.kubernetes.io/component': 'application-controller',
          'app.kubernetes.io/name': 'argocd-application-controller',
          'app.kubernetes.io/part-of': 'argocd',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-100',
        },
      },
      rules: [
        {
          apiGroups: ['*'],
          resources: ['*'],
          verbs: ['*'],
        },
        {
          nonResourceUrLs: ['*'],
          verbs: ['*'],
        },
      ],
    });

    new k8s.KubeClusterRoleBinding(this, 'argocd-application-controller-binding', {
      metadata: {
        name: 'argocd-application-controller',
        labels: {
          'app.kubernetes.io/component': 'application-controller',
          'app.kubernetes.io/name': 'argocd-application-controller',
          'app.kubernetes.io/part-of': 'argocd',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-100',
        },
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: argocdAppControllerClusterRole.name,
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'argocd-application-controller',
          namespace: 'argocd',
        },
      ],
    });

    // In-cluster secret for ArgoCD to access the Kubernetes API
    new k8s.KubeSecret(this, 'cluster-in-cluster', {
      metadata: {
        name: 'cluster-in-cluster',
        namespace,
        labels: {
          'argocd.argoproj.io/secret-type': 'cluster',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-95',
        },
      },
      type: 'Opaque',
      stringData: {
        name: 'in-cluster',
        server: 'https://kubernetes.default.svc',
        config: JSON.stringify({
          tlsClientConfig: {
            insecure: false,
          },
        }),
      },
    });
  }
}