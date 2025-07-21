import { App } from 'cdk8s';
import { 
  ExtractedResource, 
  ResourceRelationship, 
  ReferenceType,
  Cdk8sRelationshipExtractor 
} from './cdk8s-relationship-extractor';
import { 
  TypeScriptAstAnalyzer, 
  AnalyzedChart, 
  ChartRelationship 
} from './typescript-ast-analyzer';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Enhanced relationship extraction that combines runtime and static analysis
 */
export interface EnhancedExtractedResource extends ExtractedResource {
  /** JSDoc documentation from source code */
  documentation?: {
    description?: string;
    tags?: Record<string, string>;
  };
  /** Source file location */
  sourceLocation?: {
    filePath: string;
    line?: number;
  };
  /** Type hierarchy information */
  typeHierarchy?: string[];
  /** Props interface properties if available */
  configurationSchema?: Record<string, any>;
}

/**
 * Enhanced relationship extractor that combines runtime CDK8s analysis with static TypeScript AST analysis
 */
export class EnhancedRelationshipExtractor {
  private baseExtractor: Cdk8sRelationshipExtractor;
  private astAnalyzer: TypeScriptAstAnalyzer;
  private analyzedCharts: Map<string, AnalyzedChart> = new Map();
  private enhancedResources: Map<string, EnhancedExtractedResource> = new Map();
  
  constructor(app: App, private projectRoot: string = process.cwd()) {
    this.baseExtractor = new Cdk8sRelationshipExtractor(app);
    this.astAnalyzer = new TypeScriptAstAnalyzer(projectRoot);
  }

  /**
   * Extract enhanced resources and relationships
   */
  public async extract(): Promise<{
    resources: EnhancedExtractedResource[];
    relationships: ResourceRelationship[];
    chartRelationships: ChartRelationship[];
  }> {
    // First, analyze TypeScript source files
    await this.analyzeTypeScriptSources();
    
    // Then, do runtime extraction
    const { resources, relationships } = this.baseExtractor.extract();
    
    // Enhance resources with static analysis data
    const enhancedResources = this.enhanceResources(resources);
    
    // Add relationships discovered through static analysis
    const additionalRelationships = this.extractStaticRelationships();
    
    // Get chart-level relationships from AST
    const chartRelationships = this.astAnalyzer.getChartRelationships();
    
    return {
      resources: enhancedResources,
      relationships: [...relationships, ...additionalRelationships],
      chartRelationships,
    };
  }

  /**
   * Analyze TypeScript source files
   */
  private async analyzeTypeScriptSources(): Promise<void> {
    // Find all chart files
    const chartPaths = this.findChartFiles();
    
    // Analyze them
    this.analyzedCharts = await this.astAnalyzer.analyzeCharts(chartPaths);
  }

  /**
   * Find all chart files in the project
   */
  private findChartFiles(): string[] {
    const chartPaths: string[] = [];
    const chartsDir = path.join(this.projectRoot, 'charts');
    
    if (fs.existsSync(chartsDir)) {
      const files = fs.readdirSync(chartsDir);
      for (const file of files) {
        if (file.endsWith('-chart.ts') || file.endsWith('Chart.ts')) {
          chartPaths.push(path.join(chartsDir, file));
        }
      }
    }
    
    // Also check for charts in subdirectories
    const appChartsDir = path.join(chartsDir, 'applications');
    if (fs.existsSync(appChartsDir)) {
      this.findChartFilesRecursive(appChartsDir, chartPaths);
    }
    
    return chartPaths;
  }

