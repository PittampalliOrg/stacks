import { ApplicationSpecSyncPolicy } from '../imports/argoproj.io';

/**
 * Common Argo CD Application defaults and small helpers.
 * This module is draft-only and not referenced yet. It is intended to
 * centralize default sync policies, options, labels, and annotations so
 * that Applications are created consistently across charts.
 */

/** Default sync options applied to most Applications */
export const DEFAULT_SYNC_OPTIONS: string[] = [
  'CreateNamespace=true',
  'ServerSideApply=true',
  'ApplyOutOfSyncOnly=false',
];

/**
 * Build a default sync policy with retries and SSA enabled.
 */
export function buildDefaultSyncPolicy(
  extraOptions: string[] = []
): ApplicationSpecSyncPolicy {
  const syncOptions = [...new Set([...DEFAULT_SYNC_OPTIONS, ...extraOptions])];
  return {
    automated: {
      prune: true,
      selfHeal: true,
      allowEmpty: false,
    },
    syncOptions,
    retry: {
      limit: 5,
      backoff: {
        duration: '10s',
        factor: 2,
        maxDuration: '3m',
      },
    },
  } as ApplicationSpecSyncPolicy;
}

/**
 * Merge a provided policy with defaults, preserving provided fields.
 */
export function mergeSyncPolicy(
  base: ApplicationSpecSyncPolicy | undefined,
  extraOptions: string[] = []
): ApplicationSpecSyncPolicy {
  const def = buildDefaultSyncPolicy(extraOptions);
  if (!base) return def;
  return {
    automated: {
      prune: base.automated?.prune ?? def.automated!.prune!,
      selfHeal: base.automated?.selfHeal ?? def.automated!.selfHeal!,
      allowEmpty: base.automated?.allowEmpty ?? def.automated!.allowEmpty!,
    },
    syncOptions: [...new Set([...(base.syncOptions ?? []), ...(def.syncOptions ?? [])])],
    retry: base.retry ?? def.retry,
  } as ApplicationSpecSyncPolicy;
}

/**
 * Build standard labels for Applications.
 */
export function defaultAppLabels(overrides?: Record<string, string>): Record<string, string> {
  return {
    'app.kubernetes.io/managed-by': 'cdk8s',
    'app.kubernetes.io/part-of': 'platform',
    ...overrides,
  };
}

/**
 * Add/merge a sync-wave annotation value into an annotations map.
 */
export function withSyncWave(
  annotations: Record<string, string> | undefined,
  wave?: string
): Record<string, string> | undefined {
  if (!wave) return annotations;
  return { ...(annotations ?? {}), 'argocd.argoproj.io/sync-wave': wave };
}
