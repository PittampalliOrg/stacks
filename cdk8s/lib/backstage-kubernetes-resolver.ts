import { IResolver, ResolutionContext, ApiObject } from 'cdk8s';

/**
 * Configuration for Backstage component mapping
 */
export interface BackstageComponentConfig {
  componentName: string;
  namespace: string;
  labelSelector?: string;
  system?: string;
  owner?: string;
}

/**
 * Maps chart IDs to Backstage component configurations
 */
export interface BackstageChartMapping {
  [chartId: string]: BackstageComponentConfig;
}

/**
 * A CDK8s resolver that automatically adds Backstage-compatible labels to Kubernetes resources.
 * This ensures all resources have proper labels for Backstage Kubernetes plugin discovery.
 */
export class BackstageKubernetesResolver implements IResolver {
  private chartMappings: BackstageChartMapping;
  private processedPaths: Set<string> = new Set();

  constructor(chartMappings: BackstageChartMapping = {}) {
    this.chartMappings = chartMappings;
  }

  public resolve(context: ResolutionContext): void {
    // Only process ApiObject instances
    if (!(context.obj instanceof ApiObject)) {
      return;
    }

    // Skip if value is not an object or is null
    if (typeof context.value !== 'object' || context.value === null) {
      return;
    }

    const apiObject = context.obj as ApiObject;
    const kind = apiObject.kind;
    const chartId = apiObject.chart?.node.id;
    
    // Create a unique key for this context to prevent infinite recursion
    const contextKey = `${apiObject.node.path}:${context.key.join('.')}`;
    
    // Skip if we've already processed this path
    if (this.processedPaths.has(contextKey)) {
      return;
    }

    // Get the Backstage configuration for this chart
    const backstageConfig = chartId ? this.chartMappings[chartId] : undefined;
    
    // Only process specific paths we care about
    const keyPath = context.key.join('.');
    const isRelevantPath = 
      keyPath === 'spec.selector.matchLabels' ||
      keyPath === 'spec.template.metadata.labels' ||
      keyPath === 'metadata.annotations' ||
      keyPath === 'metadata.labels' ||
      keyPath === 'spec.selector';

    if (!isRelevantPath) {
      return;
    }

    // Mark this path as processed
    this.processedPaths.add(contextKey);

    // Process based on resource kind
    switch (kind) {
      case 'Deployment':
      case 'StatefulSet':
      case 'DaemonSet':
        this.processWorkloadResource(context, backstageConfig);
        break;
      case 'Service':
        this.processServiceResource(context, backstageConfig);
        break;
      case 'Ingress':
        this.processIngressResource(context, backstageConfig);
        break;
      case 'ConfigMap':
      case 'Secret':
        this.processConfigResource(context, backstageConfig);
        break;
    }
  }

  private processWorkloadResource(context: ResolutionContext, backstageConfig?: BackstageComponentConfig): void {
    if (!backstageConfig) return;
    
    const keyPath = context.key.join('.');
    
    if (keyPath === 'spec.selector.matchLabels' && context.value) {
      const labels = { ...(context.value as Record<string, string>) };
      
      // Ensure 'app' label exists
      if (!labels.app) {
        labels.app = this.extractAppName(backstageConfig.componentName);
        context.replaceValue(labels);
      }
    }

    if (keyPath === 'spec.template.metadata.labels' && context.value) {
      const labels = { ...(context.value as Record<string, string>) };
      const appName = this.extractAppName(backstageConfig.componentName);
      
      // Only add labels that don't exist
      const updatedLabels = {
        ...labels,
        app: labels.app || appName,
        'app.kubernetes.io/name': labels['app.kubernetes.io/name'] || appName,
        'app.kubernetes.io/component': labels['app.kubernetes.io/component'] || backstageConfig.componentName,
        'app.kubernetes.io/part-of': labels['app.kubernetes.io/part-of'] || backstageConfig.system || 'application',
        'backstage.io/kubernetes-id': backstageConfig.componentName
      };

      context.replaceValue(updatedLabels);
    }

    // Add annotations for Backstage
    if (keyPath === 'metadata.annotations') {
      const annotations = { ...(context.value as Record<string, string> || {}) };
      
      annotations['backstage.io/kubernetes-namespace'] = backstageConfig.namespace;
      annotations['backstage.io/kubernetes-component'] = backstageConfig.componentName;
      
      context.replaceValue(annotations);
    }
  }

  private processServiceResource(context: ResolutionContext, backstageConfig?: BackstageComponentConfig): void {
    if (!backstageConfig) return;
    
    const keyPath = context.key.join('.');
    
    if (keyPath === 'spec.selector' && context.value) {
      const selector = { ...(context.value as Record<string, string>) };
      
      // Ensure service selector matches pod labels
      if (!selector.app) {
        selector.app = this.extractAppName(backstageConfig.componentName);
        context.replaceValue(selector);
      }
    }

    // Add metadata labels
    if (keyPath === 'metadata.labels') {
      const labels = { ...(context.value as Record<string, string> || {}) };
      const appName = this.extractAppName(backstageConfig.componentName);
      
      labels.app = labels.app || appName;
      labels['app.kubernetes.io/name'] = labels['app.kubernetes.io/name'] || appName;
      labels['backstage.io/kubernetes-id'] = backstageConfig.componentName;
      
      context.replaceValue(labels);
    }
  }

  private processIngressResource(context: ResolutionContext, backstageConfig?: BackstageComponentConfig): void {
    if (!backstageConfig) return;
    
    const keyPath = context.key.join('.');
    
    if (keyPath === 'metadata.labels') {
      const labels = { ...(context.value as Record<string, string> || {}) };
      const appName = this.extractAppName(backstageConfig.componentName);
      
      labels.app = labels.app || appName;
      labels['app.kubernetes.io/name'] = labels['app.kubernetes.io/name'] || appName;
      labels['backstage.io/kubernetes-id'] = backstageConfig.componentName;
      
      context.replaceValue(labels);
    }
  }

  private processConfigResource(context: ResolutionContext, backstageConfig?: BackstageComponentConfig): void {
    if (!backstageConfig) return;
    
    const keyPath = context.key.join('.');
    
    if (keyPath === 'metadata.labels') {
      const labels = { ...(context.value as Record<string, string> || {}) };
      const appName = this.extractAppName(backstageConfig.componentName);
      
      labels.app = labels.app || appName;
      labels['app.kubernetes.io/name'] = labels['app.kubernetes.io/name'] || appName;
      labels['app.kubernetes.io/component'] = backstageConfig.componentName;
      
      context.replaceValue(labels);
    }
  }

  /**
   * Extract a simple app name from a component name
   * e.g., "nextjs-application" -> "nextjs"
   */
  private extractAppName(componentName: string): string {
    return componentName.split('-')[0] || componentName;
  }

  /**
   * Update the chart mappings dynamically
   */
  public addChartMapping(chartId: string, config: BackstageComponentConfig): void {
    this.chartMappings[chartId] = config;
  }
}