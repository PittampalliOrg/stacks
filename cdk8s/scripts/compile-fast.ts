#!/usr/bin/env node

import * as esbuild from 'esbuild';
import * as path from 'path';
import * as fs from 'fs';
const glob = require('glob').glob;

interface CompileOptions {
  watch?: boolean;
  sourcemap?: boolean;
  minify?: boolean;
  clean?: boolean;
  verbose?: boolean;
}

class FastCompiler {
  private context?: esbuild.BuildContext;
  
  constructor(
    private projectRoot: string,
    private options: CompileOptions = {}
  ) {}

  async compile() {
    const startTime = Date.now();
    
    if (this.options.clean) {
      await this.clean();
    }

    // Find all TypeScript files to compile
    const entryPoints = await this.getEntryPoints();
    
    if (this.options.verbose) {
      console.log(`🔍 Found ${entryPoints.length} files to compile`);
    }

    const buildOptions: esbuild.BuildOptions = {
      entryPoints,
      bundle: false, // Don't bundle, just transpile
      platform: 'node',
      target: 'node18',
      format: 'cjs',
      outdir: path.join(this.projectRoot, 'dist/js'),
      outbase: this.projectRoot,
      sourcemap: this.options.sourcemap !== false,
      minify: this.options.minify || false,
      keepNames: true,
      logLevel: this.options.verbose ? 'info' : 'error',
      write: true,
      loader: {
        '.ts': 'ts',
        '.json': 'json'
      },
      // Don't use external when bundle is false
      // external: [],
      // Preserve the directory structure
      entryNames: '[dir]/[name]',
    };

    if (this.options.watch) {
      // Create a context for watch mode
      this.context = await esbuild.context(buildOptions);
      
      // Enable watch mode
      await this.context.watch();
      
      console.log('👀 Watching for changes... (Ctrl+C to stop)');
      
      // Initial build
      await this.context.rebuild();
      
      const elapsed = Date.now() - startTime;
      console.log(`✨ Initial compilation completed in ${elapsed}ms`);
      
      // Keep the process alive
      await new Promise(() => {}); // This will run until interrupted
    } else {
      // One-time build
      const result = await esbuild.build(buildOptions);
      
      const elapsed = Date.now() - startTime;
      console.log(`✨ Compilation completed in ${elapsed}ms`);
      
      if (result.errors.length > 0) {
        console.error('❌ Build failed with errors');
        process.exit(1);
      }
    }
  }

  private async getEntryPoints(): Promise<string[]> {
    const patterns = [
      'main.ts',
      'main-*.ts',
      'charts/**/*.ts',
      'lib/**/*.ts',
      'scripts/**/*.ts'
    ];
    
    const files: string[] = [];
    
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: this.projectRoot,
        ignore: [
          '**/node_modules/**',
          '**/*.test.ts',
          '**/*.d.ts',
          '**/dist/**'
        ]
      });
      
      files.push(...matches.map((f: string) => path.join(this.projectRoot, f)));
    }
    
    return [...new Set(files)];
  }

  private async clean() {
    const distDir = path.join(this.projectRoot, 'dist/js');
    
    if (fs.existsSync(distDir)) {
      console.log('🧹 Cleaning dist/js directory...');
      fs.rmSync(distDir, { recursive: true, force: true });
    }
  }

  async stop() {
    if (this.context) {
      await this.context.dispose();
    }
  }
}

// Create esbuild plugin for CDK8s specific handling
function cdk8sPlugin(): esbuild.Plugin {
  return {
    name: 'cdk8s',
    setup(build) {
      // Handle CDK8s imports
      build.onResolve({ filter: /^\.\.\/imports\// }, args => {
        // Ensure imports are resolved correctly
        return {
          path: args.path,
          external: false
        };
      });
    }
  };
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const options: CompileOptions = {
    watch: args.includes('--watch') || args.includes('-w'),
    sourcemap: !args.includes('--no-sourcemap'),
    minify: args.includes('--minify'),
    clean: args.includes('--clean'),
    verbose: args.includes('--verbose') || args.includes('-v')
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Fast TypeScript Compiler using esbuild

Usage: npm run compile:fast [options]

Options:
  --watch, -w        Watch mode
  --no-sourcemap     Disable source maps
  --minify           Minify output
  --clean            Clean output directory first
  --verbose, -v      Verbose output
  --help, -h         Show this help

Examples:
  # One-time compilation
  npm run compile:fast
  
  # Watch mode
  npm run compile:fast -- --watch
  
  # Clean build
  npm run compile:fast -- --clean
`);
    process.exit(0);
  }

  const compiler = new FastCompiler(process.cwd(), options);
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n👋 Stopping compiler...');
    await compiler.stop();
    process.exit(0);
  });

  try {
    await compiler.compile();
  } catch (error) {
    console.error('❌ Compilation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}