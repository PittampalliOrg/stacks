import { ApiObject, GroupVersionKind } from 'cdk8s';
import { Construct } from 'constructs';

/**
 * Configuration for CRD entity generation
 */
export interface CrdEntityConfig {
  /**
   * Human-readable description of the CRD
   */
  description: string;
  
  /**
   * Backstage system to associate with this CRD type
   */
  system: string;
  
  /**
   * Owner of resources of this type
   */
  owner?: string;
  
  /**
   * Tags to apply to the resource entity
   */
  tags?: string[];
  
  /**
   * Links related to this CRD type
   */
  links?: Array<{
    url: string;
    title: string;
    icon?: string;
  }>;
  
  /**
   * Additional annotations for the entity
   */
  annotations?: Record<string, string>;
}

/**
 * Maps CRD types to their Backstage entity configurations
 */
export interface CrdMappings {
  [crdKey: string]: CrdEntityConfig;
}

/**
 * Default CRD mappings for common CRD types
 */
export const DEFAULT_CRD_MAPPINGS: CrdMappings = {
  'argoproj.io/v1alpha1/Application': {
    description: 'ArgoCD Application for GitOps deployments',
    system: 'gitops-resources',
    owner: 'platform-team',
    tags: ['gitops', 'argocd', 'deployment'],
    links: [
      { url: 'https://argocd.localtest.me', title: 'ArgoCD UI', icon: 'dashboard' }
    ]
  },
  'cert-manager.io/v1/Certificate': {
    description: 'TLS Certificate managed by cert-manager',
    system: 'security-resources',
    owner: 'platform-team',
    tags: ['security', 'tls', 'certificate'],
    links: [
      { url: 'https://cert-manager.io/docs/', title: 'Cert-Manager Docs', icon: 'docs' }
    ]
  },
  'cert-manager.io/v1/ClusterIssuer': {
    description: 'Cluster-wide certificate issuer',
    system: 'security-resources',
    owner: 'platform-team',
    tags: ['security', 'tls', 'issuer'],
    links: [
      { url: 'https://cert-manager.io/docs/', title: 'Cert-Manager Docs', icon: 'docs' }
    ]
  },
  'kargo.akuity.io/v1alpha1/Warehouse': {
    description: 'Kargo Warehouse for freight management',
    system: 'delivery-resources',
    owner: 'platform-team',
    tags: ['delivery', 'kargo', 'freight'],
    links: [
      { url: 'https://kargo.akuity.io/', title: 'Kargo Dashboard', icon: 'dashboard' }
    ]
  },
  'kargo.akuity.io/v1alpha1/Stage': {
    description: 'Kargo Stage for progressive delivery',
    system: 'delivery-resources',
    owner: 'platform-team',
    tags: ['delivery', 'kargo', 'stage'],
    links: [
      { url: 'https://kargo.akuity.io/', title: 'Kargo Dashboard', icon: 'dashboard' }
    ]
  },
  'kargo.akuity.io/v1alpha1/Project': {
    description: 'Kargo Project for delivery pipelines',
    system: 'delivery-resources',
    owner: 'platform-team',
    tags: ['delivery', 'kargo', 'project']
  },
  'external-secrets.io/v1beta1/ExternalSecret': {
    description: 'External secret synchronization resource',
    system: 'security-resources',
    owner: 'platform-team',
    tags: ['security', 'secrets', 'external-secrets']
  },
  'kagent.dev/v1alpha1/Agent': {
    description: 'Kagent AI agent configuration',
    system: 'ai-resources',
    owner: 'platform-team',
    tags: ['ai', 'kagent', 'agent']
  },
  'kagent.dev/v1alpha1/ModelConfig': {
    description: 'Kagent model configuration',
    system: 'ai-resources',
    owner: 'platform-team',
    tags: ['ai', 'kagent', 'model']
  }
};

/**
 * Generator for creating Backstage Resource entities from CRD definitions
 */
export class BackstageCrdEntityGenerator {
  private crdMappings: CrdMappings;
  private generatedSystems: Set<string> = new Set();

