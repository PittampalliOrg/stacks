import { Chart, ChartProps, ApiObject, App } from 'cdk8s';
import { Construct } from 'constructs';
import { BackstageChartMapping, BackstageComponentConfig } from './backstage-kubernetes-resolver';
import { BackstageCrdEntityGenerator, CrdEntityConfig } from './backstage-crd-entity-generator';
import { Cdk8sRelationshipExtractor } from './cdk8s-relationship-extractor';
import { BackstageDeterministicCatalogGenerator, DeterministicCatalogConfig } from './backstage-deterministic-catalog-generator';

/**
 * Interface for Backstage catalog entity
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
 * Extended configuration for catalog generation
 */
export interface BackstageCatalogChartProps extends ChartProps {
  /**
   * The main CDK8s App instance (required)
   */
  mainApp: App;
  /**
   * Configuration file path for custom metadata (optional)
   */
  configPath?: string;
  /**
   * Override deterministic configuration (optional)
   */
  deterministicConfig?: DeterministicCatalogConfig;
  
  // Legacy options (deprecated - will be removed in future versions)
  /**
   * @deprecated Use configPath instead
   */
  chartMappings?: BackstageChartMapping;
  /**
   * @deprecated All components are now discovered automatically
   */
  additionalComponents?: Array<{
    config: BackstageComponentConfig;
    description?: string;
    type?: string;
    lifecycle?: string;
    tags?: string[];
    links?: Array<{ url: string; title: string; icon?: string }>;
    dependsOn?: string[];
    githubRepo?: string;
    argocdApp?: string;
  }>;
  /**
   * @deprecated CRD classes are now discovered automatically
   */
  crdClasses?: any[];
  /**
   * @deprecated Use configPath instead
   */
  customCrdConfigs?: Record<string, Partial<CrdEntityConfig>>;
  /**
   * @deprecated Deterministic mode is now the default
   */
  deterministicMode?: boolean;
}

/**
 * A CDK8s Chart that generates Backstage catalog entries instead of Kubernetes resources.
 * This allows us to use the same synthesis process to generate both K8s manifests and Backstage catalog.
 */
export class BackstageCatalogChart extends Chart {
  private systems: Set<string> = new Set();
  private entities: ApiObject[] = [];
  private crdGenerator?: BackstageCrdEntityGenerator;

  constructor(scope: Construct, id: string, props: BackstageCatalogChartProps) {
    super(scope, id, props);

    // Load configuration from file if provided
    const config = this.loadConfiguration(props.configPath);
    
    // Merge config with provided deterministicConfig
    const deterministicConfig: DeterministicCatalogConfig = {
      ...config,
      ...props.deterministicConfig,
    };

    // Always use deterministic mode with the main app
    this.generateDeterministicCatalog(props.mainApp, deterministicConfig);

    // Handle deprecated options if provided (for backward compatibility)
    if (props.chartMappings || props.additionalComponents || props.crdClasses) {
      console.warn('⚠️  Using deprecated Backstage catalog options. These will be removed in future versions.');
      console.warn('   All entities are now discovered automatically from the CDK8s construct tree.');
    }
  }

  /**
   * Create standard Backstage systems
   */
  private createStandardSystems(): void {
    const standardSystems = [
      { name: 'kubernetes-platform', description: 'Core Kubernetes platform components' },
      { name: 'application-stack', description: 'Application components and services' },
      { name: 'observability', description: 'Monitoring and observability stack' },
      { name: 'ci-cd', description: 'Continuous Integration and Deployment' },
      { name: 'platform', description: 'Platform infrastructure and tools' },
      { name: 'gitops-resources', description: 'GitOps custom resources and configurations' },
      { name: 'security-resources', description: 'Security-related custom resources' },
      { name: 'delivery-resources', description: 'Continuous delivery custom resources' },
      { name: 'ai-resources', description: 'AI and ML custom resources' },
    ];

    standardSystems.forEach(system => {
      this.createSystem(system.name, system.description);
    });
  }

  /**
   * Create components from chart mappings
   */
  private createComponentsFromMappings(mappings: BackstageChartMapping): void {
    // Define extended metadata for known components
    const componentMetadata: Record<string, any> = {
      'nextjs': {
        description: 'Main NextJS Application with Kubernetes resources',
        type: 'service',
        tags: ['frontend', 'nextjs', 'typescript'],
        links: [
          { url: 'http://localtest.me', title: 'Application URL', icon: 'web' },
          { url: 'https://github.com/PittampalliOrg/chat', title: 'Source Code', icon: 'github' }
        ],
        githubRepo: 'PittampalliOrg/chat',
        argocdApp: 'nextjs',
        dependsOn: ['component:redis-cache', 'resource:postgres-database']
      },
      'redis': {
        description: 'Redis cache service for NextJS applications',
        type: 'service',
        tags: ['cache', 'redis', 'database'],
        links: [
          { url: 'redis://redis-service.nextjs.svc.cluster.local:6379', title: 'Redis Connection', icon: 'storage' }
        ]
      },
      'claudecodeui': {
        description: 'Claude Code UI application deployed in Kubernetes',
        type: 'website',
        tags: ['frontend', 'ui', 'claude'],
        links: [
          { url: 'http://claudecodeui.localtest.me', title: 'Application URL', icon: 'web' }
        ],
        argocdApp: 'claudecodeui'
      },
      'flagd-ui-nextjs': {
        description: 'Feature Flag Management UI',
        type: 'website',
        tags: ['feature-flags', 'ui', 'management'],
        links: [
          { url: 'http://flagd.localtest.me', title: 'Flagd UI', icon: 'flag' }
        ]
      },
      'backstage': {
        description: 'Backstage Developer Portal with Kubernetes integration',
        type: 'website',
        tags: ['portal', 'backstage', 'developer-experience'],
        links: [
          { url: 'http://backstage.localtest.me', title: 'Backstage Portal', icon: 'dashboard' },
          { url: 'https://github.com/PittampalliOrg/backstage', title: 'Source Code', icon: 'github' }
        ],
        githubRepo: 'PittampalliOrg/backstage',
        argocdApp: 'backstage'
      }
    };

    // Create components from mappings
    Object.entries(mappings).forEach(([chartId, config]) => {
      const metadata = componentMetadata[chartId] || {};
      this.createComponent({
        ...config,
        ...metadata
      });
    });
  }

