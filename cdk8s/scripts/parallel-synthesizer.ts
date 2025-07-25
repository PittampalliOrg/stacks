import { Worker } from 'worker_threads';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { DependencyGraph, ChartNode } from './analyze-dependencies';

export interface ParallelSynthesisOptions {
  maxWorkers?: number;
  verbose?: boolean;
  dryRun?: boolean;
}

export interface ChartGroup {
  id: number;
  charts: string[];
  dependencies: string[];
}

export interface WorkerTask {
  groupId: number;
  charts: string[];
  env: Record<string, string>;
}

export interface WorkerResult {
  groupId: number;
  success: boolean;
  duration: number;
  error?: string;
}

export class ParallelSynthesizer {
  private maxWorkers: number;
  private workers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private activeWorkers = 0;
  
  constructor(
    private projectRoot: string,
    private dependencyGraph: DependencyGraph,
    private options: ParallelSynthesisOptions = {}
  ) {
    // Default to CPU cores - 1, minimum 2
    this.maxWorkers = options.maxWorkers || Math.max(2, os.cpus().length - 1);
  }

  /**
   * Analyze dependency graph to find independent chart groups
   */
  findIndependentGroups(selectedCharts?: string[]): ChartGroup[] {
    const groups: ChartGroup[] = [];
    const assigned = new Set<string>();
    
    // If specific charts are selected, use only those
    const chartsToProcess = selectedCharts || Array.from(this.dependencyGraph.charts.keys());
    
    // First, identify strongly connected components (charts that depend on each other)
    const sccs = this.findStronglyConnectedComponents(chartsToProcess);
    
    // Each SCC becomes a group
    sccs.forEach((scc, index) => {
      if (scc.length === 0) return;
      
      const group: ChartGroup = {
        id: index,
        charts: scc,
        dependencies: this.getGroupDependencies(scc)
      };
      
      groups.push(group);
      scc.forEach(chart => assigned.add(chart));
    });
    
    // Add isolated charts as individual groups
    for (const chart of chartsToProcess) {
      if (!assigned.has(chart)) {
        const node = this.dependencyGraph.charts.get(chart);
        if (node && node.dependencies.size === 0 && node.dependents.size === 0) {
          groups.push({
            id: groups.length,
            charts: [chart],
            dependencies: []
          });
        }
      }
    }
    
    return groups;
  }

  /**
   * Find strongly connected components using Tarjan's algorithm
   */
  private findStronglyConnectedComponents(charts: string[]): string[][] {
    const index = new Map<string, number>();
    const lowlink = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const sccs: string[][] = [];
    let currentIndex = 0;
    
    const strongConnect = (chart: string) => {
      index.set(chart, currentIndex);
      lowlink.set(chart, currentIndex);
      currentIndex++;
      stack.push(chart);
      onStack.add(chart);
      
      const node = this.dependencyGraph.charts.get(chart);
      if (node) {
        for (const dep of node.dependencies) {
          if (!index.has(dep)) {
            strongConnect(dep);
            lowlink.set(chart, Math.min(lowlink.get(chart)!, lowlink.get(dep)!));
          } else if (onStack.has(dep)) {
            lowlink.set(chart, Math.min(lowlink.get(chart)!, index.get(dep)!));
          }
        }
      }
      
      if (lowlink.get(chart) === index.get(chart)) {
        const scc: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          scc.push(w);
        } while (w !== chart);
        
        if (scc.length > 0) {
          sccs.push(scc);
        }
      }
    };
    
    for (const chart of charts) {
      if (!index.has(chart)) {
        strongConnect(chart);
      }
    }
    
