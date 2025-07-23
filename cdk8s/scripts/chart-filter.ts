import * as path from 'path';
import * as fs from 'fs';
const glob = require('glob').glob;
const minimatch = require('minimatch').minimatch;
import { DependencyGraph, ChartNode } from './analyze-dependencies';

export interface FilterOptions {
  // File selection patterns
  pattern?: string[];        // Glob patterns
  files?: string[];          // Explicit file list
  regex?: string;            // Regex pattern
  dir?: string[];            // Directory paths
  
  // Dependency-based selection
  depsOf?: string[];         // Include dependencies of these files
  dependentsOf?: string[];   // Include dependents of these files
  
  // Git-based selection
  changed?: boolean;         // Use git changed files
  
  // Modifiers
  includeDeps?: boolean;     // Include all transitive dependencies
  includeDependents?: boolean; // Include all transitive dependents
  exclude?: string[];        // Exclude patterns
  
  // Options
  dryRun?: boolean;         // Just show what would be selected
  verbose?: boolean;        // Verbose output
}

export class ChartFilter {
  private dependencyGraph?: DependencyGraph;
  private chartFiles: Map<string, string> = new Map(); // filename -> full path
  
  constructor(
    private projectRoot: string,
    private chartsDir: string
  ) {}

  async loadDependencyGraph(): Promise<void> {
    const depPath = path.join(this.projectRoot, 'cdk8s-dependencies.json');
    
    if (fs.existsSync(depPath)) {
      const data = JSON.parse(fs.readFileSync(depPath, 'utf-8'));
      
      // Reconstruct the graph
      this.dependencyGraph = {
        charts: new Map(),
        relationships: data.relationships,
        lastUpdated: new Date(data.lastUpdated),
        fileHashes: new Map(data.fileHashes)
      };
      
      // Reconstruct chart nodes
      for (const chart of data.charts) {
        const node: ChartNode = {
          name: chart.name,
          filePath: chart.filePath,
          dependencies: new Set(chart.dependencies),
          dependents: new Set(chart.dependents),
          imports: new Set(chart.imports)
        };
        this.dependencyGraph.charts.set(chart.name, node);
        
        // Build filename mapping
        const filename = path.basename(chart.filePath);
        this.chartFiles.set(filename, chart.filePath);
      }
    } else {
      console.warn('⚠️  Dependency graph not found. Run "npm run analyze:deps" first for dependency-based filtering.');
    }
  }

  async filter(options: FilterOptions): Promise<string[]> {
    await this.loadDependencyGraph();
    
    let selectedCharts = new Set<string>();
    let selectedFiles = new Set<string>();

    // 1. Apply file-based filters
    if (options.pattern && options.pattern.length > 0) {
      const files = await this.filterByPattern(options.pattern);
      files.forEach(f => selectedFiles.add(f));
    }

    if (options.files && options.files.length > 0) {
      const files = await this.filterByFiles(options.files);
      files.forEach(f => selectedFiles.add(f));
    }

    if (options.regex) {
      const files = await this.filterByRegex(options.regex);
      files.forEach(f => selectedFiles.add(f));
    }

    if (options.dir && options.dir.length > 0) {
      const files = await this.filterByDirectory(options.dir);
      files.forEach(f => selectedFiles.add(f));
    }

    if (options.changed) {
      const files = await this.filterByGitChanges();
      files.forEach(f => selectedFiles.add(f));
    }

    // Convert files to chart names
    if (this.dependencyGraph) {
      for (const file of selectedFiles) {
        for (const [chartName, node] of this.dependencyGraph.charts) {
          if (node.filePath === file || node.filePath.endsWith(file)) {
            selectedCharts.add(chartName);
          }
        }
      }
    } else {
      // If no dependency graph, use file paths directly
      selectedFiles.forEach(f => selectedCharts.add(f));
    }

    // 2. Apply dependency-based filters
    if (options.depsOf && options.depsOf.length > 0 && this.dependencyGraph) {
      const deps = await this.getDependencies(options.depsOf);
      deps.forEach(d => selectedCharts.add(d));
    }

    if (options.dependentsOf && options.dependentsOf.length > 0 && this.dependencyGraph) {
      const dependents = await this.getDependents(options.dependentsOf);
      dependents.forEach(d => selectedCharts.add(d));
    }

    // 3. Apply modifiers
    if (options.includeDeps && this.dependencyGraph) {
      const allDeps = this.getTransitiveDependencies(Array.from(selectedCharts));
      allDeps.forEach(d => selectedCharts.add(d));
    }

    if (options.includeDependents && this.dependencyGraph) {
      const allDependents = this.getTransitiveDependents(Array.from(selectedCharts));
      allDependents.forEach(d => selectedCharts.add(d));
    }

    // 4. Apply exclusions
    if (options.exclude && options.exclude.length > 0) {
      selectedCharts = await this.applyExclusions(selectedCharts, options.exclude);
    }

    // Convert back to file paths
    const result: string[] = [];
    if (this.dependencyGraph) {
      for (const chartName of selectedCharts) {
        const node = this.dependencyGraph.charts.get(chartName);
        if (node) {
          result.push(node.filePath);
        }
      }
    } else {
      result.push(...selectedCharts);
    }

    if (options.verbose) {
      console.log(`\n📋 Selected ${result.length} charts:`);
      result.forEach(f => console.log(`   - ${path.relative(this.projectRoot, f)}`));
    }

    return result;
  }

