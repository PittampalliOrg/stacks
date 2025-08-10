import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { KubeClusterRole, KubeClusterRoleBinding } from '../imports/k8s';

/**
 * RBAC for external-secrets to read vcluster secrets across namespaces
 * This enables GitOps-based vcluster registration
 */
export class VclusterRegistrationRbacChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    // ClusterRole to read vcluster secrets
    const clusterRole = new KubeClusterRole(this, 'external-secrets-vcluster-reader', {
      metadata: {
        name: 'external-secrets-vcluster-reader',
        labels: {
          'app.kubernetes.io/name': 'external-secrets-vcluster-reader',
          'app.kubernetes.io/part-of': 'vcluster-registration',
        },
      },
      rules: [
        {
          apiGroups: [''],
          resources: ['secrets'],
          verbs: ['get', 'list', 'watch'],
          // Limit to vcluster secrets
          resourceNames: [
            'vc-dev-vcluster-helm',
            'vc-staging-vcluster-helm',
          ],
        },
        {
          apiGroups: [''],
          resources: ['namespaces'],
          verbs: ['get', 'list'],
        },
      ],
    });

    // ClusterRoleBinding to grant permissions to external-secrets service account
    new KubeClusterRoleBinding(this, 'external-secrets-vcluster-reader-binding', {
      metadata: {
        name: 'external-secrets-vcluster-reader',
        labels: {
          'app.kubernetes.io/name': 'external-secrets-vcluster-reader',
          'app.kubernetes.io/part-of': 'vcluster-registration',
        },
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: clusterRole.name,
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'external-secrets',
          namespace: 'external-secrets',
        },
      ],
    });

    // Additional ClusterRole for broader secret access if needed
    const broadClusterRole = new KubeClusterRole(this, 'external-secrets-cluster-secret-reader', {
      metadata: {
        name: 'external-secrets-cluster-secret-reader',
        labels: {
          'app.kubernetes.io/name': 'external-secrets-cluster-secret-reader',
          'app.kubernetes.io/part-of': 'vcluster-registration',
        },
      },
      rules: [
        {
          apiGroups: [''],
          resources: ['secrets'],
          verbs: ['get', 'list', 'watch'],
          // Note: ClusterRole applies cluster-wide, can't restrict to namespaces here
          // External Secrets will be limited by the ClusterSecretStore configuration
        },
      ],
    });

    // Binding for broader access
    new KubeClusterRoleBinding(this, 'external-secrets-cluster-secret-reader-binding', {
      metadata: {
        name: 'external-secrets-cluster-secret-reader',
        labels: {
          'app.kubernetes.io/name': 'external-secrets-cluster-secret-reader',
          'app.kubernetes.io/part-of': 'vcluster-registration',
        },
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: broadClusterRole.name,
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'external-secrets',
          namespace: 'external-secrets',
        },
      ],
    });
  }
}