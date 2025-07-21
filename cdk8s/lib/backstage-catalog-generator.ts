import { Construct } from 'constructs';
import { Chart, YamlOutputType } from 'cdk8s';
import * as fs from 'fs';
import * as path from 'path';
import { BackstageComponentConfig } from './backstage-kubernetes-resolver';

/**
 * Backstage catalog entity structure
 */
interface BackstageCatalogEntity {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    description?: string;
    annotations?: Record<string, string>;
    labels?: Record<string, string>;
    tags?: string[];
    links?: Array<{
      url: string;
      title: string;
      icon?: string;
    }>;
  };
  spec: {
    type?: string;
    lifecycle?: string;
    owner?: string;
    system?: string;
    dependsOn?: string[];
    providesApis?: string[];
    consumesApis?: string[];
  };
}

/**
 * Extended configuration for generating Backstage catalog entries
 */
export interface BackstageCatalogConfig extends BackstageComponentConfig {
  description?: string;
  type?: 'service' | 'website' | 'library' | 'documentation' | 'tool';
  lifecycle?: 'production' | 'experimental' | 'deprecated';
  tags?: string[];
  links?: Array<{
    url: string;
    title: string;
    icon?: string;
  }>;
  dependsOn?: string[];
  githubRepo?: string;
  argocdApp?: string;
}

/**
 * Generates Backstage catalog YAML files from CDK8s charts
 */
export class BackstageCatalogGenerator {
  private catalogEntries: BackstageCatalogEntity[] = [];
  private systems: Set<string> = new Set();

  /**
   * Add a component to the catalog
   */
  public addComponent(config: BackstageCatalogConfig): void {
    const componentAnnotations: Record<string, string> = {
      'backstage.io/kubernetes-id': config.componentName,
      'backstage.io/kubernetes-namespace': config.namespace,
    };

    // Add label selector if provided
    if (config.labelSelector) {
      componentAnnotations['backstage.io/kubernetes-label-selector'] = config.labelSelector;
    } else {
      // Default label selector based on app name
      const appName = config.componentName.split('-')[0];
      componentAnnotations['backstage.io/kubernetes-label-selector'] = `app=${appName}`;
    }

    // Add GitHub repo if provided
    if (config.githubRepo) {
      componentAnnotations['github.com/project-slug'] = config.githubRepo;
    }

    // Add ArgoCD app if provided
    if (config.argocdApp) {
      componentAnnotations['argocd/app-name'] = config.argocdApp;
    }

    const component: BackstageCatalogEntity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: config.componentName,
        description: config.description,
        annotations: componentAnnotations,
        tags: config.tags,
        links: config.links,
      },
      spec: {
        type: config.type || 'service',
        lifecycle: config.lifecycle || 'production',
        owner: config.owner || 'platform-team',
        system: config.system,
        dependsOn: config.dependsOn,
      },
    };

    this.catalogEntries.push(component);

    // Track systems
    if (config.system) {
      this.systems.add(config.system);
    }
  }

  /**
   * Add a system to the catalog
   */
  public addSystem(name: string, description: string, owner: string = 'platform-team'): void {
    const system: BackstageCatalogEntity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'System',
      metadata: {
        name,
        description,
      },
      spec: {
        owner,
      },
    };

    this.catalogEntries.push(system);
  }

  /**
   * Generate catalog entries from a Chart
   */
  public generateFromChart(chart: Chart, config: BackstageCatalogConfig): void {
    // Add the component
    this.addComponent(config);

    // If this is the first component in a system, create the system
    if (config.system && !this.systems.has(config.system)) {
      this.addSystem(
        config.system,
        `System containing ${config.system} components`,
        config.owner || 'platform-team'
      );
      this.systems.add(config.system);
    }
  }

  /**
   * Write the catalog to a YAML file
   */
  public writeCatalog(outputPath: string): void {
    // Convert to YAML manually
    const yamlContent = this.catalogEntries
      .map(entity => this.entityToYaml(entity))
      .join('\n---\n');

    const finalContent = `# Generated Backstage Catalog
# This file is auto-generated from CDK8s charts
# Generated at: ${new Date().toISOString()}
---
${yamlContent}`;

    fs.writeFileSync(outputPath, finalContent, 'utf8');
    console.log(`Backstage catalog written to: ${outputPath}`);
  }

  /**
   * Convert an entity to YAML format
   */
  private entityToYaml(entity: BackstageCatalogEntity): string {
    const lines: string[] = [];
    
    lines.push(`apiVersion: ${entity.apiVersion}`);
    lines.push(`kind: ${entity.kind}`);
    lines.push('metadata:');
    lines.push(`  name: ${entity.metadata.name}`);
    
    if (entity.metadata.description) {
      lines.push(`  description: ${entity.metadata.description}`);
    }
    
    if (entity.metadata.annotations && Object.keys(entity.metadata.annotations).length > 0) {
      lines.push('  annotations:');
      for (const [key, value] of Object.entries(entity.metadata.annotations)) {
        lines.push(`    ${key}: '${value}'`);
      }
    }
    
    if (entity.metadata.tags && entity.metadata.tags.length > 0) {
      lines.push('  tags:');
      entity.metadata.tags.forEach(tag => {
        lines.push(`    - ${tag}`);
      });
    }
    
    if (entity.metadata.links && entity.metadata.links.length > 0) {
      lines.push('  links:');
      entity.metadata.links.forEach(link => {
        lines.push(`    - url: ${link.url}`);
        lines.push(`      title: ${link.title}`);
        if (link.icon) {
          lines.push(`      icon: ${link.icon}`);
        }
      });
    }
    
    lines.push('spec:');
    if (entity.spec.type) lines.push(`  type: ${entity.spec.type}`);
    if (entity.spec.lifecycle) lines.push(`  lifecycle: ${entity.spec.lifecycle}`);
    if (entity.spec.owner) lines.push(`  owner: ${entity.spec.owner}`);
    if (entity.spec.system) lines.push(`  system: ${entity.spec.system}`);
    
    if (entity.spec.dependsOn && entity.spec.dependsOn.length > 0) {
      lines.push('  dependsOn:');
      entity.spec.dependsOn.forEach(dep => {
        lines.push(`    - ${dep}`);
      });
    }
    
    return lines.join('\n');
  }

  /**
   * Get catalog entries as an array
   */
  public getEntries(): BackstageCatalogEntity[] {
    return [...this.catalogEntries];
  }

  /**
   * Clear all entries
   */
  public clear(): void {
    this.catalogEntries = [];
    this.systems.clear();
  }

  /**
   * Create a standard set of catalog entries for common infrastructure
   */
  public static createStandardCatalog(): BackstageCatalogGenerator {
    const generator = new BackstageCatalogGenerator();

    // Add standard systems
    generator.addSystem('kubernetes-platform', 'Core Kubernetes platform components');
    generator.addSystem('application-stack', 'Application components and services');
    generator.addSystem('observability', 'Monitoring and observability stack');
    generator.addSystem('ci-cd', 'Continuous Integration and Deployment');

    return generator;
  }
}