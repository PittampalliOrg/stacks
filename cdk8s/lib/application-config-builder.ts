import { ApplicationConfig } from './idpbuilder-types';
import { buildDefaultSyncPolicy, defaultAppLabels } from './argocd-application-defaults';

/**
 * Draft-only helper to construct ApplicationConfig objects with
 * consistent defaults for Argo CD policy, labels, and annotations.
 * Not used by call sites yet. Intended for future migration of
 * cdk8s/config/applications.ts entries to reduce duplication.
 */

export interface MinimalAppConfigInput {
  name: string;
  namespace: string;
  chart: ApplicationConfig['chart'];
  dependencies?: ApplicationConfig['dependencies'];
  argocd?: ApplicationConfig['argocd'];
}

export function buildApplicationConfig(input: MinimalAppConfigInput): ApplicationConfig {
  const argocd = input.argocd ?? {};
  const labels = defaultAppLabels(argocd.labels);
  const syncPolicy = buildDefaultSyncPolicy(argocd.syncPolicy?.syncOptions ?? []);

  return {
    name: input.name,
    namespace: input.namespace,
    chart: input.chart,
    dependencies: input.dependencies,
    argocd: {
      ...argocd,
      labels,
      syncPolicy: {
        ...syncPolicy,
        // Allow caller overrides for prune/selfHeal/allowEmpty if needed
        automated: {
          prune: argocd.syncPolicy?.automated?.prune ?? syncPolicy.automated!.prune!,
          selfHeal: argocd.syncPolicy?.automated?.selfHeal ?? syncPolicy.automated!.selfHeal!,
          allowEmpty: argocd.syncPolicy?.automated?.allowEmpty ?? syncPolicy.automated!.allowEmpty!,
        },
      },
    },
  };
}

