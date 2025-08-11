import { Construct } from 'constructs';
import * as eso from '../imports/external-secrets.io';
import { ExternalSecretSpecSecretStoreRefKind, ExternalSecretSpecTargetCreationPolicy, ExternalSecretSpecTargetTemplateEngineVersion, ExternalSecretSpecTargetTemplateMergePolicy, ExternalSecretSpecTargetDeletionPolicy, ExternalSecretSpecDataFrom } from '../imports/external-secrets.io';

/**
 * Draft helper utilities for common ExternalSecret patterns.
 * Not used yet; intended to reduce duplication and improve type-safety
 * across charts that create ESO resources.
 */

export interface DockerConfigJsonSecretParams {
  name: string;              // resulting Secret name
  namespace: string;
  secretStoreRef?: { name: string; kind?: ExternalSecretSpecSecretStoreRefKind };
  registry: string;          // e.g., 'ghcr.io'
  usernameKey?: string;      // AKV key for username (or omit if static)
  passwordKey: string;       // AKV key for token/password
  usernameTemplate?: string; // optional static username
  refreshInterval?: string;  // e.g., '1h'
  externalName?: string;     // override ExternalSecret metadata.name; default: `${name}-external`
  creationPolicy?: ExternalSecretSpecTargetCreationPolicy;
  engineVersion?: ExternalSecretSpecTargetTemplateEngineVersion;
  deletionPolicy?: ExternalSecretSpecTargetDeletionPolicy;
}

export function createDockerConfigJsonExternalSecret(
  scope: Construct,
  id: string,
  params: DockerConfigJsonSecretParams
): eso.ExternalSecret {
  const usernameField = params.usernameTemplate ? `"${params.usernameTemplate}"` : '"{{ .username }}"';
  const passwordField = '"{{ .password }}"';
  const authField = params.usernameTemplate
    ? `"{{ printf \"%s:%s\" \"${params.usernameTemplate}\" .password | b64enc }}"`
    : '"{{ printf \"%s:%s\" .username .password | b64enc }}"';
  const dockerconfig = `{
    "auths": {
      "${params.registry}": {
        "username": ${usernameField},
        "password": ${passwordField},
        "auth": ${authField}
      }
    }
  }`;

  const dataEntries: eso.ExternalSecretSpecData[] = [];
  if (!params.usernameTemplate && params.usernameKey) {
    dataEntries.push({ secretKey: 'username', remoteRef: { key: params.usernameKey } });
  }
  dataEntries.push({ secretKey: 'password', remoteRef: { key: params.passwordKey } });

  return new eso.ExternalSecret(scope, id, {
    metadata: { name: params.externalName ?? `${params.name}-external`, namespace: params.namespace },
    spec: {
      refreshInterval: params.refreshInterval ?? '1h',
      secretStoreRef: params.secretStoreRef ?? { name: 'azure-keyvault-store', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      target: {
        name: params.name,
        template: {
          type: 'kubernetes.io/dockerconfigjson',
          engineVersion: params.engineVersion,
          data: { '.dockerconfigjson': dockerconfig },
        },
        creationPolicy: params.creationPolicy,
        deletionPolicy: params.deletionPolicy,
      },
      data: dataEntries,
    },
  });
}

type MappingSimple = { key: string; remote: string };
type MappingAdvanced = { key: string; remoteRef: { key: string; property?: string } };

export interface EnvSecretParams {
  name: string;
  namespace: string;
  mappings: Array<MappingSimple | MappingAdvanced>;
  templateData?: Record<string, string>; // optional direct template entries
  refreshInterval?: string;
  secretStoreRef?: { name: string; kind?: ExternalSecretSpecSecretStoreRefKind };
  externalName?: string;     // override ExternalSecret metadata.name; default: `${name}-external`
  creationPolicy?: ExternalSecretSpecTargetCreationPolicy;
  engineVersion?: ExternalSecretSpecTargetTemplateEngineVersion;
  mergePolicy?: ExternalSecretSpecTargetTemplateMergePolicy;
  templateType?: string;     // target.template.type (e.g., 'Opaque')
  templateMetadata?: Record<string, any>; // target.template.metadata
  deletionPolicy?: ExternalSecretSpecTargetDeletionPolicy;
  dataFrom?: ExternalSecretSpecDataFrom[];
}

export function createEnvExternalSecret(
  scope: Construct,
  id: string,
  params: EnvSecretParams
): eso.ExternalSecret {
  const data: Record<string, string> = { ...(params.templateData ?? {}) };
  for (const m of params.mappings) data[m.key] = data[m.key] ?? `{{ .${m.key} }}`;

  return new eso.ExternalSecret(scope, id, {
    metadata: { name: params.externalName ?? `${params.name}-external`, namespace: params.namespace },
    spec: {
      refreshInterval: params.refreshInterval ?? '1h',
      secretStoreRef: params.secretStoreRef ?? { name: 'azure-keyvault-store', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      target: { name: params.name, creationPolicy: params.creationPolicy, template: { type: params.templateType, metadata: params.templateMetadata, engineVersion: params.engineVersion, mergePolicy: params.mergePolicy, data } },
      // @ts-ignore deletionPolicy supported in schema
      target: { name: params.name, creationPolicy: params.creationPolicy, deletionPolicy: params.deletionPolicy, template: { type: params.templateType, metadata: params.templateMetadata, engineVersion: params.engineVersion, mergePolicy: params.mergePolicy, data } },
      dataFrom: params.dataFrom,
      data: params.mappings.map((m) => {
        if ((m as MappingAdvanced).remoteRef) {
          const adv = m as MappingAdvanced;
          return { secretKey: adv.key, remoteRef: { key: adv.remoteRef.key, property: adv.remoteRef.property } } as eso.ExternalSecretSpecData;
        }
        const simple = m as MappingSimple;
        return { secretKey: simple.key, remoteRef: { key: simple.remote } } as eso.ExternalSecretSpecData;
      }),
    },
  });
}

export interface TlsSecretParams {
  name: string;
  namespace: string;
  certKeyName: string; // AKV key for cert
  keyKeyName: string;  // AKV key for private key
  refreshInterval?: string;
  secretStoreRef?: { name: string; kind?: ExternalSecretSpecSecretStoreRefKind };
  externalName?: string;     // override ExternalSecret metadata.name; default: `${name}-external`
  creationPolicy?: ExternalSecretSpecTargetCreationPolicy;
}

export function createTlsExternalSecret(
  scope: Construct,
  id: string,
  params: TlsSecretParams
): eso.ExternalSecret {
  return new eso.ExternalSecret(scope, id, {
    metadata: { name: params.externalName ?? `${params.name}-external`, namespace: params.namespace },
    spec: {
      refreshInterval: params.refreshInterval ?? '1h',
      secretStoreRef: params.secretStoreRef ?? { name: 'azure-keyvault-store', kind: ExternalSecretSpecSecretStoreRefKind.CLUSTER_SECRET_STORE },
      target: {
        name: params.name,
        creationPolicy: params.creationPolicy,
        template: {
          type: 'kubernetes.io/tls',
          data: { 'tls.crt': '{{ .cert }}', 'tls.key': '{{ .key }}' },
        },
      },
      data: [
        { secretKey: 'cert', remoteRef: { key: params.certKeyName } },
        { secretKey: 'key', remoteRef: { key: params.keyKeyName } },
      ],
    },
  });
}