  private async filterByPattern(patterns: string[]): Promise<string[]> {
    const results: string[] = [];
    
    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: this.projectRoot,
        absolute: true,
        ignore: ['**/node_modules/**', '**/*.test.ts', '**/*.d.ts']
      });
      results.push(...files);
    }
    
    return [...new Set(results)];
  }

  private async filterByFiles(files: string[]): Promise<string[]> {
    const results: string[] = [];
    
    for (const file of files) {
      // Check if it's a full path or just a filename
      if (path.isAbsolute(file)) {
        if (fs.existsSync(file)) {
          results.push(file);
        }
      } else {
        // Try to find the file
        const fullPath = this.chartFiles.get(file);
        if (fullPath) {
          results.push(fullPath);
        } else {
          // Try as a relative path
          const relativePath = path.join(this.projectRoot, file);
          if (fs.existsSync(relativePath)) {
            results.push(relativePath);
          }
        }
      }
    }
    
    return results;
  }

  private async filterByRegex(regexStr: string): Promise<string[]> {
    const regex = new RegExp(regexStr);
    const results: string[] = [];
    
    const allFiles = await glob(path.join(this.chartsDir, '**/*.ts'), {
      absolute: true,
      ignore: ['**/node_modules/**', '**/*.test.ts', '**/*.d.ts']
    });
    
    for (const file of allFiles) {
      const relativePath = path.relative(this.projectRoot, file);
      if (regex.test(relativePath) || regex.test(path.basename(file))) {
        results.push(file);
      }
    }
    
    return results;
  }

  private async filterByDirectory(dirs: string[]): Promise<string[]> {
    const results: string[] = [];
    
    for (const dir of dirs) {
      const fullDir = path.isAbsolute(dir) ? dir : path.join(this.projectRoot, dir);
      const files = await glob(path.join(fullDir, '**/*.ts'), {
        absolute: true,
        ignore: ['**/node_modules/**', '**/*.test.ts', '**/*.d.ts']
      });
      results.push(...files);
    }
    
    return [...new Set(results)];
  }

  private async filterByGitChanges(): Promise<string[]> {
    const { execSync } = require('child_process');
    
    try {
      // Get changed files (staged and unstaged)
      const gitStatus = execSync('git status --porcelain', { 
        cwd: this.projectRoot,
        encoding: 'utf-8' 
      });
      
      const changedFiles: string[] = [];
      const lines = gitStatus.split('\n').filter((line: string) => line.trim());
      
      for (const line of lines) {
        const file = line.substring(3).trim(); // Remove git status prefix
        if (file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.d.ts')) {
          const fullPath = path.join(this.projectRoot, file);
          if (fs.existsSync(fullPath)) {
            changedFiles.push(fullPath);
          }
        }
      }
      
      return changedFiles;
    } catch (error) {
      console.warn('⚠️  Failed to get git changes:', error);
      return [];
    }
  }

  private async getDependencies(chartIdentifiers: string[]): Promise<string[]> {
    if (!this.dependencyGraph) return [];
    
    const dependencies = new Set<string>();
    
    for (const identifier of chartIdentifiers) {
      // Find the chart by name or file
      let chartName: string | undefined;
      
      if (this.dependencyGraph.charts.has(identifier)) {
        chartName = identifier;
      } else {
        // Try to find by filename
        for (const [name, node] of this.dependencyGraph.charts) {
          if (node.filePath.endsWith(identifier) || path.basename(node.filePath) === identifier) {
            chartName = name;
            break;
          }
        }
      }
      
      if (chartName) {
        const node = this.dependencyGraph.charts.get(chartName);
        if (node) {
          node.dependencies.forEach(dep => dependencies.add(dep));
        }
      }
    }
    
    return Array.from(dependencies);
  }

  private async getDependents(chartIdentifiers: string[]): Promise<string[]> {
    if (!this.dependencyGraph) return [];
    
    const dependents = new Set<string>();
    
    for (const identifier of chartIdentifiers) {
      // Find the chart by name or file
      let chartName: string | undefined;
      
      if (this.dependencyGraph.charts.has(identifier)) {
        chartName = identifier;
      } else {
        // Try to find by filename
        for (const [name, node] of this.dependencyGraph.charts) {
          if (node.filePath.endsWith(identifier) || path.basename(node.filePath) === identifier) {
            chartName = name;
            break;
          }
        }
      }
      
      if (chartName) {
        const node = this.dependencyGraph.charts.get(chartName);
        if (node) {
          node.dependents.forEach(dep => dependents.add(dep));
        }
      }
    }
    
    return Array.from(dependents);
  }

  private getTransitiveDependencies(chartNames: string[]): Set<string> {
    if (!this.dependencyGraph) return new Set();
    
    const allDeps = new Set<string>();
    const visited = new Set<string>();
    
    const collectDeps = (chartName: string) => {
      if (visited.has(chartName)) return;
      visited.add(chartName);
      
      const node = this.dependencyGraph!.charts.get(chartName);
      if (node) {
        for (const dep of node.dependencies) {
          allDeps.add(dep);
          collectDeps(dep);
        }
      }
    };
    
    chartNames.forEach(name => collectDeps(name));
    return allDeps;
  }

  private getTransitiveDependents(chartNames: string[]): Set<string> {
    if (!this.dependencyGraph) return new Set();
    
    const allDependents = new Set<string>();
    const visited = new Set<string>();
    
    const collectDependents = (chartName: string) => {
      if (visited.has(chartName)) return;
      visited.add(chartName);
      
      const node = this.dependencyGraph!.charts.get(chartName);
      if (node) {
        for (const dependent of node.dependents) {
          allDependents.add(dependent);
          collectDependents(dependent);
        }
      }
    };
    
    chartNames.forEach(name => collectDependents(name));
    return allDependents;
  }

  private async applyExclusions(charts: Set<string>, excludePatterns: string[]): Promise<Set<string>> {
    const result = new Set<string>();
    
    for (const chart of charts) {
      let excluded = false;
      
      for (const pattern of excludePatterns) {
        if (minimatch(chart, pattern)) {
          excluded = true;
          break;
        }
        
        // Also check file path if we have dependency graph
        if (this.dependencyGraph) {
          const node = this.dependencyGraph.charts.get(chart);
          if (node && minimatch(node.filePath, pattern)) {
            excluded = true;
            break;
          }
        }
      }
      
      if (!excluded) {
        result.add(chart);
      }
    }
    
    return result;
  }

  // Get chart names from file paths
  getChartNames(filePaths: string[]): string[] {
    if (!this.dependencyGraph) return filePaths;
    
    const chartNames: string[] = [];
    
    for (const filePath of filePaths) {
      for (const [name, node] of this.dependencyGraph.charts) {
        if (node.filePath === filePath) {
          chartNames.push(name);
          break;
        }
      }
    }
    
    return chartNames;
  }
}