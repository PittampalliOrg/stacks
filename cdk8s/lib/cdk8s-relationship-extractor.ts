import { App, Chart, ApiObject } from 'cdk8s';
import { IConstruct } from 'constructs';

/**
 * Represents a resource in the CDK8s construct tree
 */
export interface ExtractedResource {
  /** Unique identifier for the resource */
  id: string;
  /** The construct path in the tree */
  path: string;
  /** The CDK8s Chart that contains this resource */
  chartId: string;
  /** The class name of the construct (e.g., 'KubeDeployment') */
  constructType: string;
  /** The Kubernetes API object metadata */
  apiObject?: {
    apiVersion: string;
    kind: string;
    metadata?: any; // Using any to avoid ApiObjectMetadata type issues
  };
  /** The original construct instance */
  construct: IConstruct;
  /** References to other resources */
  references: ResourceReference[];
  /** The ArgoCD application that manages this resource */
  argocdApp?: string;
}

/**
 * Represents a reference from one resource to another
 */
export interface ResourceReference {
  /** The type of reference (e.g., 'service', 'configmap', 'secret') */
  type: ReferenceType;
  /** The target resource identifier */
  targetId: string;
  /** Additional context about the reference */
  context?: string;
}

export enum ReferenceType {
  SERVICE = 'service',
  CONFIGMAP = 'configmap',
  SECRET = 'secret',
  PVC = 'persistentvolumeclaim',
  DEPLOYMENT = 'deployment',
  INGRESS_BACKEND = 'ingress-backend',
  LABEL_SELECTOR = 'label-selector',
  NAMESPACE = 'namespace',
  CHART_DEPENDENCY = 'chart-dependency',
  CONSTRUCT_PARENT = 'construct-parent',
  CRD_INSTANCE = 'crd-instance',
  ARGOCD_APPLICATION = 'argocd-application',
}

/**
 * Represents a relationship between resources
 */
export interface ResourceRelationship {
  sourceId: string;
  targetId: string;
  type: ReferenceType;
  bidirectional?: boolean;
}

/**
 * Extracts relationships from CDK8s construct tree
 */
export class Cdk8sRelationshipExtractor {
  private resources: Map<string, ExtractedResource> = new Map();
  private relationships: ResourceRelationship[] = [];
  private chartMap: Map<string, Chart> = new Map();
  private argocdAppMap: Map<string, string> = new Map(); // chartId -> argocd app name
  
  constructor(private app: App) {}

  /**
   * Extract all resources and relationships from the app
   */
  public extract(): {
    resources: ExtractedResource[];
    relationships: ResourceRelationship[];
  } {
    // First pass: collect all charts and resources
    this.collectResources(this.app);
    
    // Second pass: analyze ArgoCD applications
    this.analyzeArgocdApplications();
    
    // Third pass: analyze relationships
    this.analyzeRelationships();
    
    return {
      resources: Array.from(this.resources.values()),
      relationships: this.relationships,
    };
  }

  /**
   * Collect all resources from the construct tree
   */
  private collectResources(root: IConstruct): void {
    const stack: IConstruct[] = [root];
    
    while (stack.length > 0) {
      const current = stack.pop()!;
      
      // Check if this is a Chart
      if (this.isChart(current)) {
        this.chartMap.set(current.node.path, current as Chart);
      }
      
      // Check if this is an ApiObject
      if (this.isApiObject(current)) {
        const apiObj = current as ApiObject;
        const resource = this.extractResourceInfo(apiObj);
        this.resources.set(resource.id, resource);
      }
      
      // Add children to stack
      stack.push(...current.node.children);
    }
  }

  /**
   * Extract information about a resource
   */
  private extractResourceInfo(apiObj: ApiObject): ExtractedResource {
    const chartId = this.findContainingChart(apiObj)?.node.id || 'unknown';
    const constructType = apiObj.constructor.name;
    
    // Create a deterministic ID based on the resource's properties
    const metadata = apiObj.metadata || {};
    const namespace = metadata.namespace || 'default';
    const name = metadata.name || apiObj.node.id;
    const kind = apiObj.kind;
    const id = `${chartId}/${kind}/${namespace}/${name}`;
    
    // Get ArgoCD app from the map if available
    const argocdApp = this.argocdAppMap.get(chartId);
    
    return {
      id,
      path: apiObj.node.path,
      chartId,
      constructType,
      apiObject: {
        apiVersion: apiObj.apiVersion,
        kind: apiObj.kind,
        metadata: apiObj.metadata,
      },
      construct: apiObj,
      references: [],
      argocdApp,
    };
  }

  /**
   * Find the Chart that contains a construct
   */
  private findContainingChart(construct: IConstruct): Chart | undefined {
    let current: IConstruct | undefined = construct;
    
    while (current) {
      if (this.isChart(current)) {
        return current as Chart;
      }
      current = current.node.scope;
    }
    
    return undefined;
  }

