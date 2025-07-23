// CDK8s Main Application with Selective Synthesis Support
import { App, YamlOutputType } from 'cdk8s';
import { EnvironmentResolver } from './lib/environment-resolver';
import { ChartRegistry } from './lib/chart-registry';
import { BackstageCatalogChart } from './lib/backstage-catalog-chart';

// Initialize the chart registry with all available charts
ChartRegistry.initialize();

async function main() {
  const outputDir = 'dist';
  
  // Create app with environment resolver
  const app = new App({
    resolvers: [new EnvironmentResolver()],
    yamlOutputType: YamlOutputType.FOLDER_PER_CHART_FILE_PER_RESOURCE,
    outdir: outputDir,
  });

  // Check if we're in selective synthesis mode
  const isSelectiveSynthesis = ChartRegistry.isSelectiveSynthesis();
  const selectedCharts = ChartRegistry.getChartsToSynthesize();
  
  if (isSelectiveSynthesis && selectedCharts) {
    console.log('🎯 Selective synthesis enabled');
    console.log(`📋 Selected charts: ${selectedCharts.join(', ')}`);
    
    // Collect all charts that need to be synthesized (including dependencies)
    const chartsToSynthesize = new Set<string>();
    
    for (const chartName of selectedCharts) {
      chartsToSynthesize.add(chartName);
      
      // Add all dependencies
      const deps = ChartRegistry.getTransitiveDependencies(chartName);
      deps.forEach(dep => chartsToSynthesize.add(dep));
    }
    
    console.log(`🔗 Including dependencies: ${chartsToSynthesize.size} total charts`);
    
    // Create only the selected charts and their dependencies
    for (const chartName of chartsToSynthesize) {
      await createChart(app, chartName);
    }
  } else {
    console.log('📁 Full synthesis mode - creating all charts');
    
    // Create all charts in dependency order
    await createAllCharts(app);
  }

  // Synthesize the main app
  console.log('\n🔨 Synthesizing main application...');
  app.synth();

  // Create applications if not in selective mode or if app charts are selected
  if (!isSelectiveSynthesis || shouldCreateApplications(selectedCharts)) {
    await createApplications(outputDir);
  }

  // Create Backstage catalog if not in selective mode
  if (!isSelectiveSynthesis) {
    await createBackstageCatalog(app, outputDir);
  }

  console.log('\n✅ Synthesis complete!');
}

async function createChart(app: App, chartName: string): Promise<void> {
  const existing = ChartRegistry.getInstance(chartName);
  if (existing) return; // Already created

  const registration = ChartRegistry.getRegistration(chartName);
  if (!registration) {
    console.warn(`⚠️  Chart ${chartName} not found in registry`);
    return;
  }

  // Create dependencies first
  for (const dep of registration.dependencies || []) {
    await createChart(app, dep);
  }

  // Create the chart
  console.log(`  Creating ${chartName}...`);
  
  // Get dependency instances for props
  const props: any = {};
  if (registration.dependencies) {
    for (const dep of registration.dependencies) {
      const depInstance = ChartRegistry.getInstance(dep);
      if (depInstance) {
        // Simple heuristic: if dep name is in props, use it
        const propName = dep.charAt(0).toLowerCase() + dep.slice(1).replace('Chart', '');
        props[propName] = depInstance;
      }
    }
  }

  await ChartRegistry.loadChart(chartName, app, chartName.replace('Chart', '').toLowerCase(), props);
}

async function createAllCharts(app: App): Promise<void> {
  // This is a simplified version - in reality, you'd need to handle all the charts
  // and their specific dependencies as in the original main.ts
  
  const chartNames = ChartRegistry.getAllChartNames();
  const created = new Set<string>();
  
  // Create charts in dependency order
  const createWithDeps = async (chartName: string) => {
    if (created.has(chartName)) return;
    
    const deps = ChartRegistry.getDependencies(chartName);
    for (const dep of deps) {
      await createWithDeps(dep);
    }
    
    await createChart(app, chartName);
    created.add(chartName);
  };
  
  for (const chartName of chartNames) {
    await createWithDeps(chartName);
  }
}

function shouldCreateApplications(selectedCharts: string[] | null): boolean {
  if (!selectedCharts) return true;
  
  // Check if any application charts are selected
  return selectedCharts.some(chart => 
    chart.includes('App') || 
    chart.includes('application')
  );
}

async function createApplications(outputDir: string): Promise<void> {
  console.log('\n📦 Creating ArgoCD Applications...');
  
  const appOfApps = new App({
    yamlOutputType: YamlOutputType.FOLDER_PER_CHART_FILE_PER_RESOURCE,
    outdir: outputDir + '/apps',
    resolvers: [new EnvironmentResolver()]
  });

  // Create application charts
  // This is a simplified version - you'd need to handle all app charts
  
  appOfApps.synth();
}

async function createBackstageCatalog(mainApp: App, outputDir: string): Promise<void> {
  console.log('\n📚 Generating Backstage catalog...');
  
  const catalogApp = new App({
    outdir: outputDir + '/backstage-catalog',
    yamlOutputType: YamlOutputType.FILE_PER_CHART,
  });

  new BackstageCatalogChart(catalogApp, 'backstage-catalog', {
    mainApp: mainApp,
  });

  catalogApp.synth();
}

// Execute main function
main().catch((error) => {
  console.error('❌ Synthesis failed:', error);
  process.exit(1);
});

export { ChartRegistry };