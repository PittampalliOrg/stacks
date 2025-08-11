/**
 * Small parity-safe builders for Argo CD sync policies used in applications.ts
 * They return plain objects shaped exactly like the config expects.
 */

export interface SyncRetryBackoff {
  duration?: string;
  factor?: number;
  maxDuration?: string;
}

export interface SyncRetry {
  limit?: number;
  backoff?: SyncRetryBackoff;
}

export interface SyncPolicyShape {
  automated?: {
    prune?: boolean;
    selfHeal?: boolean;
    allowEmpty?: boolean;
  };
  syncOptions?: string[];
  retry?: SyncRetry;
}

export function automatedSyncWithOptions(options: string[], retry?: SyncRetry): SyncPolicyShape {
  return {
    automated: { prune: true, selfHeal: true },
    syncOptions: options,
    ...(retry ? { retry } : {}),
  };
}