  /**
   * Recursively find chart files
   */
  private findChartFilesRecursive(dir: string, chartPaths: string[]): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        this.findChartFilesRecursive(fullPath, chartPaths);
      } else if (entry.isFile() && (entry.name.endsWith('-chart.ts') || entry.name.endsWith('Chart.ts'))) {
        chartPaths.push(fullPath);
      }
    }
  }

  /**
   * Enhance resources with static analysis data
   */
  private enhanceResources(resources: ExtractedResource[]): EnhancedExtractedResource[] {
    const enhanced: EnhancedExtractedResource[] = [];
    
    for (const resource of resources) {
      const enhancedResource: EnhancedExtractedResource = {
        ...resource,
      };
      
      // Find the analyzed chart for this resource
      const analyzedChart = this.findAnalyzedChart(resource.chartId);
      
      if (analyzedChart) {
        // Add documentation
        if (analyzedChart.documentation) {
          enhancedResource.documentation = {
            description: analyzedChart.documentation.description,
            tags: this.convertJsDocTags(analyzedChart.documentation.tags),
          };
        }
        
        // Add source location
        enhancedResource.sourceLocation = {
          filePath: analyzedChart.filePath,
        };
        
        // Add type hierarchy
        enhancedResource.typeHierarchy = this.getTypeHierarchy(resource.constructType);
        
        // Add configuration schema from props interface
        if (analyzedChart.propsInterface) {
          enhancedResource.configurationSchema = this.convertPropsToSchema(analyzedChart.propsInterface);
        }
      }
      
      enhanced.push(enhancedResource);
      this.enhancedResources.set(resource.id, enhancedResource);
    }
    
    return enhanced;
  }

  /**
   * Find analyzed chart by chart ID
   */
  private findAnalyzedChart(chartId: string): AnalyzedChart | undefined {
    // Try exact match first
    if (this.analyzedCharts.has(chartId)) {
      return this.analyzedCharts.get(chartId);
    }
    
    // Try to find by class name pattern
    for (const [className, chart] of this.analyzedCharts) {
      // Convert class name to chart ID format (e.g., NextJsChart -> nextjs)
      const derivedChartId = className
        .replace(/Chart$/, '')
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '');
      
      if (derivedChartId === chartId) {
        return chart;
      }
    }
    
    return undefined;
  }

  /**
   * Convert JSDoc tags to a record
   */
  private convertJsDocTags(tags: { tagName: string; text?: string }[]): Record<string, string> {
    const result: Record<string, string> = {};
    
    for (const tag of tags) {
      result[tag.tagName] = tag.text || 'true';
    }
    
    return result;
  }

  /**
   * Get type hierarchy for a construct type
   */
  private getTypeHierarchy(constructType: string): string[] {
    // Basic hierarchy for known CDK8s types
    const hierarchies: Record<string, string[]> = {
      'KubeDeployment': ['ApiObject', 'Construct', 'IConstruct'],
      'KubeService': ['ApiObject', 'Construct', 'IConstruct'],
      'KubeConfigMap': ['ApiObject', 'Construct', 'IConstruct'],
      'KubeSecret': ['ApiObject', 'Construct', 'IConstruct'],
      'KubeIngress': ['ApiObject', 'Construct', 'IConstruct'],
      'Deployment': ['Workload', 'Resource', 'Construct', 'IConstruct'],
      'Service': ['Resource', 'Construct', 'IConstruct'],
      'ConfigMap': ['Resource', 'Construct', 'IConstruct'],
      'Secret': ['Resource', 'Construct', 'IConstruct'],
    };
    
    return hierarchies[constructType] || ['Construct', 'IConstruct'];
  }

  /**
   * Convert props interface to configuration schema
   */
  private convertPropsToSchema(propsInterface: any): Record<string, any> {
    const schema: Record<string, any> = {
      type: 'object',
      properties: {},
      required: [],
    };
    
    for (const prop of propsInterface.properties) {
      schema.properties[prop.name] = {
        type: this.typeToJsonSchemaType(prop.type),
        description: prop.documentation,
      };
      
      if (!prop.isOptional) {
        schema.required.push(prop.name);
      }
    }
    
    return schema;
  }

  /**
   * Convert TypeScript type to JSON schema type
   */
  private typeToJsonSchemaType(tsType: string): string {
    if (tsType.includes('string')) return 'string';
    if (tsType.includes('number')) return 'number';
    if (tsType.includes('boolean')) return 'boolean';
    if (tsType.includes('[]')) return 'array';
    return 'object';
  }

  /**
   * Extract additional relationships from static analysis
   */
  private extractStaticRelationships(): ResourceRelationship[] {
    const relationships: ResourceRelationship[] = [];
    
    // Convert chart relationships to resource relationships
    const chartRelationships = this.astAnalyzer.getChartRelationships();
    
    for (const chartRel of chartRelationships) {
      // Find all resources in source and target charts
      const sourceResources = this.findResourcesByChartId(chartRel.source);
      const targetResources = this.findResourcesByChartId(chartRel.target);
      
      // Create relationships between resources
      for (const source of sourceResources) {
        for (const target of targetResources) {
          relationships.push({
            sourceId: source.id,
            targetId: target.id,
            type: ReferenceType.CHART_DEPENDENCY,
          });
        }
      }
    }
    
    // Add relationships from method calls
    for (const [chartName, chart] of this.analyzedCharts) {
      const createAppCalls = chart.methodCalls.filter(
        mc => mc.methodName === 'createApplication' || mc.methodName === 'createHelmApplication'
      );
      
      for (const call of createAppCalls) {
        // Extract ArgoCD app relationships
        if (call.arguments.length > 1) {
          const appName = this.extractStringLiteral(call.arguments[0]);
          if (appName) {
            // Find resources in this chart and mark them as managed by this ArgoCD app
            const resources = this.findResourcesByChartId(chartName);
            for (const resource of resources) {
                  // ArgoCD relationships are handled by the ArgoCD analysis in the base extractor
            }
          }
        }
      }
    }
    
    return relationships;
  }

  /**
   * Find resources by chart ID
   */
  private findResourcesByChartId(chartId: string): EnhancedExtractedResource[] {
    const resources: EnhancedExtractedResource[] = [];
    
    for (const resource of this.enhancedResources.values()) {
      if (resource.chartId === chartId || resource.chartId === this.normalizeChartId(chartId)) {
        resources.push(resource);
      }
    }
    
    return resources;
  }

  /**
   * Normalize chart ID for matching
   */
  private normalizeChartId(chartId: string): string {
    return chartId
      .replace(/Chart$/, '')
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
  }

  /**
   * Extract string literal from expression
   */
  private extractStringLiteral(expr: string): string | null {
    const match = expr.match(/^['"`](.*)['"`]$/);
    return match ? match[1] : null;
  }

  /**
   * Get all analyzed charts
   */
  public getAnalyzedCharts(): Map<string, AnalyzedChart> {
    return this.analyzedCharts;
  }

  /**
   * Generate enhanced metadata for Backstage entities
   */
  public generateEnhancedMetadata(resource: EnhancedExtractedResource): Record<string, any> {
    const metadata: Record<string, any> = {};
    
    // Add source location
    if (resource.sourceLocation) {
      metadata['backstage.io/source-location'] = `url:${this.getGitHubUrl(resource.sourceLocation.filePath)}`;
    }
    
    // Add documentation as annotations
    if (resource.documentation) {
      if (resource.documentation.description) {
        metadata['backstage.io/description'] = resource.documentation.description;
      }
      
      // Add JSDoc tags as annotations
      if (resource.documentation.tags) {
        for (const [tag, value] of Object.entries(resource.documentation.tags)) {
          metadata[`jsdoc/${tag}`] = value;
        }
      }
    }
    
    // Add type hierarchy
    if (resource.typeHierarchy) {
      metadata['cdk8s/type-hierarchy'] = resource.typeHierarchy.join(' -> ');
    }
    
    return metadata;
  }

  /**
   * Get GitHub URL for a file path
   */
  private getGitHubUrl(filePath: string): string {
    const relativePath = path.relative(this.projectRoot, filePath);
    return `https://github.com/PittampalliOrg/cdk8s-project/tree/main/${relativePath}`;
  }
}