  /**
   * Create a Backstage system entity
   */
  private createSystem(name: string, description: string, owner: string = 'platform-team'): void {
    const system = new ApiObject(this, `system-${name}`, {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'System',
      metadata: {
        name,
        description,
      },
      spec: {
        owner,
      },
    });

    this.entities.push(system);
    this.systems.add(name);
  }

  /**
   * Create a Backstage component entity
   */
  private createComponent(config: any): void {
    const annotations: Record<string, string> = {
      'backstage.io/kubernetes-id': config.componentName,
      'backstage.io/kubernetes-namespace': config.namespace,
      'backstage.io/kubernetes-label-selector': config.labelSelector || `app=${config.componentName.split('-')[0]}`,
    };

    if (config.githubRepo) {
      annotations['github.com/project-slug'] = config.githubRepo;
    }

    if (config.argocdApp) {
      annotations['argocd/app-name'] = config.argocdApp;
    }

    const component = new ApiObject(this, `component-${config.componentName}`, {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: config.componentName,
        description: config.description,
        annotations,
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
    });

    this.entities.push(component);

    // Create system if it doesn't exist
    if (config.system && !this.systems.has(config.system)) {
      this.createSystem(
        config.system,
        `System containing ${config.system} components`,
        config.owner || 'platform-team'
      );
    }
  }

  /**
   * Add external resource (like databases)
   */
  public addExternalResource(name: string, description: string, type: string = 'database'): void {
    const resource = new ApiObject(this, `resource-${name}`, {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name,
        description,
        annotations: {
          'backstage.io/kubernetes-id': name,
          'backstage.io/kubernetes-namespace': 'external',
          'backstage.io/kubernetes-label-selector': `app=${name}`,
        },
        tags: [type, 'external'],
      },
      spec: {
        type: 'service',
        lifecycle: 'production',
        owner: 'platform-team',
        system: 'application-stack',
      },
    });

    this.entities.push(resource);
  }

  /**
   * Generate CRD entities using the CRD entity generator
   */
  private generateCrdEntities(crdClasses: any[], customConfigs?: Record<string, Partial<CrdEntityConfig>>): void {
    // Initialize the CRD generator
    this.crdGenerator = new BackstageCrdEntityGenerator(this, customConfigs);

    // Generate entities for all provided CRD classes
    const crdEntities = this.crdGenerator.generateCrdEntities(crdClasses, customConfigs);
    
    // Add generated entities to our entities list
    this.entities.push(...crdEntities);

    // Create any new systems that were referenced by the CRD entities
    const generatedSystems = this.crdGenerator.getGeneratedSystems();
    generatedSystems.forEach(systemName => {
      // Only create if not already created
      if (!this.systems.has(systemName)) {
        // Use default descriptions for now
        const systemDescriptions: Record<string, string> = {
          'gitops-resources': 'GitOps custom resources and configurations',
          'security-resources': 'Security-related custom resources',
          'delivery-resources': 'Continuous delivery custom resources',
          'ai-resources': 'AI and ML custom resources',
        };
        
        this.createSystem(
          systemName,
          systemDescriptions[systemName] || `System for ${systemName}`,
          'platform-team'
        );
      }
    });
  }

  /**
   * Load configuration from JSON file
   */
  private loadConfiguration(configPath?: string): DeterministicCatalogConfig {
    const fs = require('fs');
    const path = require('path');
    
    // Default config path
    const defaultPath = path.join(process.cwd(), 'backstage-catalog-config.json');
    const configFile = configPath || defaultPath;
    
    // Return empty config if file doesn't exist
    if (!fs.existsSync(configFile)) {
      return {
        defaultOwner: 'platform-team',
        includeCharts: true,
        includeCrdTypes: true,
      };
    }
    
    try {
      const configData = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      return {
        defaultOwner: configData.defaultOwner || 'platform-team',
        chartMetadata: configData.chartMetadata || {},
        includeCharts: true,
        includeCrdTypes: true,
        // Note: CRD metadata will be handled differently in the generator
      };
    } catch (error) {
      console.warn(`⚠️  Failed to load Backstage catalog config from ${configFile}:`, error);
      return {
        defaultOwner: 'platform-team',
        includeCharts: true,
        includeCrdTypes: true,
      };
    }
  }

  /**
   * Generate catalog deterministically from the CDK8s construct tree
   */
  private generateDeterministicCatalog(mainApp: App, config?: DeterministicCatalogConfig): void {
    // Create the relationship extractor
    const extractor = new Cdk8sRelationshipExtractor(mainApp);
    
    // Create the deterministic catalog generator
    const generator = new BackstageDeterministicCatalogGenerator(this, extractor, config);
    
    // Generate all entities
    const generatedEntities = generator.generate();
    
    // Add all generated entities to our entities list
    this.entities.push(...generatedEntities);
    
    // Track systems for consistency
    generatedEntities.forEach(entity => {
      if (entity.kind === 'System') {
        this.systems.add(entity.metadata?.name || 'unknown');
      }
    });
  }
}