  constructor(private scope: Construct, customMappings?: Record<string, Partial<CrdEntityConfig>>) {
    // Merge default mappings with custom mappings, ensuring all required fields are present
    this.crdMappings = { ...DEFAULT_CRD_MAPPINGS };
    
    if (customMappings) {
      Object.entries(customMappings).forEach(([key, customConfig]) => {
        if (this.crdMappings[key]) {
          // Merge with existing config
          this.crdMappings[key] = {
            ...this.crdMappings[key],
            ...customConfig
          } as CrdEntityConfig;
        } else if (customConfig.description && customConfig.system) {
          // Create new config if minimum required fields are present
          this.crdMappings[key] = customConfig as CrdEntityConfig;
        }
      });
    }
  }

  /**
   * Generate a Backstage Resource entity for a CRD type
   */
  public generateCrdEntity(
    crdClass: any,
    customConfig?: Partial<CrdEntityConfig>
  ): ApiObject | null {
    // Extract GVK from the CRD class
    const gvk = this.extractGvk(crdClass);
    if (!gvk) {
      console.warn(`Could not extract GVK from CRD class: ${crdClass.name}`);
      return null;
    }

    // Create a key for looking up the configuration
    const crdKey = `${gvk.apiVersion}/${gvk.kind}`;
    
    // Get the configuration for this CRD type
    const baseConfig = this.crdMappings[crdKey];
    if (!baseConfig && !customConfig) {
      console.warn(`No configuration found for CRD: ${crdKey}`);
      return null;
    }

    // Merge configurations
    const config: CrdEntityConfig = {
      ...baseConfig,
      ...customConfig
    } as CrdEntityConfig;

    // Generate entity name from GVK
    const entityName = this.generateEntityName(gvk);

    // Build annotations
    const annotations: Record<string, string> = {
      'backstage.io/kubernetes-api-version': gvk.apiVersion,
      'backstage.io/kubernetes-kind': gvk.kind,
      'backstage.io/kubernetes-label-selector': `crd-type=${gvk.kind.toLowerCase()}`,
      ...config.annotations
    };

    // Create the Resource entity
    const entity = new ApiObject(this.scope, `crd-resource-${entityName}`, {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Resource',
      metadata: {
        name: entityName,
        description: config.description,
        annotations,
        tags: config.tags,
        links: config.links
      },
      spec: {
        type: 'kubernetes-resource',
        lifecycle: 'production',
        owner: config.owner || 'platform-team',
        system: config.system
      }
    });

    // Track systems for later creation
    if (config.system) {
      this.generatedSystems.add(config.system);
    }

    return entity;
  }

  /**
   * Generate entities for multiple CRD types
   */
  public generateCrdEntities(
    crdClasses: any[],
    customConfigs?: Record<string, Partial<CrdEntityConfig>>
  ): ApiObject[] {
    const entities: ApiObject[] = [];

    for (const crdClass of crdClasses) {
      const gvk = this.extractGvk(crdClass);
      if (!gvk) continue;

      const crdKey = `${gvk.apiVersion}/${gvk.kind}`;
      const customConfig = customConfigs?.[crdKey];

      const entity = this.generateCrdEntity(crdClass, customConfig);
      if (entity) {
        entities.push(entity);
      }
    }

    return entities;
  }

  /**
   * Get the list of systems that need to be created
   */
  public getGeneratedSystems(): string[] {
    return Array.from(this.generatedSystems);
  }

  /**
   * Extract GroupVersionKind from a CRD class
   */
  private extractGvk(crdClass: any): GroupVersionKind | null {
    // Check if the class has a static GVK property
    if (crdClass.GVK && typeof crdClass.GVK === 'object') {
      return crdClass.GVK as GroupVersionKind;
    }

    // Try to extract from the class name and imports
    // This is a fallback and might not always work
    console.warn(`CRD class ${crdClass.name} does not have a static GVK property`);
    return null;
  }

  /**
   * Generate a Backstage entity name from GVK
   */
  private generateEntityName(gvk: GroupVersionKind): string {
    // Extract the group name (e.g., 'argoproj.io' -> 'argoproj')
    const group = gvk.apiVersion.split('/')[0].split('.')[0];
    
    // Convert kind to lowercase with hyphens
    const kind = gvk.kind.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
    
    return `${group}-${kind}`;
  }
}