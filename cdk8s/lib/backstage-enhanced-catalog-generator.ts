import { ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { 
  EnhancedRelationshipExtractor, 
  EnhancedExtractedResource 
} from './enhanced-relationship-extractor';
import { 
  BackstageDeterministicCatalogGenerator,
  DeterministicCatalogConfig
} from './backstage-deterministic-catalog-generator';
import { 
  Cdk8sRelationshipExtractor,
  ResourceRelationship,
  ReferenceType
} from './cdk8s-relationship-extractor';
import { App } from 'cdk8s';

/**
 * Enhanced Backstage catalog generator that uses TypeScript AST analysis
 */
export class BackstageEnhancedCatalogGenerator {
  private enhancedExtractor: EnhancedRelationshipExtractor;
  private entities: ApiObject[] = [];
  private entityMap: Map<string, ApiObject> = new Map();
  
  constructor(
    private scope: Construct,
    private mainApp: App,
    private config: DeterministicCatalogConfig = {}
  ) {
    this.enhancedExtractor = new EnhancedRelationshipExtractor(mainApp);
  }

  /**
   * Generate enhanced Backstage catalog entities
   */
  public async generate(): Promise<ApiObject[]> {
    // Extract enhanced resources and relationships
    const { resources, relationships, chartRelationships } = await this.enhancedExtractor.extract();
    
    // Create a basic extractor for compatibility
    const basicExtractor = new Cdk8sRelationshipExtractor(this.mainApp);
    
    // Use the existing deterministic generator as a base
    const baseGenerator = new BackstageDeterministicCatalogGenerator(
      this.scope,
      basicExtractor,
      this.config
    );
    
    // Generate base entities
    const baseEntities = baseGenerator.generate();
    
    // Enhance entities with additional metadata
    const enhancedEntities = this.enhanceEntities(baseEntities, resources);
    
    // Add new entities for TypeScript types and chart relationships
    const typeEntities = this.generateTypeEntities(resources);
    const chartRelationshipEntities = this.generateChartRelationshipEntities(chartRelationships);
    
    return [...enhancedEntities, ...typeEntities, ...chartRelationshipEntities];
  }

  /**
   * Enhance existing entities with AST-derived metadata
   */
  private enhanceEntities(
    baseEntities: ApiObject[], 
    resources: EnhancedExtractedResource[]
  ): ApiObject[] {
    const resourceMap = new Map<string, EnhancedExtractedResource>();
    
    // Build a map for quick lookup
    for (const resource of resources) {
      // Create multiple keys for flexible matching
      const keys = [
        resource.id,
        `${resource.chartId}-${resource.apiObject?.metadata?.name}`,
        `${resource.chartId}/${resource.apiObject?.kind}/${resource.apiObject?.metadata?.namespace}/${resource.apiObject?.metadata?.name}`,
      ];
      
      for (const key of keys) {
        if (key) {
          resourceMap.set(key, resource);
        }
      }
    }
    
    // Enhance each entity
    for (const entity of baseEntities) {
      const metadata = entity.metadata as any;
      const annotations = metadata.annotations || {};
      
      // Try to find matching resource
      let enhancedResource: EnhancedExtractedResource | undefined;
      
      // Try different matching strategies
      const possibleKeys = [
        metadata.name,
        annotations['cdk8s/chart-id'] + '-' + annotations['backstage.io/kubernetes-id'],
        annotations['cdk8s/creates-resources']?.split(',')[0],
      ];
      
      for (const key of possibleKeys) {
        if (key && resourceMap.has(key)) {
          enhancedResource = resourceMap.get(key);
          break;
        }
      }
      
      if (enhancedResource) {
        // Add enhanced metadata
        const enhancedMetadata = this.enhancedExtractor.generateEnhancedMetadata(enhancedResource);
        
        // Merge annotations
        Object.assign(annotations, enhancedMetadata);
        
        // Enhance description if available
        if (enhancedResource.documentation?.description && !metadata.description) {
          metadata.description = enhancedResource.documentation.description;
        }
        
        // Add tags from JSDoc
        if (enhancedResource.documentation?.tags) {
          const tags = metadata.tags || [];
          for (const [tagName, tagValue] of Object.entries(enhancedResource.documentation.tags)) {
            if (tagName === 'tag' && tagValue) {
              tags.push(tagValue);
            }
          }
          if (tags.length > 0) {
            metadata.tags = [...new Set(tags)]; // Remove duplicates
          }
        }
        
        // Add links from JSDoc
        if (enhancedResource.documentation?.tags?.link) {
          const links = metadata.links || [];
          const linkText = enhancedResource.documentation.tags.link;
          // Parse link format: "url title"
          const linkMatch = linkText.match(/(\S+)\s+(.+)/);
          if (linkMatch) {
            links.push({
              url: linkMatch[1],
              title: linkMatch[2],
            });
            metadata.links = links;
          }
        }
      }
    }
    
    return baseEntities;
  }

  /**
   * Generate entities for TypeScript types
   */
  private generateTypeEntities(resources: EnhancedExtractedResource[]): ApiObject[] {
    const typeEntities: ApiObject[] = [];
    const analyzedCharts = this.enhancedExtractor.getAnalyzedCharts();
    
    // Create entities for each analyzed chart class
    for (const [className, chart] of analyzedCharts) {
      const entityName = `type-${className.toLowerCase()}`;
      
      const entity = new ApiObject(this.scope, `type-entity-${entityName}`, {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Resource',
        metadata: {
          name: entityName,
          description: chart.documentation?.description || `${className} TypeScript class`,
          annotations: {
            'backstage.io/source-location': `url:https://github.com/PittampalliOrg/cdk8s-project/tree/main/${chart.filePath.replace(process.cwd() + '/', '')}`,
            'typescript/class-name': className,
            'typescript/base-class': chart.baseClass || 'Chart',
            'typescript/file-path': chart.filePath,
          },
          tags: [
            'typescript',
            'cdk8s-chart',
            'source-code',
            ...(chart.documentation?.tags?.map(t => t.tagName) || []),
          ],
        },
        spec: {
          type: 'typescript-class',
          lifecycle: 'production',
          owner: this.config.defaultOwner || 'platform-team',
          system: 'cdk8s-framework',
        },
      });
      
      typeEntities.push(entity);
      this.entityMap.set(entityName, entity);
      
      // Create entities for props interfaces
      if (chart.propsInterface) {
        const propsEntityName = `type-${chart.propsInterface.name.toLowerCase()}`;
        
        const propsEntity = new ApiObject(this.scope, `type-entity-${propsEntityName}`, {
          apiVersion: 'backstage.io/v1alpha1',
          kind: 'Resource',
          metadata: {
            name: propsEntityName,
            description: `Props interface for ${className}`,
            annotations: {
              'backstage.io/source-location': `url:https://github.com/PittampalliOrg/cdk8s-project/tree/main/${chart.filePath.replace(process.cwd() + '/', '')}`,
              'typescript/interface-name': chart.propsInterface.name,
              'typescript/properties': JSON.stringify(
                chart.propsInterface.properties.map(p => ({
                  name: p.name,
                  type: p.type,
                  optional: p.isOptional,
                }))
              ),
            },
            tags: ['typescript', 'interface', 'props', 'configuration'],
          },
          spec: {
            type: 'typescript-interface',
            lifecycle: 'production',
            owner: this.config.defaultOwner || 'platform-team',
            system: 'cdk8s-framework',
            dependsOn: [`resource:${entityName}`],
          },
        });
        
        typeEntities.push(propsEntity);
      }
    }
    
    return typeEntities;
  }

  /**
   * Generate entities representing chart relationships
   */
  private generateChartRelationshipEntities(chartRelationships: any[]): ApiObject[] {
    const relationshipEntities: ApiObject[] = [];
    
    // Group relationships by source
    const relationshipsBySource = new Map<string, any[]>();
    for (const rel of chartRelationships) {
      if (!relationshipsBySource.has(rel.source)) {
        relationshipsBySource.set(rel.source, []);
      }
      relationshipsBySource.get(rel.source)!.push(rel);
    }
    
    // Create a relationship entity for each chart
    for (const [source, rels] of relationshipsBySource) {
      const entityName = `chart-dependencies-${source.toLowerCase()}`;
      
      const dependencies = rels.map(r => ({
        target: r.target,
        type: r.type,
        optional: r.isOptional,
      }));
      
      const entity = new ApiObject(this.scope, `relationship-entity-${entityName}`, {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Resource',
        metadata: {
          name: entityName,
          description: `Dependencies for ${source} chart`,
          annotations: {
            'dependency-analysis/source': source,
            'dependency-analysis/count': String(dependencies.length),
            'dependency-analysis/details': JSON.stringify(dependencies),
          },
          tags: ['dependencies', 'chart-analysis', 'static-analysis'],
        },
        spec: {
          type: 'dependency-graph',
          lifecycle: 'production',
          owner: this.config.defaultOwner || 'platform-team',
          system: 'cdk8s-framework',
          dependsOn: dependencies
            .filter(d => !d.optional)
            .map(d => `component:chart-${d.target.toLowerCase()}`),
        },
      });
      
      relationshipEntities.push(entity);
    }
    
    return relationshipEntities;
  }
}