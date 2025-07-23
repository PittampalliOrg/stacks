#!/usr/bin/env ts-node

import { TypeScriptAstAnalyzer, AnalyzedChart, ChartRelationship } from '../lib/typescript-ast-analyzer';
import * as path from 'path';
import * as fs from 'fs';
const glob = require('glob').glob;
import * as crypto from 'crypto';

interface DependencyGraph {
  charts: Map<string, ChartNode>;
  relationships: ChartRelationship[];
  lastUpdated: Date;
  fileHashes: Map<string, string>;
}

interface ChartNode {
  name: string;
  filePath: string;
  dependencies: Set<string>;
  dependents: Set<string>;
  imports: Set<string>;
  analyzedData?: AnalyzedChart;
}

interface AnalyzerOptions {
  projectRoot: string;
  chartsDir: string;
  outputPath?: string;
  format?: 'json' | 'mermaid' | 'graphviz';
  includeLibDeps?: boolean;
  verbose?: boolean;
}

class DependencyAnalyzer {
  private astAnalyzer: TypeScriptAstAnalyzer;
  private graph: DependencyGraph;
  private options: AnalyzerOptions;

  constructor(options: AnalyzerOptions) {
    this.options = options;
    this.astAnalyzer = new TypeScriptAstAnalyzer(options.projectRoot);
    this.graph = {
      charts: new Map(),
      relationships: [],
      lastUpdated: new Date(),
      fileHashes: new Map()
    };
  }

  async analyze(): Promise<DependencyGraph> {
    console.log('🔍 Analyzing CDK8s chart dependencies...');
    
    // Find all chart files
    const chartFiles = await this.findChartFiles();
    console.log(`📁 Found ${chartFiles.length} chart files`);

    // Analyze all charts using AST
    const analyzedCharts = await this.astAnalyzer.analyzeCharts(chartFiles);
    console.log(`🔬 Analyzed ${analyzedCharts.size} charts`);

    // Build the dependency graph
    this.buildDependencyGraph(analyzedCharts);

    // Analyze main.ts for runtime dependencies
    await this.analyzeMainFile();

    // Calculate file hashes for cache invalidation
    await this.calculateFileHashes(chartFiles);

    if (this.options.verbose) {
      this.printSummary();
    }

    return this.graph;
  }

  private async findChartFiles(): Promise<string[]> {
    const pattern = path.join(this.options.chartsDir, '**/*.ts');
    const files = await glob(pattern, {
      ignore: ['**/*.test.ts', '**/*.d.ts', '**/node_modules/**']
    });
    return files.map((f: string) => path.resolve(f));
  }

  private buildDependencyGraph(analyzedCharts: Map<string, AnalyzedChart>) {
    // First pass: Create all nodes
    for (const [className, chart] of analyzedCharts) {
      const node: ChartNode = {
        name: className,
        filePath: chart.filePath,
        dependencies: new Set(),
        dependents: new Set(),
        imports: new Set(),
        analyzedData: chart
      };

      // Add import dependencies
      for (const imp of chart.imports) {
        if (imp.isChartImport) {
          imp.namedImports.forEach(name => {
            if (name !== className && name.endsWith('Chart')) {
              node.imports.add(name);
            }
          });
        }
      }

      this.graph.charts.set(className, node);
    }

    // Second pass: Build relationships
    const relationships = this.astAnalyzer.getChartRelationships();
    for (const rel of relationships) {
      // Skip if either source or target doesn't exist
      const sourceNode = this.graph.charts.get(rel.source);
      const targetNode = this.graph.charts.get(rel.target);
      
      if (sourceNode && targetNode) {
        sourceNode.dependencies.add(rel.target);
        targetNode.dependents.add(rel.source);
        this.graph.relationships.push(rel);
      }
    }
  }

