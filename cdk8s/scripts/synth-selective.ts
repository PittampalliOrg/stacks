#!/usr/bin/env ts-node

import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { ChartFilter } from './chart-filter';

interface SynthOptions {
  charts?: string[];          // Specific chart names to synthesize
  includeApps?: boolean;      // Include ArgoCD applications
  includeCatalog?: boolean;   // Include Backstage catalog
  verbose?: boolean;
}

/**
 * This script provides selective synthesis by:
 * 1. Creating a temporary modified main.ts that only loads selected charts
 * 2. Running synthesis with the modified file
 * 3. Cleaning up
 * 
 * This approach avoids modifying the existing main.ts
 */
class SelectiveSynthesizer {
  private tempMainFile = path.join(this.projectRoot, 'main-temp.ts');
  
  constructor(
    private projectRoot: string,
    private options: SynthOptions
  ) {}

  async synthesize() {
    try {
      console.log('🎯 Starting selective synthesis...');
      
      if (!this.options.charts || this.options.charts.length === 0) {
        // No specific charts selected, run normal synthesis
        console.log('No specific charts selected, running full synthesis...');
        await this.runNormalSynthesis();
        return;
      }

      // Create modified main.ts
      await this.createSelectiveMain();
      
      // Backup and replace main.ts
      await this.swapMainFile();
      
      // Run synthesis
      await this.runSynthesis();
      
    } finally {
      // Always restore original main.ts
      await this.restoreMainFile();
    }
  }

  private async createSelectiveMain() {
    const mainPath = path.join(this.projectRoot, 'main.ts');
    const mainContent = fs.readFileSync(mainPath, 'utf-8');
    
    // Parse imports and chart creations
    const chartInfo = this.parseMainFile(mainContent);
    
    // Filter to only selected charts and their dependencies
    const selectedCharts = new Set(this.options.charts);
    const requiredCharts = this.getRequiredCharts(chartInfo, selectedCharts);
    
    console.log(`📋 Selected ${requiredCharts.size} charts (including dependencies)`);
    
    // Generate modified main.ts
    const modifiedContent = this.generateSelectiveMain(mainContent, chartInfo, requiredCharts);
    
    // Write temporary file
    fs.writeFileSync(this.tempMainFile, modifiedContent);
  }

  private parseMainFile(content: string): Map<string, ChartInfo> {
    const chartInfo = new Map<string, ChartInfo>();
    
    // Extract imports
    const importRegex = /import\s*{\s*(\w+)\s*}\s*from\s*['"]([^'"]+)['"]/g;
    const imports = new Map<string, string>();
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.set(match[1], match[2]);
    }
    
    // Extract chart instantiations and dependencies
    const instantiationRegex = /const\s+(\w+)\s*=\s*new\s+(\w+)\s*\(/g;
    const chartVars = new Map<string, string>(); // variable -> class name
    
    while ((match = instantiationRegex.exec(content)) !== null) {
      const varName = match[1];
      const className = match[2];
      chartVars.set(varName, className);
      
      if (className.endsWith('Chart')) {
        chartInfo.set(className, {
          className,
          varName,
          importPath: imports.get(className) || '',
          dependencies: new Set()
        });
      }
    }
    
    // Extract dependencies
    const depRegex = /(\w+)\.addDependency\((\w+)\)/g;
    while ((match = depRegex.exec(content)) !== null) {
      const sourceVar = match[1];
      const targetVar = match[2];
      
      const sourceClass = chartVars.get(sourceVar);
      const targetClass = chartVars.get(targetVar);
      
      if (sourceClass && targetClass && chartInfo.has(sourceClass)) {
        chartInfo.get(sourceClass)!.dependencies.add(targetClass);
      }
    }
    
    return chartInfo;
  }

  private getRequiredCharts(
    chartInfo: Map<string, ChartInfo>,
    selectedCharts: Set<string>
  ): Set<string> {
    const required = new Set<string>();
    const visited = new Set<string>();
    
    // Add dependencies recursively
    const addWithDeps = (chartName: string) => {
      if (visited.has(chartName)) return;
      visited.add(chartName);
      required.add(chartName);
      
      const info = chartInfo.get(chartName);
      if (info) {
        for (const dep of info.dependencies) {
          addWithDeps(dep);
        }
      }
    };
    
    // Start with selected charts
    for (const chart of selectedCharts) {
      addWithDeps(chart);
    }
    
    return required;
  }

