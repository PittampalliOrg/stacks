import { Chart } from 'cdk8s';
import { Construct } from 'constructs';

export interface ChartRegistration {
  name: string;
  importPath: string;
  className: string;
  dependencies?: string[];
  phase?: number;
}

export class ChartRegistry {
  private static registrations: Map<string, ChartRegistration> = new Map();
  private static instances: Map<string, Chart> = new Map();
  private static loadedModules: Map<string, any> = new Map();

  // Register all available charts
  static initialize() {
    // Platform foundation charts
    this.register({
      name: 'PlatformPrerequisitesChart',
      importPath: './charts/platform-prerequisites-chart',
      className: 'PlatformPrerequisitesChart',
      phase: 0
    });

    this.register({
      name: 'ArgoCDConfigChart',
      importPath: './charts/argocd-config-chart',
      className: 'ArgoCDConfigChart',
      dependencies: ['PlatformPrerequisitesChart'],
      phase: 0.5
    });

    this.register({
      name: 'ArgoCDWebhookConfigChart',
      importPath: './charts/argocd-webhook-config',
      className: 'ArgoCDWebhookConfigChart',
      dependencies: ['ArgoCDConfigChart'],
      phase: 0.5
    });

    this.register({
      name: 'BootstrapSecretsChart',
      importPath: './charts/bootstrap-secrets-chart',
      className: 'BootstrapSecretsChart',
      dependencies: ['ArgoCDConfigChart'],
      phase: 0.6
    });

    this.register({
      name: 'PlatformCoreChart',
      importPath: './charts/platform-core-chart',
      className: 'PlatformCoreChart',
      dependencies: ['BootstrapSecretsChart'],
      phase: 1
    });

    this.register({
      name: 'InfrastructureAppsChart',
      importPath: './charts/infrastructure-apps-chart',
      className: 'InfrastructureAppsChart',
      dependencies: ['PlatformCoreChart'],
      phase: 1.5
    });

    this.register({
      name: 'CertManagerIssuersChart',
      importPath: './charts/cert-manager-issuers-chart',
      className: 'CertManagerIssuersChart',
      dependencies: ['PlatformCoreChart'],
      phase: 1.5
    });

    this.register({
      name: 'AllSecretsChart',
      importPath: './charts/all-secrets-chart',
      className: 'AllSecretsChart',
      dependencies: ['InfrastructureAppsChart'],
      phase: 2
    });

    // Infrastructure secrets
    this.register({
      name: 'InfraSecretsChart',
      importPath: './charts/infra-secrets-chart',
      className: 'InfraSecretsChart',
      dependencies: ['InfrastructureAppsChart'],
      phase: 6
    });

    // Application stack
    this.register({
      name: 'AppStackSecretsChart',
      importPath: './charts/app-stack-secrets-chart',
      className: 'AppStackSecretsChart',
      dependencies: ['InfraSecretsChart'],
      phase: 12
    });

    this.register({
      name: 'PostgresChart',
      importPath: './charts/postgres-chart',
      className: 'PostgresChart',
      dependencies: ['AppStackSecretsChart'],
      phase: 12.1
    });

    this.register({
      name: 'RedisChart',
      importPath: './charts/redis-chart',
      className: 'RedisChart',
      dependencies: ['InfraSecretsChart'],
      phase: 12.1
    });

    this.register({
      name: 'NextJsChart',
      importPath: './charts/nextjs-chart',
      className: 'NextJsChart',
      dependencies: ['PostgresChart', 'RedisChart'],
      phase: 13
    });

    this.register({
      name: 'NextJsFeatureFlagsChart',
      importPath: './charts/nextjs-feature-flags-chart',
      className: 'NextJsFeatureFlagsChart',
      dependencies: ['NextJsChart'],
      phase: 13.1
    });

    // Add more chart registrations as needed...
    // This is a partial list for demonstration
  }

  private static register(registration: ChartRegistration) {
    this.registrations.set(registration.name, registration);
  }

  static async loadChart(chartName: string, scope: Construct, id: string, props?: any): Promise<Chart | null> {
    // Check if already instantiated
    if (this.instances.has(chartName)) {
      return this.instances.get(chartName)!;
    }

    const registration = this.registrations.get(chartName);
    if (!registration) {
      console.warn(`Chart ${chartName} not found in registry`);
      return null;
    }

    try {
      // Dynamic import
      let module = this.loadedModules.get(registration.importPath);
      if (!module) {
        module = await import(registration.importPath);
        this.loadedModules.set(registration.importPath, module);
      }

      const ChartClass = module[registration.className];
      if (!ChartClass) {
        console.error(`Class ${registration.className} not found in module ${registration.importPath}`);
        return null;
      }

      // Create instance
      const instance = new ChartClass(scope, id, props);
      this.instances.set(chartName, instance);

      return instance;
    } catch (error) {
      console.error(`Failed to load chart ${chartName}:`, error);
      return null;
    }
  }

  static getRegistration(chartName: string): ChartRegistration | undefined {
    return this.registrations.get(chartName);
  }

  static getAllChartNames(): string[] {
    return Array.from(this.registrations.keys());
  }

  static getChartsByPhase(phase: number): string[] {
    return Array.from(this.registrations.entries())
      .filter(([_, reg]) => reg.phase === phase)
      .map(([name, _]) => name);
  }

  static getDependencies(chartName: string): string[] {
    const registration = this.registrations.get(chartName);
    return registration?.dependencies || [];
  }

  static getInstance(chartName: string): Chart | undefined {
    return this.instances.get(chartName);
  }

  // Get all transitive dependencies for a chart
  static getTransitiveDependencies(chartName: string, visited: Set<string> = new Set()): string[] {
    if (visited.has(chartName)) return [];
    visited.add(chartName);

    const dependencies: string[] = [];
    const directDeps = this.getDependencies(chartName);

    for (const dep of directDeps) {
      dependencies.push(dep);
      const transitiveDeps = this.getTransitiveDependencies(dep, visited);
      dependencies.push(...transitiveDeps);
    }

    return dependencies;
  }

  // Check if selective synthesis is enabled
  static isSelectiveSynthesis(): boolean {
    return process.env.CDK8S_SELECTIVE_SYNTHESIS === 'true';
  }

  // Get charts to synthesize based on environment variable
  static getChartsToSynthesize(): string[] | null {
    const chartsEnv = process.env.CDK8S_CHARTS;
    if (!chartsEnv) return null;

    return chartsEnv.split(',').map((s: string) => s.trim()).filter((s: string) => s);
  }

  // Determine if a chart should be synthesized
  static shouldSynthesizeChart(chartName: string): boolean {
    if (!this.isSelectiveSynthesis()) return true;

    const selectedCharts = this.getChartsToSynthesize();
    if (!selectedCharts) return true;

    // Check if this chart or any of its dependencies are selected
    if (selectedCharts.includes(chartName)) return true;

    // Check if any selected chart depends on this one
    for (const selected of selectedCharts) {
      const deps = this.getTransitiveDependencies(selected);
      if (deps.includes(chartName)) return true;
    }

    return false;
  }

  // Clear all instances (useful for testing)
  static clear() {
    this.instances.clear();
    this.loadedModules.clear();
  }
}