  private async analyzeMainFile() {
    const mainPath = path.join(this.options.projectRoot, 'main.ts');
    if (!fs.existsSync(mainPath)) {
      console.warn('⚠️  main.ts not found, skipping runtime dependency analysis');
      return;
    }

    const content = fs.readFileSync(mainPath, 'utf-8');
    
    // Extract variable assignments for charts
    const chartVariables = new Map<string, string>();
    const varPattern = /const\s+(\w+)\s*=\s*new\s+(\w+Chart)\s*\(/g;
    let match;
    while ((match = varPattern.exec(content)) !== null) {
      chartVariables.set(match[1], match[2]);
    }

    // Extract addDependency calls
    const depPattern = /(\w+)\.addDependency\((\w+)\)/g;
    while ((match = depPattern.exec(content)) !== null) {
      const sourceVar = match[1];
      const targetVar = match[2];
      
      const sourceChart = chartVariables.get(sourceVar);
      const targetChart = chartVariables.get(targetVar);
      
      if (sourceChart && targetChart) {
        const sourceNode = this.graph.charts.get(sourceChart);
        const targetNode = this.graph.charts.get(targetChart);
        
        if (sourceNode && targetNode) {
          sourceNode.dependencies.add(targetChart);
          targetNode.dependents.add(sourceChart);
          
          // Add to relationships if not already there
          const exists = this.graph.relationships.some(
            r => r.source === sourceChart && r.target === targetChart && r.type === 'explicit-dependency'
          );
          if (!exists) {
            this.graph.relationships.push({
              source: sourceChart,
              target: targetChart,
              type: 'explicit-dependency',
              isOptional: false
            });
          }
        }
      }
    }
  }

  private async calculateFileHashes(files: string[]) {
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      this.graph.fileHashes.set(file, hash);
    }

    // Also hash lib files if they're dependencies
    if (this.options.includeLibDeps) {
      const libDir = path.join(this.options.projectRoot, 'lib');
      const libFiles = await glob(path.join(libDir, '**/*.ts'), {
        ignore: ['**/*.test.ts', '**/*.d.ts']
      });
      
      for (const file of libFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        this.graph.fileHashes.set(file, hash);
      }
    }
  }

  private printSummary() {
    console.log('\n📊 Dependency Analysis Summary:');
    console.log(`   Total charts: ${this.graph.charts.size}`);
    console.log(`   Total relationships: ${this.graph.relationships.length}`);
    
    // Find charts with most dependencies
    const sortedByDeps = Array.from(this.graph.charts.entries())
      .sort((a, b) => b[1].dependencies.size - a[1].dependencies.size)
      .slice(0, 5);
    
    console.log('\n   📦 Charts with most dependencies:');
    for (const [name, node] of sortedByDeps) {
      if (node.dependencies.size > 0) {
        console.log(`      ${name}: ${node.dependencies.size} dependencies`);
      }
    }

    // Find charts with most dependents
    const sortedByDependents = Array.from(this.graph.charts.entries())
      .sort((a, b) => b[1].dependents.size - a[1].dependents.size)
      .slice(0, 5);
    
    console.log('\n   🎯 Most depended-upon charts:');
    for (const [name, node] of sortedByDependents) {
      if (node.dependents.size > 0) {
        console.log(`      ${name}: ${node.dependents.size} dependents`);
      }
    }

    // Find isolated charts
    const isolated = Array.from(this.graph.charts.entries())
      .filter(([_, node]) => node.dependencies.size === 0 && node.dependents.size === 0);
    
    if (isolated.length > 0) {
      console.log(`\n   🏝️  Isolated charts (no dependencies): ${isolated.length}`);
    }
  }

  async save(outputPath?: string) {
    const path = outputPath || this.options.outputPath || 'cdk8s-dependencies.json';
    
    // Convert to serializable format
    const serializable = {
      lastUpdated: this.graph.lastUpdated,
      charts: Array.from(this.graph.charts.entries()).map(([name, node]) => ({
        name,
        filePath: node.filePath,
        dependencies: Array.from(node.dependencies),
        dependents: Array.from(node.dependents),
        imports: Array.from(node.imports)
      })),
      relationships: this.graph.relationships,
      fileHashes: Array.from(this.graph.fileHashes.entries())
    };

    fs.writeFileSync(path, JSON.stringify(serializable, null, 2));
    console.log(`\n💾 Dependency graph saved to: ${path}`);
  }

