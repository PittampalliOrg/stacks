import { ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { ExtractedResource, ResourceRelationship, ReferenceType, Cdk8sRelationshipExtractor } from './cdk8s-relationship-extractor';

/**
 * Configuration for the deterministic catalog generator
 */
export interface DeterministicCatalogConfig {
  /**
   * The default owner for entities
   */
  defaultOwner?: string;
  
  /**
   * Map of chart IDs to custom metadata
   */
  chartMetadata?: Record<string, {
    description?: string;
    tags?: string[];
    links?: Array<{ url: string; title: string; icon?: string }>;
  }>;
  
  /**
   * Map of CRD types to custom metadata
   */
  customCrdMetadata?: Record<string, {
    links?: Array<{ url: string; title: string; icon?: string }>;
    tags?: string[];
    description?: string;
  }>;
  
  /**
   * ArgoCD application mappings
   */
  argocdMappings?: {
    charts?: Record<string, string>; // chartId -> argocd app name
    namespaceDefaults?: Record<string, string>; // namespace -> default argocd app
  };
  
  /**
   * Whether to generate chart entities
   */
  includeCharts?: boolean;
  
  /**
   * Whether to generate CRD type entities
   */
  includeCrdTypes?: boolean;
}

/**
 * Maps reference types to Backstage relationship types
 */
const REFERENCE_TYPE_TO_BACKSTAGE: Record<ReferenceType, string> = {
  [ReferenceType.SERVICE]: 'dependsOn',
  [ReferenceType.CONFIGMAP]: 'dependsOn',
  [ReferenceType.SECRET]: 'dependsOn',
  [ReferenceType.PVC]: 'dependsOn',
  [ReferenceType.DEPLOYMENT]: 'dependsOn',
  [ReferenceType.INGRESS_BACKEND]: 'dependsOn',
  [ReferenceType.LABEL_SELECTOR]: 'hasPart',
  [ReferenceType.NAMESPACE]: 'partOf',
  [ReferenceType.CHART_DEPENDENCY]: 'dependsOn',
  [ReferenceType.CONSTRUCT_PARENT]: 'partOf',
  [ReferenceType.CRD_INSTANCE]: 'instanceOf',
  [ReferenceType.ARGOCD_APPLICATION]: 'managedBy',
};

/**
 * Generates Backstage catalog entities deterministically from CDK8s construct tree
 */
export class BackstageDeterministicCatalogGenerator {
  private entities: ApiObject[] = [];
  private entityMap: Map<string, ApiObject> = new Map();
  private systems: Set<string> = new Set();
  private domains: Set<string> = new Set();
  private crdTypes: Map<string, Set<string>> = new Map(); // apiVersion/kind -> instance IDs
  private usedEntityNames: Set<string> = new Set(); // Track used entity names for collision detection
  
  constructor(
    private scope: Construct,
    private extractor: Cdk8sRelationshipExtractor,
    private config: DeterministicCatalogConfig = {}
  ) {
    this.config.defaultOwner = this.config.defaultOwner || 'platform-team';
    
    // Load CRD metadata from config file if not provided
    if (!this.config.customCrdMetadata) {
      this.loadCrdMetadataFromConfig();
    }
  }
  
  /**
   * Load CRD metadata from the config file
   */
  private loadCrdMetadataFromConfig(): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const configFile = path.join(process.cwd(), 'backstage-catalog-config.json');
      
      if (fs.existsSync(configFile)) {
        const configData = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        if (configData.crdMetadata) {
          // Convert to the format expected by the config
          this.config.customCrdMetadata = configData.crdMetadata;
        }
        if (configData.argocdMappings) {
          this.config.argocdMappings = configData.argocdMappings;
        }
      }
    } catch (error) {
      // Silently ignore - custom metadata is optional
    }
  }

  /**
   * Generate all Backstage catalog entities
   */
  public generate(): ApiObject[] {
    const { resources, relationships } = this.extractor.extract();
    
    // Skip domain generation - not allowed in Backstage catalog rules
    // this.generateDomains();
    
    // Create groups (like platform-team)
    this.generateGroups();
    
    // Create systems based on namespaces and chart groupings
    this.generateSystems(resources);
    
    // Generate CRD type entities if requested
    if (this.config.includeCrdTypes) {
      this.generateCrdTypeEntities(resources);
    }
    
    // Generate chart entities if requested
    if (this.config.includeCharts) {
      this.generateChartEntities(resources);
    }
    
    // Generate resource entities
    this.generateResourceEntities(resources, relationships);
    
    // Generate component entities for deployable resources
    this.generateComponentEntities(resources, relationships);
    
    return this.entities;
  }

  /**
   * Generate domain entities
   */
  private generateDomains(): void {
    const domains = [
      { name: 'platform-infrastructure', description: 'Platform infrastructure and tooling' },
      { name: 'applications', description: 'Business applications and services' },
    ];
    
    for (const domain of domains) {
      this.domains.add(domain.name);
      const entity = new ApiObject(this.scope, `domain-${domain.name}`, {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Domain',
        metadata: {
          name: domain.name,
          description: domain.description,
        },
        spec: {
          owner: this.config.defaultOwner,
        },
      });
      this.entities.push(entity);
    }
  }

  /**
   * Generate group entities
   */
  private generateGroups(): void {
    // Create the platform-team group
    const platformTeamGroup = new ApiObject(this.scope, 'group-platform-team', {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Group',
      metadata: {
        name: 'platform-team',
        description: 'Platform engineering team responsible for infrastructure and tooling',
        annotations: {
          'backstage.io/managed-by-location': 'url:https://github.com/PittampalliOrg/cdk8s-project/tree/main/backstage-catalog-config.json',
        },
      },
      spec: {
        type: 'team',
        children: [],
        members: [],
      },
    });
    this.entities.push(platformTeamGroup);
  }

  /**
   * Generate system entities based on namespaces and logical groupings
   */
  private generateSystems(resources: ExtractedResource[]): void {
    // Group resources by namespace
    const namespaceGroups = new Map<string, ExtractedResource[]>();
    
    for (const resource of resources) {
      const namespace = resource.apiObject?.metadata?.namespace || 'default';
      if (!namespaceGroups.has(namespace)) {
        namespaceGroups.set(namespace, []);
      }
      namespaceGroups.get(namespace)!.push(resource);
    }
    
    // Create systems for each namespace
    for (const [namespace, nsResources] of namespaceGroups) {
      const systemName = this.namespaceToSystem(namespace);
      const domain = this.namespaceToDomain(namespace);
      
      if (!this.systems.has(systemName)) {
        this.systems.add(systemName);
        
        const entity = new ApiObject(this.scope, `system-${systemName}`, {
          apiVersion: 'backstage.io/v1alpha1',
          kind: 'System',
          metadata: {
            name: systemName,
            description: `Resources in ${namespace} namespace`,
            annotations: {
              'backstage.io/kubernetes-namespace': namespace,
            },
          },
          spec: {
            owner: this.config.defaultOwner,
            // domain field removed - not allowed in Backstage catalog rules
          },
        });
        this.entities.push(entity);
      }
    }
    
    // Create special systems for CRD types
    const crdSystems = [
      { name: 'kubernetes-resources', description: 'Kubernetes resource types and definitions' },
      { name: 'custom-resources', description: 'Custom resource definitions and types' },
    ];
    
    for (const system of crdSystems) {
      if (!this.systems.has(system.name)) {
        this.systems.add(system.name);
        
        const entity = new ApiObject(this.scope, `system-${system.name}`, {
          apiVersion: 'backstage.io/v1alpha1',
          kind: 'System',
          metadata: {
            name: system.name,
            description: system.description,
          },
          spec: {
            owner: this.config.defaultOwner,
            // domain field removed - not allowed in Backstage catalog rules
          },
        });
        this.entities.push(entity);
      }
    }
  }

  /**
   * Generate CRD type entities
   */
  private generateCrdTypeEntities(resources: ExtractedResource[]): void {
    // Collect all unique CRD types
    const crdTypes = new Map<string, { apiVersion: string; kind: string; instances: string[] }>();
    
    for (const resource of resources) {
      if (resource.apiObject) {
        const typeKey = `${resource.apiObject.apiVersion}/${resource.apiObject.kind}`;
        
        if (!crdTypes.has(typeKey)) {
          crdTypes.set(typeKey, {
            apiVersion: resource.apiObject.apiVersion,
            kind: resource.apiObject.kind,
            instances: [],
          });
        }
        
        crdTypes.get(typeKey)!.instances.push(resource.id);
      }
    }
    
    // Create entities for each CRD type
    for (const [typeKey, typeInfo] of crdTypes) {
      const entityName = typeInfo.kind.toLowerCase();
      const isCustomResource = !typeInfo.apiVersion.includes('k8s.io');
      
      // Get custom metadata if available
      const customMetadata = this.config.customCrdMetadata?.[typeKey] || {};
      
      const entity = new ApiObject(this.scope, `crd-type-${entityName}`, {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Resource',
        metadata: {
          name: entityName,
          description: customMetadata.description || `${typeInfo.kind} resource type (${typeInfo.apiVersion})`,
          annotations: {
            'backstage.io/resource-type': 'kubernetes-type',
            'kubernetes.io/api-version': typeInfo.apiVersion,
            'kubernetes.io/kind': typeInfo.kind,
            'kubernetes.io/instance-count': String(typeInfo.instances.length),
          },
          tags: customMetadata.tags || [
            'resource-type',
            isCustomResource ? 'custom-resource' : 'core-resource',
            typeInfo.kind.toLowerCase(),
          ],
          links: customMetadata.links,
        },
        spec: {
          type: 'resource-type',
          lifecycle: 'production',
          owner: this.config.defaultOwner,
          system: isCustomResource ? 'custom-resources' : 'kubernetes-resources',
        },
      });
      
      this.entities.push(entity);
      this.entityMap.set(entityName, entity);
      this.usedEntityNames.add(entityName);
      
      // Track instances for relationship mapping
      this.crdTypes.set(typeKey, new Set(typeInfo.instances));
    }
  }

  /**
   * Generate chart entities
   */
  private generateChartEntities(resources: ExtractedResource[]): void {
    // Collect unique charts
    const charts = new Map<string, ExtractedResource[]>();
    
    for (const resource of resources) {
      if (!charts.has(resource.chartId)) {
        charts.set(resource.chartId, []);
      }
      charts.get(resource.chartId)!.push(resource);
    }
    
    // Create entities for each chart
    for (const [chartId, chartResources] of charts) {
      const entityName = chartId; // No prefix needed - chart names are unique
      const metadata = this.config.chartMetadata?.[chartId] || {};
      
      // Determine what this chart creates
      const createdTypes = new Set<string>();
      const createdResources: string[] = [];
      
      for (const resource of chartResources) {
        if (resource.apiObject) {
          createdTypes.add(resource.apiObject.kind);
          createdResources.push(resource.id);
        }
      }
      
      // Find ArgoCD app for this chart - first from extracted resources, then from config
      let argocdApp = chartResources.find(r => r.argocdApp)?.argocdApp;
      
      // If not found in extracted resources, check config mappings
      if (!argocdApp && this.config.argocdMappings?.charts) {
        argocdApp = this.config.argocdMappings.charts[chartId];
      }
      
      const annotations: any = {
        'backstage.io/source-location': `url:https://github.com/PittampalliOrg/cdk8s-project/tree/main/charts/${chartId}.ts`,
        'cdk8s/chart-id': chartId,
        'cdk8s/creates-resources': createdResources.join(','),
      };
      
      // Add ArgoCD annotation if available
      if (argocdApp) {
        annotations['argocd/app-name'] = argocdApp;
      }
      
      const constructId = `chart-${chartId}`;
      const entity = new ApiObject(this.scope, constructId, {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: entityName,
          description: metadata.description || `CDK8s chart that creates ${Array.from(createdTypes).join(', ')}`,
          annotations,
          tags: [
            'cdk8s',
            'chart',
            'infrastructure-as-code',
            ...(metadata.tags || []),
          ],
          links: metadata.links,
        },
        spec: {
          type: 'infrastructure',
          lifecycle: 'production',
          owner: this.config.defaultOwner,
          system: this.chartIdToSystem(chartId),
          providesResources: createdResources,
        },
      });
      
      this.entities.push(entity);
      this.entityMap.set(entityName, entity);
      this.usedEntityNames.add(entityName);
    }
  }

  /**
   * Generate resource entities for non-deployable resources
   */
  private generateResourceEntities(resources: ExtractedResource[], relationships: ResourceRelationship[]): void {
    const resourceKinds = [
      'ConfigMap', 'Secret', 'PersistentVolumeClaim', 'Service', 'Ingress', 
      'Certificate', 'ClusterIssuer', 'ExternalSecret', 'ReferenceGrant',
      'ServiceAccount', 'Role', 'RoleBinding', 'ClusterRole', 'ClusterRoleBinding'
    ];
    
    for (const resource of resources) {
      if (!resource.apiObject || !resourceKinds.includes(resource.apiObject.kind)) {
        continue;
      }
      
      // Special handling: Some critical resources should be Components, not Resources
      // This helps with ArgoCD plugin integration
      const shouldBeComponent = this.shouldResourceBeComponent(resource);
      
      const entityName = this.resourceToEntityName(resource);
      const dependencies = this.getResourceDependencies(resource.id, relationships);
      
      const annotations: any = {
        'backstage.io/kubernetes-id': resource.apiObject.metadata?.name || resource.id,
        'backstage.io/kubernetes-namespace': resource.apiObject.metadata?.namespace || 'default',
        'backstage.io/kubernetes-api-version': resource.apiObject.apiVersion,
        'backstage.io/kubernetes-kind': resource.apiObject.kind,
        'backstage.io/kubernetes-label-selector': this.generateLabelSelector(resource),
        'cdk8s/chart-id': resource.chartId,
        'cdk8s/construct-type': resource.constructType,
      };
      
      // Add ArgoCD annotation if available - first from resource, then from config
      let argocdApp = resource.argocdApp;
      
      // If not found in resource, check config mappings
      if (!argocdApp && this.config.argocdMappings) {
        // Check chart mapping first
        if (this.config.argocdMappings.charts) {
          argocdApp = this.config.argocdMappings.charts[resource.chartId];
        }
        
        // If still not found, check namespace defaults
        if (!argocdApp && this.config.argocdMappings.namespaceDefaults) {
          const namespace = resource.apiObject.metadata?.namespace || 'default';
          argocdApp = this.config.argocdMappings.namespaceDefaults[namespace];
        }
      }
      
      if (argocdApp) {
        annotations['argocd/app-name'] = argocdApp;
        // Add namespace annotation for ArgoCD resources
        if (resource.apiObject.metadata?.namespace === 'argocd') {
          annotations['argocd/app-namespace'] = 'argocd';
        }
      }
      
      // Use full resource ID for construct ID to ensure uniqueness
      const constructId = `resource-${resource.id.replace(/[^a-zA-Z0-9-]/g, '-')}`;
      const entity = new ApiObject(this.scope, constructId, {
        apiVersion: 'backstage.io/v1alpha1',
        kind: shouldBeComponent ? 'Component' : 'Resource',
        metadata: {
          name: entityName,
          description: `${resource.apiObject.kind} in ${resource.apiObject.metadata?.namespace || 'default'} namespace`,
          annotations,
          tags: [
            resource.apiObject.kind.toLowerCase(),
            resource.apiObject.metadata?.namespace || 'default',
          ],
        },
        spec: {
          type: shouldBeComponent ? 'service' : resource.apiObject.kind.toLowerCase(),
          lifecycle: 'production',
          owner: this.config.defaultOwner,
          system: this.namespaceToSystem(resource.apiObject.metadata?.namespace || 'default'),
          dependsOn: dependencies,
        },
      });
      
      this.entities.push(entity);
      this.entityMap.set(entityName, entity);
      this.usedEntityNames.add(entityName);
    }
  }

  /**
   * Generate component entities for deployable resources
   */
  private generateComponentEntities(resources: ExtractedResource[], relationships: ResourceRelationship[]): void {
    const componentKinds = ['Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob'];
    
    for (const resource of resources) {
      if (!resource.apiObject || !componentKinds.includes(resource.apiObject.kind)) {
        continue;
      }
      
      const entityName = this.resourceToEntityName(resource);
      const dependencies = this.getResourceDependencies(resource.id, relationships);
      
      // Determine component type based on labels or annotations
      const labels = resource.apiObject.metadata?.labels || {};
      const componentType = labels['app.kubernetes.io/component'] || 'service';
      
      const annotations: any = {
        'backstage.io/kubernetes-id': resource.apiObject.metadata?.name || resource.id,
        'backstage.io/kubernetes-namespace': resource.apiObject.metadata?.namespace || 'default',
        'backstage.io/kubernetes-label-selector': this.generateLabelSelector(resource),
        'cdk8s/chart-id': resource.chartId,
        'cdk8s/construct-type': resource.constructType,
      };
      
      // Add ArgoCD annotation if available - first from resource, then from config
      let argocdApp = resource.argocdApp;
      
      // If not found in resource, check config mappings
      if (!argocdApp && this.config.argocdMappings) {
        // Check chart mapping first
        if (this.config.argocdMappings.charts) {
          argocdApp = this.config.argocdMappings.charts[resource.chartId];
        }
        
        // If still not found, check namespace defaults
        if (!argocdApp && this.config.argocdMappings.namespaceDefaults) {
          const namespace = resource.apiObject.metadata?.namespace || 'default';
          argocdApp = this.config.argocdMappings.namespaceDefaults[namespace];
        }
      }
      
      if (argocdApp) {
        annotations['argocd/app-name'] = argocdApp;
        // Add namespace annotation for ArgoCD resources
        if (resource.apiObject.metadata?.namespace === 'argocd') {
          annotations['argocd/app-namespace'] = 'argocd';
        }
      }
      
      // Use full resource ID for construct ID to ensure uniqueness
      const constructId = `component-${resource.id.replace(/[^a-zA-Z0-9-]/g, '-')}`;
      const entity = new ApiObject(this.scope, constructId, {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: entityName,
          description: `${resource.apiObject.metadata?.name} ${resource.apiObject.kind}`,
          annotations,
          tags: [
            componentType,
            resource.apiObject.kind.toLowerCase(),
            resource.apiObject.metadata?.namespace || 'default',
          ],
        },
        spec: {
          type: componentType,
          lifecycle: 'production',
          owner: this.config.defaultOwner,
          system: this.namespaceToSystem(resource.apiObject.metadata?.namespace || 'default'),
          dependsOn: dependencies,
        },
      });
      
      this.entities.push(entity);
      this.entityMap.set(entityName, entity);
      this.usedEntityNames.add(entityName);
    }
  }

  /**
   * Helper methods
   */
  
  private resourceToEntityName(resource: ExtractedResource): string {
    const name = resource.apiObject?.metadata?.name || resource.id.split('/').pop() || 'unknown';
    const namespace = resource.apiObject?.metadata?.namespace || 'default';
    const kind = resource.apiObject?.kind?.toLowerCase() || 'resource';
    const chartId = resource.chartId;
    
    // Start with a clean base name - remove redundant chart prefixes from resource names
    let cleanName = name;
    
    // Remove chart ID prefix if the resource name starts with it
    if (name.toLowerCase().startsWith(chartId.toLowerCase() + '-')) {
      cleanName = name.substring(chartId.length + 1);
    }
    
    // Check if we need namespace/chart for uniqueness
    // First try just name-kind
    let entityName = `${cleanName}-${kind}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    
    // If this would create a collision, add namespace (if not default)
    if (this.wouldCollide(entityName, resource)) {
      if (namespace !== 'default') {
        entityName = `${namespace}-${cleanName}-${kind}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
      }
      
      // If still colliding, add chart ID
      if (this.wouldCollide(entityName, resource)) {
        entityName = `${chartId}-${cleanName}-${kind}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
      }
    }
    
    // Handle length limit
    if (entityName.length <= 63) {
      return entityName;
    }
    
    // If too long, use smart truncation with hash
    const hash = this.generateShortHash(`${chartId}-${namespace}-${name}-${kind}`);
    const maxLength = 63 - hash.length - 1;
    
    // Keep the most meaningful parts
    const parts = {
      name: cleanName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase(),
      kind: kind,
      namespace: namespace === 'default' ? '' : namespace.substring(0, 10)
    };
    
    // Build truncated name prioritizing resource name and kind
    let truncatedName = parts.name;
    if (truncatedName.length > 35) {
      truncatedName = truncatedName.substring(0, 35);
    }
    
    // Always include kind if possible
    if (truncatedName.length + parts.kind.length + 1 < maxLength) {
      truncatedName = `${truncatedName}-${parts.kind}`;
    }
    
    // Add namespace prefix if there's room and it's not default
    if (parts.namespace && truncatedName.length + parts.namespace.length + 1 < maxLength) {
      truncatedName = `${parts.namespace}-${truncatedName}`;
    }
    
    return `${truncatedName}-${hash}`;
  }
  
  /**
   * Generate a short hash for uniqueness
   */
  private generateShortHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Convert to base36 and take the first 6 characters
    return Math.abs(hash).toString(36).substring(0, 6);
  }
  
  /**
   * Check if an entity name would collide with existing entities
   */
  private wouldCollide(entityName: string, currentResource: ExtractedResource): boolean {
    // Check if name is already used
    if (this.usedEntityNames.has(entityName)) {
      return true;
    }
    
    // Pre-check against resources that will be processed
    // This is a simplified check - in a real implementation, we might want to
    // pre-process all resources to build a complete collision map
    const allResources = this.extractor.extract().resources;
    
    for (const resource of allResources) {
      // Skip self
      if (resource.id === currentResource.id) {
        continue;
      }
      
      // Check if this resource would generate the same entity name
      const name = resource.apiObject?.metadata?.name || resource.id.split('/').pop() || 'unknown';
      const kind = resource.apiObject?.kind?.toLowerCase() || 'resource';
      
      // Apply same cleaning logic
      let cleanName = name;
      if (name.toLowerCase().startsWith(resource.chartId.toLowerCase() + '-')) {
        cleanName = name.substring(resource.chartId.length + 1);
      }
      
      const potentialName = `${cleanName}-${kind}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
      
      if (potentialName === entityName) {
        return true;
      }
    }
    
    return false;
  }
  
  private namespaceToSystem(namespace: string): string {
    // Map namespaces to logical systems
    const systemMappings: Record<string, string> = {
      'default': 'default-resources',
      'kube-system': 'kubernetes-platform',
      'argocd': 'gitops-platform',
      'monitoring': 'observability-stack',
      'nextjs': 'application-stack',
      'backstage': 'developer-portal',
      'kargo': 'delivery-platform',
      'kagent': 'ai-platform',
      'platform': 'platform-services',
      'cert-manager': 'security-platform',
    };
    
    return systemMappings[namespace] || `${namespace}-resources`;
  }
  
  private namespaceToDomain(namespace: string): string {
    const applicationNamespaces = ['nextjs', 'backstage', 'default'];
    return applicationNamespaces.includes(namespace) ? 'applications' : 'platform-infrastructure';
  }
  
  private chartIdToSystem(chartId: string): string {
    // Map chart types to systems
    if (chartId.includes('secrets')) return 'security-platform';
    if (chartId.includes('monitoring') || chartId.includes('prometheus') || chartId.includes('grafana')) return 'observability-stack';
    if (chartId.includes('kargo')) return 'delivery-platform';
    if (chartId.includes('kagent') || chartId.includes('mcp')) return 'ai-platform';
    if (chartId.includes('nextjs') || chartId.includes('backstage')) return 'application-stack';
    
    return 'platform-services';
  }
  
  private generateLabelSelector(resource: ExtractedResource): string {
    const labels = resource.apiObject?.metadata?.labels || {};
    const selectors: string[] = [];
    
    // First, check if this is a workload resource that has a selector spec
    const apiObject = resource.apiObject as any;
    const spec = apiObject?.spec;
    const kind = apiObject?.kind;
    
    // For Deployments, StatefulSets, DaemonSets, etc., use the pod selector
    if (spec?.selector?.matchLabels && ['Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet'].includes(kind || '')) {
      // Use the actual selector from the deployment spec
      for (const [key, value] of Object.entries(spec.selector.matchLabels)) {
        selectors.push(`${key}=${value}`);
      }
      return selectors.join(',');
    }
    
    // For Services, use their selector
    if (kind === 'Service' && spec?.selector) {
      for (const [key, value] of Object.entries(spec.selector)) {
        selectors.push(`${key}=${value}`);
      }
      return selectors.join(',');
    }
    
    // For pods and other resources, use their labels
    if (labels['app']) {
      selectors.push(`app=${labels['app']}`);
    } else if (labels['app.kubernetes.io/name']) {
      selectors.push(`app.kubernetes.io/name=${labels['app.kubernetes.io/name']}`);
    } else if (labels['app.kubernetes.io/instance']) {
      selectors.push(`app.kubernetes.io/instance=${labels['app.kubernetes.io/instance']}`);
    } else if (labels['app.kubernetes.io/component']) {
      selectors.push(`app.kubernetes.io/component=${labels['app.kubernetes.io/component']}`);
    }
    
    // For resources without standard labels, try to generate a selector based on metadata
    if (selectors.length === 0 && resource.apiObject?.metadata?.name) {
      const name = resource.apiObject.metadata.name;
      
      // Special handling for different resource types
      switch (kind) {
        case 'ConfigMap':
        case 'Secret':
          // These often have a name label
          selectors.push(`name=${name}`);
          break;
        case 'Ingress':
          // Ingresses don't have selectors, but we can try to match the service they route to
          const backend = (spec?.rules?.[0]?.http?.paths?.[0]?.backend?.service?.name) || 
                         (spec?.defaultBackend?.service?.name);
          if (backend) {
            selectors.push(`app=${backend}`);
          } else {
            selectors.push(`app=${name.replace('-ingress', '')}`);
          }
          break;
        default:
          // Try to extract app name from resource name
          const appName = name.replace(/-deployment$|-service$|-configmap$|-secret$/, '');
          selectors.push(`app=${appName}`);
      }
    }
    
    // If we still don't have selectors, use a combination of metadata
    if (selectors.length === 0) {
      const name = resource.apiObject?.metadata?.name || resource.id.split('/').pop() || 'unknown';
      selectors.push(`backstage.io/kubernetes-id=${name}`);
    }
    
    return selectors.join(',');
  }
  
  /**
   * Determine if a resource should be a Component instead of Resource
   * This helps with ArgoCD plugin integration
   */
  private shouldResourceBeComponent(resource: ExtractedResource): boolean {
    // Services and Ingresses in application namespaces should be components
    const appNamespaces = ['nextjs', 'backstage', 'default', 'monitoring', 'kargo', 'kagent'];
    const namespace = resource.apiObject?.metadata?.namespace || 'default';
    
    if (appNamespaces.includes(namespace)) {
      return ['Service', 'Ingress'].includes(resource.apiObject?.kind || '');
    }
    
    // Critical platform services should be components
    const criticalResources = [
      'argocd-server-ingress',
      'prometheus',
      'grafana',
      'kargo-ui'
    ];
    
    const name = resource.apiObject?.metadata?.name || '';
    return criticalResources.includes(name);
  }
  
  private getResourceDependencies(resourceId: string, relationships: ResourceRelationship[]): string[] {
    const dependencies: string[] = [];
    
    for (const rel of relationships) {
      if (rel.sourceId === resourceId) {
        // Find the target entity name
        const targetResource = this.extractor.extract().resources.find(r => r.id === rel.targetId);
        if (targetResource) {
          const targetEntityName = this.resourceToEntityName(targetResource);
          
          // Map to Backstage entity reference format
          const targetKind = this.getBackstageKind(targetResource);
          dependencies.push(`${targetKind}:default/${targetEntityName}`);
        }
      }
    }
    
    // Also add CRD type dependencies
    const resource = this.extractor.extract().resources.find(r => r.id === resourceId);
    if (resource?.apiObject) {
      const typeKey = `${resource.apiObject.apiVersion}/${resource.apiObject.kind}`;
      const typeEntityName = resource.apiObject.kind.toLowerCase();
      dependencies.push(`resource:default/${typeEntityName}`);
    }
    
    return [...new Set(dependencies)]; // Remove duplicates
  }
  
  private getBackstageKind(resource: ExtractedResource): string {
    const componentKinds = ['Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob'];
    
    if (resource.apiObject && componentKinds.includes(resource.apiObject.kind)) {
      return 'component';
    }
    
    return 'resource';
  }
}