    return sccs;
  }

  /**
   * Get all external dependencies for a group of charts
   */
  private getGroupDependencies(charts: string[]): string[] {
    const groupSet = new Set(charts);
    const externalDeps = new Set<string>();
    
    for (const chart of charts) {
      const node = this.dependencyGraph.charts.get(chart);
      if (node) {
        for (const dep of node.dependencies) {
          if (!groupSet.has(dep)) {
            externalDeps.add(dep);
          }
        }
      }
    }
    
    return Array.from(externalDeps);
  }

  /**
   * Create a topological ordering of groups based on dependencies
   */
  createExecutionPlan(groups: ChartGroup[]): ChartGroup[][] {
    const levels: ChartGroup[][] = [];
    const groupMap = new Map<string, ChartGroup>();
    const processed = new Set<number>();
    
    // Create a map of chart -> group
    for (const group of groups) {
      for (const chart of group.charts) {
        groupMap.set(chart, group);
      }
    }
    
    // Determine which groups can be executed in parallel
    let remainingGroups = [...groups];
    
    while (remainingGroups.length > 0) {
      const currentLevel: ChartGroup[] = [];
      
      // Find groups with all dependencies satisfied
      for (const group of remainingGroups) {
        const depsReady = group.dependencies.every(dep => {
          const depGroup = groupMap.get(dep);
          return !depGroup || processed.has(depGroup.id);
        });
        
        if (depsReady) {
          currentLevel.push(group);
        }
      }
      
      if (currentLevel.length === 0) {
        // Circular dependency detected
        console.warn('⚠️  Circular dependency detected, processing remaining groups sequentially');
        levels.push(remainingGroups);
        break;
      }
      
      // Mark as processed and remove from remaining
      currentLevel.forEach(group => processed.add(group.id));
      remainingGroups = remainingGroups.filter(g => !processed.has(g.id));
      
      levels.push(currentLevel);
    }
    
    return levels;
  }

  /**
   * Execute synthesis in parallel
   */
  async synthesizeInParallel(selectedCharts?: string[]): Promise<void> {
    console.log(`\n🚀 Starting parallel synthesis with up to ${this.maxWorkers} workers`);
    
    // Find independent groups
    const groups = this.findIndependentGroups(selectedCharts);
    console.log(`📊 Found ${groups.length} independent chart groups`);
    
    if (this.options.verbose) {
      groups.forEach(group => {
        console.log(`  Group ${group.id}: ${group.charts.join(', ')}`);
        if (group.dependencies.length > 0) {
          console.log(`    Dependencies: ${group.dependencies.join(', ')}`);
        }
      });
    }
    
    // Create execution plan
    const executionPlan = this.createExecutionPlan(groups);
    console.log(`📋 Execution plan has ${executionPlan.length} levels`);
    
    if (this.options.dryRun) {
      console.log('\n🔍 Dry run - would execute:');
      executionPlan.forEach((level, i) => {
        console.log(`  Level ${i + 1}: ${level.length} groups in parallel`);
        level.forEach(group => {
          console.log(`    - Group ${group.id}: ${group.charts.join(', ')}`);
        });
      });
      return;
    }
    
    // Execute each level
    const startTime = Date.now();
    const results: WorkerResult[] = [];
    
    for (let i = 0; i < executionPlan.length; i++) {
      const level = executionPlan[i];
      console.log(`\n⚡ Executing level ${i + 1}/${executionPlan.length} (${level.length} groups in parallel)`);
      
      const levelResults = await this.executeLevel(level);
      results.push(...levelResults);
      
      // Check for failures
      const failures = levelResults.filter(r => !r.success);
      if (failures.length > 0) {
        console.error(`\n❌ ${failures.length} groups failed in level ${i + 1}`);
        failures.forEach(f => console.error(`  Group ${f.groupId}: ${f.error}`));
        throw new Error('Parallel synthesis failed');
      }
    }
    
    // Show summary
    const totalTime = Date.now() - startTime;
    const avgTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const maxTime = Math.max(...results.map(r => r.duration));
    
    console.log('\n📊 Parallel Synthesis Summary:');
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Groups processed: ${results.length}`);
    console.log(`   Average group time: ${Math.round(avgTime)}ms`);
    console.log(`   Longest group time: ${maxTime}ms`);
    console.log(`   Speedup factor: ${((maxTime * results.length) / totalTime).toFixed(1)}x`);
  }

  /**
   * Execute a level of groups in parallel
   */
  private async executeLevel(groups: ChartGroup[]): Promise<WorkerResult[]> {
    const tasks: WorkerTask[] = groups.map(group => ({
      groupId: group.id,
      charts: group.charts,
      env: {
        ...process.env.,
        CDK8S_CHARTS: group.charts.join(','),
        CDK8S_SELECTIVE_SYNTHESIS: 'true'
      }
    }));
    
    // Use Promise.all to run in parallel
    const promises = tasks.map(task => this.runWorkerTask(task));
    return Promise.all(promises);
  }

  /**
   * Run a synthesis task (in main thread for now, can be moved to worker)
   */
  private async runWorkerTask(task: WorkerTask): Promise<WorkerResult> {
    const startTime = Date.now();
    
    try {
      if (this.options.verbose) {
        console.log(`  🔨 Synthesizing group ${task.groupId}: ${task.charts.join(', ')}`);
      }
      
      // For now, run in main thread - can be moved to worker thread
      await this.synthesizeCharts(task.charts, task.env);
      
      const duration = Date.now() - startTime;
      
      return {
        groupId: task.groupId,
        success: true,
        duration
      };
    } catch (error) {
      return {
        groupId: task.groupId,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Synthesize specific charts
   */
  private async synthesizeCharts(charts: string[], env: Record<string, string>): Promise<void> {
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const synthCommand = '. ../.env-files/wi.env && npx cdk8s synth';
      const synthProcess = spawn('bash', ['-c', synthCommand], {
        cwd: this.projectRoot,
        env,
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });

      let stderr = '';
      if (!this.options.verbose && synthProcess.stderr) {
        synthProcess.stderr.on('data', (data: any) => {
          stderr += data.toString();
        });
      }

      synthProcess.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Synthesis failed with code ${code}: ${stderr}`));
        }
      });

      synthProcess.on('error', reject);
    });
  }
}

// Utility function to load dependency graph
export async function loadDependencyGraph(projectRoot: string): Promise<DependencyGraph | null> {
  const depPath = path.join(projectRoot, 'cdk8s-dependencies.json');
  
  if (!fs.existsSync(depPath)) {
    return null;
  }

  const data = JSON.parse(fs.readFileSync(depPath, 'utf-8'));
  
  // Reconstruct the graph
  const graph: DependencyGraph = {
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
    graph.charts.set(chart.name, node);
  }
  
  return graph;
}