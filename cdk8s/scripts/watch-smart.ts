#!/usr/bin/env ts-node

import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { ChartFilter, FilterOptions } from './chart-filter';
import { DependencyAnalyzer } from './analyze-dependencies';
import * as crypto from 'crypto';

interface WatchOptions extends FilterOptions {
  // Watch-specific options
  watchDirs?: string[];      // Directories to watch (default: charts/, lib/)
  debounce?: number;         // Debounce time in ms
  clearConsole?: boolean;    // Clear console on each run
  showStats?: boolean;       // Show synthesis statistics
  useCache?: boolean;        // Use build cache
  analyzeFirst?: boolean;    // Run dependency analysis first
}

interface SynthesisStats {
  startTime: number;
  endTime?: number;
  filesChanged: string[];
  chartsAffected: string[];
  chartsSynthesized: string[];
  fromCache: string[];
  errors: string[];
}

class SmartWatcher {
  private watcher?: chokidar.FSWatcher;
  private filter: ChartFilter;
  private fileHashes: Map<string, string> = new Map();
  private synthesisCache: Map<string, string> = new Map();
  private pendingChanges: Set<string> = new Set();
  private debounceTimer?: NodeJS.Timeout;
  private stats: SynthesisStats = {
    startTime: Date.now(),
    filesChanged: [],
    chartsAffected: [],
    chartsSynthesized: [],
    fromCache: [],
    errors: []
  };

  constructor(
    private projectRoot: string,
    private options: WatchOptions
  ) {
    this.filter = new ChartFilter(projectRoot, path.join(projectRoot, 'charts'));
  }

