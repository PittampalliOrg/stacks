import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

export interface PipelineGitPromoterOptions {
  appName: string; // e.g., 'nextjs' | 'backstage'
  namespace?: string; // default: 'kargo-pipelines'
  labels?: Record<string, string>;
}

/**
 * Creates a ServiceAccount and RoleBinding for a Kargo pipeline to perform
 * Git operations, binding to the shared Role 'kargo-git-promoter' within the
 * kargo-pipelines namespace.
 */
export function createPipelineGitPromoter(
  scope: Construct,
  id: string,
  options: PipelineGitPromoterOptions
): void {
  const ns = options.namespace ?? 'kargo-pipelines';
  const saName = `kargo-${options.appName}-git`;

  const labels = {
    'app.kubernetes.io/name': saName,
    'app.kubernetes.io/part-of': 'kargo-pipelines',
    'app.kubernetes.io/component': 'serviceaccount',
    ...(options.labels ?? {}),
  };

  new k8s.KubeServiceAccount(scope, `${id}-sa`, {
    metadata: {
      name: saName,
      namespace: ns,
      labels,
    },
  });

  new k8s.KubeRoleBinding(scope, `${id}-rb`, {
    metadata: {
      name: `${saName}-promoter`,
      namespace: ns,
    },
    roleRef: {
      apiGroup: 'rbac.authorization.k8s.io',
      kind: 'Role',
      name: 'kargo-git-promoter',
    },
    subjects: [
      { kind: 'ServiceAccount', name: saName, namespace: ns },
    ],
  });
}

