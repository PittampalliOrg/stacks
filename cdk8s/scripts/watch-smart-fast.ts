#!/usr/bin/env ts-node

import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import * as esbuild from 'esbuild';
import { ChartFilter, FilterOptions } from './chart-filter';
import { DependencyAnalyzer } from './analyze-dependencies';
import * as crypto from 'crypto';

interface FastWatchOptions extends FilterOptions {
  // Watch-specific options
  watchDirs?: string[];      // Directories to watch (default: charts/, lib/)
  debounce?: number;         // Debounce time in ms
  clearConsole?: boolean;    // Clear console on each run
  showStats?: boolean;       // Show synthesis statistics
  useCache?: boolean;        // Use build cache
  analyzeFirst?: boolean;    // Run dependency analysis first
  useEsbuild?: boolean;      // Use esbuild for compilation (default: true)
}

class FastSmartWatcher {
  private watcher?: chokidar.FSWatcher;
  private filter: ChartFilter;
  private esbuildContext?: esbuild.BuildContext;
  private pendingChanges: Set<string> = new Set();
  private debounceTimer?: NodeJS.Timeout;
  private compiledMainPath: string;
  private lastCompileTime: number = 0;
  
  constructor(
    private projectRoot: string,
    private options: FastWatchOptions
  ) {
    this.filter = new ChartFilter(projectRoot, path.join(projectRoot, 'charts'));
    this.compiledMainPath = path.join(projectRoot, '.build/main.js');
    
    // Default to using esbuild
    if (this.options.useEsbuild === undefined) {
      this.options.useEsbuild = true;
    }
  }

  async start() {
    console.log('🚀 Starting CDK8s Fast Smart Watch...\n');

    // Set up esbuild if enabled
    if (this.options.useEsbuild) {
      await this.setupEsbuild();
    }

    // Run dependency analysis if requested
    if (this.options.analyzeFirst) {
      await this.runDependencyAnalysis();
    }

    // Load dependency graph
    await this.filter.loadDependencyGraph();

    // Set up file watching
    const watchDirs = this.options.watchDirs || [
      path.join(this.projectRoot, 'charts'),
      path.join(this.projectRoot, 'lib'),
      path.join(this.projectRoot, 'main.ts')
    ];

    this.watcher = chokidar.watch(watchDirs, {
      ignored: [
        '**/node_modules/**',
        '**/*.test.ts',
        '**/*.d.ts',
        '**/dist/**',
        '**/.git/**'
      ],
      persistent: true,
      ignoreInitial: true
    });

    // Set up event handlers
    this.watcher
      .on('change', (filePath) => this.handleFileChange(filePath))
      .on('add', (filePath) => this.handleFileChange(filePath))
      .on('unlink', (filePath) => this.handleFileChange(filePath));

    // Initial synthesis
    if (this.shouldRunInitialSynthesis()) {
      await this.runFilteredSynthesis();
    }

    console.log('👀 Watching for changes...');
    if (this.options.useEsbuild) {
      console.log('⚡ Using esbuild for ultra-fast compilation');
    }
    this.printWatchInfo();
  }

  private async setupEsbuild() {
    console.log('⚡ Setting up esbuild for fast compilation...');
    
    // Ensure dist/js directory exists
    const distDir = path.dirname(this.compiledMainPath);
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }
    
    // Create esbuild context for incremental builds
    this.esbuildContext = await esbuild.context({
      entryPoints: [path.join(this.projectRoot, 'main.ts')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'cjs',
      outfile: this.compiledMainPath,
      external: [
        'cdk8s',
        'cdk8s-*',
        'constructs',
        '@opencdk8s/*',
        'ts-morph'
      ],
      sourcemap: true,
      keepNames: true,
      logLevel: 'info',
      // incremental: true, // Not supported with context API
      metafile: true
    });

    // Do initial build
    const startTime = Date.now();
    try {
      const result = await this.esbuildContext.rebuild();
      this.lastCompileTime = Date.now() - startTime;
      console.log(`✨ Initial compilation completed in ${this.lastCompileTime}ms`);
      
      // Verify the file was created
      if (!fs.existsSync(this.compiledMainPath)) {
        throw new Error(`Compiled file not found at ${this.compiledMainPath}`);
      }
      console.log(`✅ Compiled output verified at ${this.compiledMainPath}\n`);
    } catch (error) {
      console.error('❌ Initial build failed:', error);
      throw error;
    }
  }