  async start() {
    console.log('🚀 Starting CDK8s Smart Watch...\n');

    // Run dependency analysis if requested
    if (this.options.analyzeFirst) {
      await this.runDependencyAnalysis();
    }

    // Load dependency graph
    await this.filter.loadDependencyGraph();

    // Set up file watching
    const watchDirs = this.options.watchDirs || [
      path.join(this.projectRoot, 'charts'),
      path.join(this.projectRoot, 'lib')
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

    // Initial synthesis based on filters
    if (this.shouldRunInitialSynthesis()) {
      await this.runFilteredSynthesis();
    }

    console.log('👀 Watching for changes...');
    this.printWatchInfo();
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
    if (this.options.files?.length) {
      console.log(`   Files: ${this.options.files.join(', ')}`);
    }
    if (this.options.regex) {
      console.log(`   Regex: ${this.options.regex}`);
    }
    if (this.options.dir?.length) {
      console.log(`   Directories: ${this.options.dir.join(', ')}`);
    }
    if (this.options.depsOf?.length) {
      console.log(`   Dependencies of: ${this.options.depsOf.join(', ')}`);
    }
    if (this.options.dependentsOf?.length) {
      console.log(`   Dependents of: ${this.options.dependentsOf.join(', ')}`);
    }
    if (this.options.includeDeps) {
      console.log(`   ✓ Including transitive dependencies`);
    }
    if (this.options.includeDependents) {
      console.log(`   ✓ Including transitive dependents`);
    }
    
    console.log('\nPress Ctrl+C to stop watching.\n');
  }

  private async handleFileChange(filePath: string) {
    const relativePath = path.relative(this.projectRoot, filePath);
    
    // Check if file hash actually changed
    if (await this.hasFileChanged(filePath)) {
      this.pendingChanges.add(filePath);
      console.log(`\n📝 File changed: ${relativePath}`);
      
      // Debounce synthesis
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      
      this.debounceTimer = setTimeout(() => {
        this.processPendingChanges();
      }, this.options.debounce || 1000);
    }
  }

  private async hasFileChanged(filePath: string): Promise<boolean> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const previousHash = this.fileHashes.get(filePath);
      
      this.fileHashes.set(filePath, hash);
      return hash !== previousHash;
    } catch (error) {
      // File might have been deleted
      return true;
    }
  }

  private async processPendingChanges() {
    if (this.pendingChanges.size === 0) return;

    this.stats = {
      startTime: Date.now(),
      filesChanged: Array.from(this.pendingChanges),
      chartsAffected: [],
      chartsSynthesized: [],
      fromCache: [],
      errors: []
    };

    if (this.options.clearConsole) {
      console.clear();
    }

    console.log('\n🔄 Processing changes...');
    console.log(`   Files changed: ${this.pendingChanges.size}`);

    // Get affected charts based on changes and filters
    const affectedCharts = await this.getAffectedCharts();
    
    if (affectedCharts.length === 0) {
      console.log('   No charts affected by changes.');
      this.pendingChanges.clear();
      return;
    }

    console.log(`   Charts affected: ${affectedCharts.length}`);
    
    if (this.options.verbose) {
      affectedCharts.forEach(chart => {
        const relativePath = path.relative(this.projectRoot, chart);
        console.log(`     - ${relativePath}`);
      });
    }

    // Clear pending changes
    this.pendingChanges.clear();

    // Run synthesis
    await this.synthesizeCharts(affectedCharts);

    // Show statistics
    if (this.options.showStats) {
      this.showStatistics();
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
    const affectedCharts = await this.filter.filter(filterOptions);
    
    this.stats.chartsAffected = affectedCharts;
    return affectedCharts;
  }

  private async synthesizeCharts(chartPaths: string[]) {
    console.log('\n🔨 Synthesizing affected charts...');

    // Get chart names for environment variable
    const chartNames = this.filter.getChartNames(chartPaths);
    
    // Prepare environment variables
    const env = {
      ...process.env,
      CDK8S_CHARTS: chartNames.join(','),
      CDK8S_SELECTIVE_SYNTHESIS: 'true'
    };

    // Run synthesis
    return new Promise<void>((resolve, reject) => {
      // Source the env file and run synthesis
      const synthCommand = '. ../.env-files/wi.env && npx cdk8s synth';
      const synthProcess = spawn('bash', ['-c', synthCommand], {
        cwd: this.projectRoot,
        env,
        stdio: 'inherit'
      });

      synthProcess.on('close', (code) => {
        if (code === 0) {
          console.log('\n✅ Synthesis completed successfully!');
          this.stats.chartsSynthesized = chartNames;
          resolve();
        } else {
          console.error(`\n❌ Synthesis failed with code ${code}`);
          this.stats.errors.push(`Synthesis failed with code ${code}`);
          reject(new Error(`Synthesis failed with code ${code}`));
        }
      });

      synthProcess.on('error', (error) => {
        console.error('\n❌ Failed to start synthesis:', error);
        this.stats.errors.push(error.message);
        reject(error);
      });
    });
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

  private showStatistics() {
    this.stats.endTime = Date.now();
    const duration = (this.stats.endTime - this.stats.startTime) / 1000;

    console.log('\n📊 Synthesis Statistics:');
    console.log(`   Duration: ${duration.toFixed(2)}s`);
    console.log(`   Files changed: ${this.stats.filesChanged.length}`);
    console.log(`   Charts affected: ${this.stats.chartsAffected.length}`);
    console.log(`   Charts synthesized: ${this.stats.chartsSynthesized.length}`);
    
    if (this.stats.fromCache.length > 0) {
      console.log(`   From cache: ${this.stats.fromCache.length}`);
    }
    
    if (this.stats.errors.length > 0) {
      console.log(`   ❌ Errors: ${this.stats.errors.length}`);
      this.stats.errors.forEach(err => console.log(`      - ${err}`));
    }
  }

  async stop() {
    if (this.watcher) {
      await this.watcher.close();
      console.log('\n👋 Stopped watching.');
    }
  }
}

// CLI argument parsing
function parseArgs(): WatchOptions {
  const args = process.argv.slice(2);
  const options: WatchOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--pattern':
        options.pattern = args[++i].split(',');
        break;
      case '--files':
        options.files = args[++i].split(',');
        break;
      case '--regex':
        options.regex = args[++i];
        break;
      case '--dir':
        options.dir = args[++i].split(',');
        break;
      case '--deps-of':
        options.depsOf = args[++i].split(',');
        break;
      case '--dependents-of':
        options.dependentsOf = args[++i].split(',');
        break;
      case '--changed':
        options.changed = true;
        break;
      case '--include-deps':
        options.includeDeps = true;
        break;
      case '--include-dependents':
        options.includeDependents = true;
        break;
      case '--exclude':
        options.exclude = args[++i].split(',');
        break;
      case '--debounce':
        options.debounce = parseInt(args[++i]);
        break;
      case '--clear':
        options.clearConsole = true;
        break;
      case '--stats':
        options.showStats = true;
        break;
      case '--cache':
        options.useCache = true;
        break;
      case '--analyze-first':
        options.analyzeFirst = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
CDK8s Smart Watch - Intelligent file watching with dependency analysis

Usage: npm run watch:smart [options]

Filter Options:
  --pattern <patterns>      Glob patterns (comma-separated)
  --files <files>          Specific files (comma-separated)
  --regex <pattern>        Regex pattern for matching files
  --dir <directories>      Watch specific directories (comma-separated)
  --deps-of <files>        Include dependencies of specified files
  --dependents-of <files>  Include dependents of specified files
  --changed                Include git-changed files
  --exclude <patterns>     Exclude patterns (comma-separated)

Modifiers:
  --include-deps          Include all transitive dependencies
  --include-dependents    Include all transitive dependents

Watch Options:
  --debounce <ms>         Debounce time in milliseconds (default: 1000)
  --clear                 Clear console on each synthesis
  --stats                 Show synthesis statistics
  --cache                 Use build cache (experimental)
  --analyze-first         Run dependency analysis before watching

Other Options:
  --verbose, -v           Verbose output
  --dry-run              Show what would be done without doing it
  --help, -h             Show this help

Examples:
  # Watch AI-related charts
  npm run watch:smart --pattern "**/ai/*.ts"
  
  # Watch specific charts and their dependencies
  npm run watch:smart --files "nextjs-chart.ts,postgres-chart.ts" --include-deps
  
  # Watch everything that depends on postgres
  npm run watch:smart --dependents-of "postgres-chart.ts"
  
  # Watch with multiple filters
  npm run watch:smart --dir "charts/applications" --exclude "*test*" --include-deps
`);
}

// Main execution
async function main() {
  const options = parseArgs();
  const watcher = new SmartWatcher(process.cwd(), options);

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