  /**
   * Analyze ArgoCD applications in the app
   */
  private analyzeArgocdApplications(): void {
    // Look for ArgoCD Application resources
    for (const resource of this.resources.values()) {
      if (resource.apiObject?.apiVersion === 'argoproj.io/v1alpha1' && 
          resource.apiObject?.kind === 'Application') {
        const app = resource.construct as any;
        const spec = app.spec;
        
        if (spec?.source?.directory?.include) {
          // Extract the chart name from the include pattern
          // Pattern is like "[0-9][0-9][0-9][0-9]-${resourcePath}.k8s.yaml"
          const includePattern = spec.source.directory.include;
          const match = includePattern.match(/\[0-9\]\[0-9\]\[0-9\]\[0-9\]-(.+)\.k8s\.yaml/);
          
          if (match && match[1]) {
            const chartName = match[1];
            const appName = resource.apiObject.metadata?.name || '';
            
            // Map the chart name to the ArgoCD app name
            this.argocdAppMap.set(chartName, appName);
            
            // Create ArgoCD application relationships for all resources in that chart
            for (const targetResource of this.resources.values()) {
              if (targetResource.chartId === chartName) {
                targetResource.argocdApp = appName;
                this.addRelationship(targetResource.id, resource.id, ReferenceType.ARGOCD_APPLICATION);
              }
            }
          }
        }
      }
    }
  }

  /**
   * Analyze relationships between resources
   */
  private analyzeRelationships(): void {
    for (const resource of this.resources.values()) {
      // Analyze based on resource type
      const apiObj = resource.construct as ApiObject;
      
      switch (apiObj.kind) {
        case 'Service':
          this.analyzeServiceRelationships(resource);
          break;
        case 'Deployment':
        case 'StatefulSet':
        case 'DaemonSet':
          this.analyzeWorkloadRelationships(resource);
          break;
        case 'Ingress':
          this.analyzeIngressRelationships(resource);
          break;
        case 'ConfigMap':
        case 'Secret':
          // These are typically referenced by others
          break;
      }
      
      // Analyze construct hierarchy
      this.analyzeConstructHierarchy(resource);
      
      // Analyze chart dependencies
      this.analyzeChartDependencies(resource);
    }
  }

  /**
   * Analyze Service relationships
   */
  private analyzeServiceRelationships(resource: ExtractedResource): void {
    const service = resource.construct as any;
    const spec = service.spec;
    
    if (!spec) return;
    
    // Find pods that match the service selector
    if (spec.selector) {
      const selector = spec.selector;
      
      // Find all workloads that might match this selector
      for (const targetResource of this.resources.values()) {
        if (this.isWorkload(targetResource.apiObject?.kind)) {
          const workload = targetResource.construct as any;
          const podTemplate = workload.spec?.template;
          
          if (podTemplate?.metadata?.labels && this.labelsMatch(selector, podTemplate.metadata.labels)) {
            this.addRelationship(resource.id, targetResource.id, ReferenceType.LABEL_SELECTOR);
          }
        }
      }
    }
  }