  private generateSelectiveMain(
    originalContent: string,
    chartInfo: Map<string, ChartInfo>,
    requiredCharts: Set<string>
  ): string {
    let content = originalContent;
    
    // Add comment at the top
    content = '// AUTO-GENERATED: Selective synthesis version\n' + content;
    
    // Comment out imports for charts we don't need
    for (const [className, info] of chartInfo) {
      if (!requiredCharts.has(className)) {
        const importRegex = new RegExp(
          `import\\s*{\\s*${className}\\s*}\\s*from\\s*['"]${info.importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"];?`,
          'g'
        );
        content = content.replace(importRegex, '// $&');
      }
    }
    
    // Comment out instantiations for charts we don't need
    for (const [className, info] of chartInfo) {
      if (!requiredCharts.has(className)) {
        // Find the instantiation and comment out the entire block
        const varRegex = new RegExp(
          `const\\s+${info.varName}\\s*=\\s*new\\s+${className}[^;]+;`,
          'gs'
        );
        content = content.replace(varRegex, '// $&');
        
        // Comment out any addDependency calls
        const depRegex = new RegExp(
          `${info.varName}\\.addDependency\\([^)]+\\);`,
          'g'
        );
        content = content.replace(depRegex, '// $&');
      }
    }
    
    // Comment out app synthesis if not needed
    if (!this.options.includeApps) {
      content = content.replace(
        /\/\/ Now create a second app for Applications[\s\S]*?appOfApps\.synth\(\);/,
        '/* App of Apps synthesis disabled for selective mode */\n// $&'
      );
    }
    
    // Comment out Backstage catalog if not needed
    if (!this.options.includeCatalog) {
      content = content.replace(
        /\/\/ Now generate the Backstage catalog[\s\S]*?catalogApp\.synth\(\);/,
        '/* Backstage catalog disabled for selective mode */\n// $&'
      );
    }
    
    return content;
  }

  private async swapMainFile() {
    const mainPath = path.join(this.projectRoot, 'main.ts');
    const backupPath = path.join(this.projectRoot, 'main.ts.backup');
    
    // Backup original
    fs.copyFileSync(mainPath, backupPath);
    
    // Replace with modified version
    fs.copyFileSync(this.tempMainFile, mainPath);
  }

  private async restoreMainFile() {
    const mainPath = path.join(this.projectRoot, 'main.ts');
    const backupPath = path.join(this.projectRoot, 'main.ts.backup');
    
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, mainPath);
      fs.unlinkSync(backupPath);
    }
    
    if (fs.existsSync(this.tempMainFile)) {
      fs.unlinkSync(this.tempMainFile);
    }
  }

  private async runSynthesis(): Promise<void> {
    return new Promise((resolve, reject) => {
      const synthProcess = spawn('npm', ['run', 'synth'], {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });

      synthProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Synthesis failed with code ${code}`));
        }
      });

      synthProcess.on('error', reject);
    });
  }

  private async runNormalSynthesis(): Promise<void> {
    return this.runSynthesis();
  }
}

interface ChartInfo {
  className: string;
  varName: string;
  importPath: string;
  dependencies: Set<string>;
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const options: SynthOptions = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    includeApps: args.includes('--include-apps'),
    includeCatalog: args.includes('--include-catalog')
  };

  // Parse chart names
  const chartsIndex = args.indexOf('--charts');
  if (chartsIndex !== -1 && args[chartsIndex + 1]) {
    options.charts = args[chartsIndex + 1].split(',');
  }

  // Help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Selective CDK8s Synthesis

Usage: npm run synth:selective -- --charts <charts> [options]

Options:
  --charts <names>     Comma-separated list of chart class names to synthesize
  --include-apps       Include ArgoCD application synthesis
  --include-catalog    Include Backstage catalog generation
  --verbose, -v        Verbose output
  --help, -h           Show this help

Examples:
  # Synthesize only NextJS and Postgres charts
  npm run synth:selective -- --charts NextJsChart,PostgresChart
  
  # Synthesize with applications
  npm run synth:selective -- --charts NextJsChart --include-apps
`);
    process.exit(0);
  }

  const synthesizer = new SelectiveSynthesizer(process.cwd(), options);
  
  try {
    await synthesizer.synthesize();
    console.log('\n✅ Selective synthesis completed successfully!');
  } catch (error) {
    console.error('\n❌ Selective synthesis failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}