  private async handleFileChange(filePath: string) {
    const relativePath = path.relative(this.projectRoot, filePath);
    
    this.pendingChanges.add(filePath);
    console.log(`\n📝 File changed: ${relativePath}`);
    
    // Debounce processing
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.processPendingChanges();
    }, this.options.debounce || 500); // Shorter debounce with fast compilation
  }

  private async processPendingChanges() {
    if (this.pendingChanges.size === 0) return;

    const stats = {
      startTime: Date.now(),
      compileTime: 0,
      synthesisTime: 0,
      totalTime: 0
    };

    if (this.options.clearConsole) {
      console.clear();
    }

    console.log('\n🔄 Processing changes...');
    
    // Check if any TypeScript files changed (requires recompilation)
    // This includes main.ts, lib files, and chart files since they're all bundled together
    const needsRecompile = Array.from(this.pendingChanges).some(file => 
      file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.d.ts')
    );

    if (needsRecompile && this.options.useEsbuild) {
      console.log('⚡ Recompiling with esbuild...');
      const compileStart = Date.now();
      
      try {
        await this.esbuildContext!.rebuild();
        stats.compileTime = Date.now() - compileStart;
        console.log(`  Compiled in ${stats.compileTime}ms`);
      } catch (error) {
        console.error('❌ Compilation failed:', error);
        this.pendingChanges.clear();
        return;
      }
    }

    // Get affected charts
    const affectedCharts = await this.getAffectedCharts();
    
    if (affectedCharts.length === 0) {
      console.log('  No charts affected by changes.');
      this.pendingChanges.clear();
      return;
    }

    console.log(`  Charts affected: ${affectedCharts.length}`);
    
    if (this.options.verbose) {
      affectedCharts.forEach(chart => {
        const relativePath = path.relative(this.projectRoot, chart);
        console.log(`    - ${relativePath}`);
      });
    }

    // Clear pending changes
    this.pendingChanges.clear();

    // Run synthesis
    const synthStart = Date.now();
    await this.synthesizeCharts(affectedCharts);
    stats.synthesisTime = Date.now() - synthStart;

    // Show statistics
    if (this.options.showStats) {
      stats.totalTime = Date.now() - stats.startTime;
      this.showStatistics(stats);
    }
  }

  private async getAffectedCharts(): Promise<string[]> {
    const changedFiles = Array.from(this.pendingChanges);
    
    // Start with the filter options
    const filterOptions: FilterOptions = { ...this.options };
    
    // Add changed files to the filter
    if (!filterOptions.files) {
      filterOptions.files = [];
    }
    filterOptions.files.push(...changedFiles);
    
    // Apply filters to get affected charts
    return await this.filter.filter(filterOptions);
  }

  private async synthesizeCharts(chartPaths: string[]): Promise<void> {
    console.log('\n🔨 Synthesizing affected charts...');

    // Get chart names for environment variable
    const chartNames = this.filter.getChartNames(chartPaths);
    
    // Prepare environment variables
    const env = {
      ...process.env,
      CDK8S_CHARTS: chartNames.join(','),
      CDK8S_SELECTIVE_SYNTHESIS: 'true'
    };

    // Update cdk8s.yaml temporarily if using esbuild
    if (this.options.useEsbuild) {
      console.log('  🔧 Using esbuild mode - updating config...');
      await this.updateCdk8sConfig();
    } else {
      console.log('  🔧 Using standard ts-node mode');
    }

    try {
      // Run synthesis
      await new Promise<void>((resolve, reject) => {
        const synthCommand = '. ../.env-files/wi.env && npx cdk8s synth';
        const synthProcess = spawn('bash', ['-c', synthCommand], {
          cwd: this.projectRoot,
          env,
          stdio: 'inherit'
        });

        synthProcess.on('close', (code) => {
          if (code === 0) {
            console.log('\n✅ Synthesis completed successfully!');
            resolve();
          } else {
            reject(new Error(`Synthesis failed with code ${code}`));
          }
        });

        synthProcess.on('error', reject);
      });
    } finally {
      // Restore cdk8s.yaml if we modified it
      if (this.options.useEsbuild) {
        await this.restoreCdk8sConfig();
      }
    }
  }

  private async updateCdk8sConfig() {
    const configPath = path.join(this.projectRoot, 'cdk8s.yaml');
    const backupPath = path.join(this.projectRoot, 'cdk8s.yaml.backup');
    
    console.log('  📝 Updating cdk8s.yaml to use compiled JavaScript...');
    
    const config = fs.readFileSync(configPath, 'utf-8');
    fs.writeFileSync(backupPath, config);
    
    const newConfig = config.replace(
      'app: npx ts-node main.ts',
      'app: node .build/main.js'
    );
    
    fs.writeFileSync(configPath, newConfig);
    console.log('  ✅ Config updated to use fast compiled output');
  }

  private async restoreCdk8sConfig() {
    const configPath = path.join(this.projectRoot, 'cdk8s.yaml');
    const backupPath = path.join(this.projectRoot, 'cdk8s.yaml.backup');
    
    console.log('  🔄 Restoring original cdk8s.yaml...');
    
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, configPath);
      fs.unlinkSync(backupPath);
      console.log('  ✅ Config restored');
    } else {
      console.log('  ⚠️  No backup file found to restore');
    }
  }

  private showStatistics(stats: any) {
    console.log('\n📊 Performance Statistics:');
    console.log(`   Total time: ${stats.totalTime}ms`);
    if (stats.compileTime > 0) {
      console.log(`   Compilation: ${stats.compileTime}ms (esbuild)`);
    }
    console.log(`   Synthesis: ${stats.synthesisTime}ms`);
    
    if (this.lastCompileTime > 0 && stats.compileTime === 0) {
      console.log(`   (No recompilation needed - saved ${this.lastCompileTime}ms)`);
    }
  }

  private shouldRunInitialSynthesis(): boolean {
    return !!(
      this.options.pattern?.length ||
      this.options.files?.length ||
      this.options.regex ||
      this.options.dir?.length ||
      this.options.depsOf?.length ||
      this.options.dependentsOf?.length
    );
  }

  private printWatchInfo() {
    console.log('\n📋 Watch Configuration:');
    
    if (this.options.pattern?.length) {
      console.log(`   Patterns: ${this.options.pattern.join(', ')}`);
    }
    // ... rest of watch info printing
    
    console.log('\nPress Ctrl+C to stop watching.\n');
  }

  private async runDependencyAnalysis() {
    console.log('🔍 Running dependency analysis...');
    
    const analyzer = new DependencyAnalyzer({
      projectRoot: this.projectRoot,
      chartsDir: path.join(this.projectRoot, 'charts'),
      verbose: false
    });

    await analyzer.analyze();
    await analyzer.save();
    
    console.log('✅ Dependency analysis complete!\n');
  }

  private async runFilteredSynthesis() {
    console.log('\n🎯 Running initial filtered synthesis...');
    
    const filteredCharts = await this.filter.filter(this.options);
    
    if (filteredCharts.length === 0) {
      console.log('   No charts match the filter criteria.');
      return;
    }

    console.log(`   Found ${filteredCharts.length} charts matching filters`);
    
    await this.synthesizeCharts(filteredCharts);
  }

  async stop() {
    if (this.watcher) {
      await this.watcher.close();
    }
    
    if (this.esbuildContext) {
      await this.esbuildContext.dispose();
    }
    
    console.log('\n👋 Stopped watching.');
  }
}

// CLI argument parsing (similar to original watch-smart.ts)
function parseArgs(): FastWatchOptions {
  const args = process.argv.slice(2);
  const options: FastWatchOptions = {
    useEsbuild: !args.includes('--no-esbuild')
  };

  // Parse all the same options as watch-smart.ts
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--pattern':
        options.pattern = args[++i].split(',');
        break;
      case '--files':
        options.files = args[++i].split(',');
        break;
      // ... rest of option parsing
      case '--stats':
        options.showStats = true;
        break;
      case '--no-esbuild':
        options.useEsbuild = false;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
    }
  }

  return options;
}

// Main execution
async function main() {
  const options = parseArgs();
  const watcher = new FastSmartWatcher(process.cwd(), options);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await watcher.stop();
    process.exit(0);
  });

  try {
    await watcher.start();
  } catch (error) {
    console.error('Failed to start watcher:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}