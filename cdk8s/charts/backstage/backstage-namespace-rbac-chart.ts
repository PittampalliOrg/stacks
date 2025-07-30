import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../../imports/k8s';

/**
 * Chart that creates the Backstage namespace and RBAC resources
 */
export class BackstageNamespaceRbacChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    // Namespace
    new k8s.KubeNamespace(this, 'namespace', {
      metadata: {
        name: 'backstage'
      }
    });

    // ServiceAccount
    new k8s.KubeServiceAccount(this, 'service-account', {
      metadata: {
        name: 'backstage',
        namespace: 'backstage'
      }
    });

    // ClusterRole for Argo Workflows
    new k8s.KubeClusterRole(this, 'argo-workflows-role', {
      metadata: {
        name: 'backstage-argo-worfklows' // Note: keeping the typo from original
      },
      rules: [
        {
          apiGroups: ['argoproj.io'],
          resources: ['workflows'],
          verbs: ['create']
        }
      ]
    });

    // ClusterRole for read-all access
    new k8s.KubeClusterRole(this, 'read-all-role', {
      metadata: {
        name: 'read-all'
      },
      rules: [
        {
          apiGroups: ['*'],
          resources: ['*'],
          verbs: ['get', 'list', 'watch']
        }
      ]
    });

    // ClusterRoleBinding for Argo Workflows
    new k8s.KubeClusterRoleBinding(this, 'argo-workflows-binding', {
      metadata: {
        name: 'backstage-argo-worfklows' // Note: keeping the typo from original
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: 'backstage-argo-worfklows'
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'backstage',
          namespace: 'backstage'
        }
      ]
    });

    // ClusterRoleBinding for read-all access
    new k8s.KubeClusterRoleBinding(this, 'read-all-binding', {
      metadata: {
        name: 'backstage-read-all'
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: 'read-all'
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'backstage',
          namespace: 'backstage'
        }
      ]
    });
  }
}