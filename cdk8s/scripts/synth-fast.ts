#!/usr/bin/env ts-node

import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import * as esbuild from 'esbuild';

interface FastSynthOptions {
  compile?: boolean;  // Compile TypeScript first
  charts?: string[];  // Specific charts to synthesize
  verbose?: boolean;
}

class FastSynthesizer {
  private compiledMainPath: string;
  
  constructor(
    private projectRoot: string,
    private options: FastSynthOptions = {}
  ) {
    this.compiledMainPath = path.join(projectRoot, '.build/main.js');
  }

  async synthesize() {
    // Check if we need to compile first
    if (this.options.compile || !fs.existsSync(this.compiledMainPath)) {
      await this.compileTypeScript();
    }

    // Run synthesis with compiled JavaScript
    await this.runSynthesis();
  }

  private async compileTypeScript() {
    console.log('⚡ Fast-compiling TypeScript with esbuild...');
    const startTime = Date.now();

    // Ensure dist/js directory exists
    const distDir = path.dirname(this.compiledMainPath);
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }

    // Just compile main.ts and its dependencies
    await esbuild.build({
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
      logLevel: this.options.verbose ? 'info' : 'error'
    });

    const elapsed = Date.now() - startTime;
    console.log(`✨ Compiled in ${elapsed}ms`);
  }


  private async runSynthesis(): Promise<void> {
    return new Promise((resolve, reject) => {
      const env = { ...process.env };
      
      // Add selective synthesis if charts specified
      if (this.options.charts && this.options.charts.length > 0) {
        process.env.CDK8S_CHARTS = this.options.charts.join(',');
        process.env.CDK8S_SELECTIVE_SYNTHESIS = 'true';
      }

      const synthCommand = `. ../.env-files/wi.env && npx cdk8s synth -a 'node ${path.relative(this.projectRoot, this.compiledMainPath)}'`;
      const synthProcess = spawn('bash', ['-c', synthCommand], {
        cwd: this.projectRoot,
        env,
        stdio: 'inherit'
      });

      synthProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Synthesis completed successfully!');
          resolve();
        } else {
          reject(new Error(`Synthesis failed with code ${code}`));
        }
      });

      synthProcess.on('error', reject);
    });
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const options: FastSynthOptions = {
    compile: args.includes('--compile'),
    verbose: args.includes('--verbose') || args.includes('-v')
  };

  // Parse charts
  const chartsIndex = args.indexOf('--charts');
  if (chartsIndex !== -1 && args[chartsIndex + 1]) {
    options.charts = args[chartsIndex + 1].split(',');
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Fast CDK8s Synthesis using pre-compiled JavaScript

Usage: npm run synth:fast [options]

Options:
  --compile          Force recompilation before synthesis
  --charts <names>   Selective synthesis (comma-separated)
  --verbose, -v      Verbose output
  --help, -h         Show this help

Examples:
  # Fast synthesis (uses existing compiled JS)
  npm run synth:fast
  
  # Compile and synthesize
  npm run synth:fast -- --compile
  
  # Selective fast synthesis
  npm run synth:fast -- --charts NextJsChart,PostgresChart

Note: For watch mode, use the watch-smart-fast script:
  npm run watch:smart:fast
`);
    process.exit(0);
  }

  const synthesizer = new FastSynthesizer(process.cwd(), options);
  
  try {
    await synthesizer.synthesize();
  } catch (error) {
    console.error('❌ Fast synthesis failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}