  /**
   * Analyze workload relationships
   */
  private analyzeWorkloadRelationships(resource: ExtractedResource): void {
    const workload = resource.construct as any;
    const podSpec = workload.spec?.template?.spec;
    
    if (!podSpec) return;
    
    // Analyze container references
    if (podSpec.containers) {
      for (const container of podSpec.containers) {
        // Environment variables from ConfigMaps/Secrets
        if (container.env) {
          for (const env of container.env) {
            if (env.valueFrom?.configMapKeyRef) {
              const targetId = this.findResourceByName('ConfigMap', env.valueFrom.configMapKeyRef.name, resource);
              if (targetId) {
                this.addRelationship(resource.id, targetId, ReferenceType.CONFIGMAP);
              }
            }
            if (env.valueFrom?.secretKeyRef) {
              const targetId = this.findResourceByName('Secret', env.valueFrom.secretKeyRef.name, resource);
              if (targetId) {
                this.addRelationship(resource.id, targetId, ReferenceType.SECRET);
              }
            }
          }
        }
        
        // Volume mounts
        if (container.volumeMounts && podSpec.volumes) {
          for (const mount of container.volumeMounts) {
            const volume = podSpec.volumes.find((v: any) => v.name === mount.name);
            if (volume) {
              if (volume.configMap) {
                const targetId = this.findResourceByName('ConfigMap', volume.configMap.name, resource);
                if (targetId) {
                  this.addRelationship(resource.id, targetId, ReferenceType.CONFIGMAP);
                }
              }
              if (volume.secret) {
                const targetId = this.findResourceByName('Secret', volume.secret.secretName, resource);
                if (targetId) {
                  this.addRelationship(resource.id, targetId, ReferenceType.SECRET);
                }
              }
              if (volume.persistentVolumeClaim) {
                const targetId = this.findResourceByName('PersistentVolumeClaim', volume.persistentVolumeClaim.claimName, resource);
                if (targetId) {
                  this.addRelationship(resource.id, targetId, ReferenceType.PVC);
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Analyze Ingress relationships
   */
  private analyzeIngressRelationships(resource: ExtractedResource): void {
    const ingress = resource.construct as any;
    const spec = ingress.spec;
    
    if (!spec?.rules) return;
    
    for (const rule of spec.rules) {
      if (rule.http?.paths) {
        for (const path of rule.http.paths) {
          if (path.backend?.service?.name) {
            const targetId = this.findResourceByName('Service', path.backend.service.name, resource);
            if (targetId) {
              this.addRelationship(resource.id, targetId, ReferenceType.INGRESS_BACKEND);
            }
          }
        }
      }
    }
  }

  /**
   * Analyze construct hierarchy relationships
   */
  private analyzeConstructHierarchy(resource: ExtractedResource): void {
    const parent = resource.construct.node.scope;
    
    if (parent && this.isApiObject(parent)) {
      const parentResource = this.findResourceByConstruct(parent);
      if (parentResource) {
        this.addRelationship(resource.id, parentResource.id, ReferenceType.CONSTRUCT_PARENT);
      }
    }
  }

  /**
   * Analyze chart-level dependencies
   */
  private analyzeChartDependencies(resource: ExtractedResource): void {
    const chart = this.chartMap.get(resource.chartId);
    if (!chart) return;
    
    // CDK8s charts track dependencies
    const dependencies = chart.node.dependencies;
    for (const dep of dependencies) {
      if (this.isChart(dep)) {
        const depChart = dep as Chart;
        // Find resources in the dependent chart
        for (const depResource of this.resources.values()) {
          if (depResource.chartId === depChart.node.id) {
            this.addRelationship(resource.id, depResource.id, ReferenceType.CHART_DEPENDENCY);
          }
        }
      }
    }
  }

  /**
   * Helper methods
   */
  
  private isChart(construct: IConstruct): boolean {
    return construct instanceof Chart;
  }
  
  private isApiObject(construct: IConstruct): boolean {
    return construct instanceof ApiObject;
  }
  
  private isWorkload(kind?: string): boolean {
    return kind === 'Deployment' || kind === 'StatefulSet' || kind === 'DaemonSet' || kind === 'ReplicaSet';
  }
  
  private labelsMatch(selector: any, labels: any): boolean {
    if (!selector || !labels) return false;
    
    for (const [key, value] of Object.entries(selector)) {
      if (labels[key] !== value) return false;
    }
    
    return true;
  }
  
  private findResourceByName(kind: string, name: string, contextResource: ExtractedResource): string | undefined {
    const namespace = contextResource.apiObject?.metadata?.namespace || 'default';
    
    for (const [id, resource] of this.resources.entries()) {
      if (resource.apiObject?.kind === kind &&
          resource.apiObject?.metadata?.name === name &&
          (resource.apiObject?.metadata?.namespace || 'default') === namespace) {
        return id;
      }
    }
    
    return undefined;
  }
  
  private findResourceByConstruct(construct: IConstruct): ExtractedResource | undefined {
    for (const resource of this.resources.values()) {
      if (resource.construct === construct) {
        return resource;
      }
    }
    return undefined;
  }
  
  private addRelationship(sourceId: string, targetId: string, type: ReferenceType): void {
    // Avoid duplicates
    const exists = this.relationships.some(
      r => r.sourceId === sourceId && r.targetId === targetId && r.type === type
    );
    
    if (!exists) {
      this.relationships.push({ sourceId, targetId, type });
    }
  }

  /**
   * Generate a relationship graph in various formats
   */
  public generateGraph(format: 'json' | 'dot' | 'mermaid' = 'json'): string {
    const { resources, relationships } = this.extract();
    
    switch (format) {
      case 'json':
        return JSON.stringify({ resources, relationships }, null, 2);
        
      case 'dot':
        return this.generateDotGraph(resources, relationships);
        
      case 'mermaid':
        return this.generateMermaidGraph(resources, relationships);
        
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private generateDotGraph(resources: ExtractedResource[], relationships: ResourceRelationship[]): string {
    const lines: string[] = ['digraph CDK8S {'];
    lines.push('  rankdir=LR;');
    lines.push('  node [shape=box];');
    
    // Add nodes
    for (const resource of resources) {
      const label = `${resource.apiObject?.kind}\\n${resource.apiObject?.metadata?.name}`;
      lines.push(`  "${resource.id}" [label="${label}"];`);
    }
    
    // Add edges
    for (const rel of relationships) {
      lines.push(`  "${rel.sourceId}" -> "${rel.targetId}" [label="${rel.type}"];`);
    }
    
    lines.push('}');
    return lines.join('\n');
  }

  private generateMermaidGraph(resources: ExtractedResource[], relationships: ResourceRelationship[]): string {
    const lines: string[] = ['graph LR'];
    
    // Add nodes
    for (const resource of resources) {
      const label = `${resource.apiObject?.kind}:${resource.apiObject?.metadata?.name}`;
      lines.push(`  ${resource.id.replace(/[^a-zA-Z0-9]/g, '_')}["${label}"]`);
    }
    
    // Add edges
    for (const rel of relationships) {
      const sourceId = rel.sourceId.replace(/[^a-zA-Z0-9]/g, '_');
      const targetId = rel.targetId.replace(/[^a-zA-Z0-9]/g, '_');
      lines.push(`  ${sourceId} -->|${rel.type}| ${targetId}`);
    }
    
    return lines.join('\n');
  }
}