  async exportMermaid(): Promise<string> {
    let mermaid = 'graph TD\n';
    
    // Add nodes
    for (const [name, node] of this.graph.charts) {
      const shortName = name.replace('Chart', '');
      mermaid += `    ${shortName}[${shortName}]\n`;
    }
    
    // Add relationships
    for (const rel of this.graph.relationships) {
      const source = rel.source.replace('Chart', '');
      const target = rel.target.replace('Chart', '');
      
      let arrow = '-->';
      if (rel.type === 'constructor-dependency') {
        arrow = '-.->'; // Dashed for constructor deps
      } else if (rel.type === 'import-dependency') {
        arrow = '-.->';  // Dotted for imports
      }
      
      mermaid += `    ${source} ${arrow} ${target}\n`;
    }
    
    return mermaid;
  }

  async exportGraphviz(): Promise<string> {
    let dot = 'digraph CDK8sDependencies {\n';
    dot += '    rankdir=LR;\n';
    dot += '    node [shape=box];\n\n';
    
    // Add nodes
    for (const [name, node] of this.graph.charts) {
      const shortName = name.replace('Chart', '');
      const color = node.dependents.size > 5 ? 'lightblue' : 'white';
      dot += `    "${shortName}" [fillcolor="${color}" style="filled"];\n`;
    }
    
    dot += '\n';
    
    // Add edges
    for (const rel of this.graph.relationships) {
      const source = rel.source.replace('Chart', '');
      const target = rel.target.replace('Chart', '');
      
      let style = 'solid';
      if (rel.type === 'constructor-dependency') {
        style = 'dashed';
      } else if (rel.type === 'import-dependency') {
        style = 'dotted';
      }
      
      dot += `    "${source}" -> "${target}" [style="${style}"];\n`;
    }
    
    dot += '}\n';
    return dot;
  }

  // Get all charts affected by changes to specific files
  getAffectedCharts(changedFiles: string[]): Set<string> {
    const affected = new Set<string>();
    
    for (const file of changedFiles) {
      // Find charts in the changed files
      for (const [name, node] of this.graph.charts) {
        if (node.filePath === file) {
          affected.add(name);
          // Add all dependents (transitive)
          this.addTransitiveDependents(name, affected);
        }
      }
    }
    
    return affected;
  }

  private addTransitiveDependents(chartName: string, affected: Set<string>) {
    const node = this.graph.charts.get(chartName);
    if (!node) return;
    
    for (const dependent of node.dependents) {
      if (!affected.has(dependent)) {
        affected.add(dependent);
        this.addTransitiveDependents(dependent, affected);
      }
    }
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const format = args.find(a => a.startsWith('--format='))?.split('=')[1] as any || 'json';
  const verbose = args.includes('--verbose') || args.includes('-v');
  const includeLibDeps = args.includes('--include-lib');
  const outputPath = args.find(a => a.startsWith('--output='))?.split('=')[1];

  const analyzer = new DependencyAnalyzer({
    projectRoot: process.cwd(),
    chartsDir: path.join(process.cwd(), 'charts'),
    format,
    verbose,
    includeLibDeps,
    outputPath
  });

  const graph = await analyzer.analyze();
  
  // Save the graph
  await analyzer.save();

  // Export in requested format
  if (format === 'mermaid') {
    const mermaid = await analyzer.exportMermaid();
    const mermaidPath = outputPath?.replace('.json', '.mmd') || 'cdk8s-dependencies.mmd';
    fs.writeFileSync(mermaidPath, mermaid);
    console.log(`\n📊 Mermaid diagram saved to: ${mermaidPath}`);
  } else if (format === 'graphviz') {
    const dot = await analyzer.exportGraphviz();
    const dotPath = outputPath?.replace('.json', '.dot') || 'cdk8s-dependencies.dot';
    fs.writeFileSync(dotPath, dot);
    console.log(`\n📊 Graphviz diagram saved to: ${dotPath}`);
  }

  console.log('\n✅ Dependency analysis complete!');
}

if (require.main === module) {
  main().catch(console.error);
}

export { DependencyAnalyzer, DependencyGraph, ChartNode };