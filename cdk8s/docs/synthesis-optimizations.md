# CDK8s Synthesis Optimizations Guide

## Overview

This guide documents the advanced synthesis optimization features available in the CDK8s project. These optimizations dramatically improve synthesis performance, reduce build times, and enhance the development experience.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Fast Synthesis](#fast-synthesis)
3. [Selective Synthesis](#selective-synthesis)
4. [Parallel Synthesis](#parallel-synthesis)
5. [Smart Watch Mode](#smart-watch-mode)
6. [Performance Benchmarks](#performance-benchmarks)
7. [Usage Guide](#usage-guide)
8. [Troubleshooting](#troubleshooting)

## Architecture Overview

The synthesis optimization system consists of several interconnected components:

```
┌─────────────────────────────────────────────────────────────────┐
│                     CDK8s Project Structure                       │
├─────────────────────────────────────────────────────────────────┤
│  main.ts          - Application entry point                      │
│  charts/          - Individual chart definitions                 │
│  lib/             - Shared libraries and utilities               │
│  scripts/         - Optimization scripts                         │
│    ├── synth-fast.ts              - Fast synthesis with esbuild │
│    ├── synth-selective.ts         - Selective chart synthesis   │
│    ├── parallel-synthesizer.ts    - Parallel synthesis          │
│    ├── watch-smart.ts             - Smart file watching         │
│    ├── watch-smart-fast.ts        - Fast smart watching         │
│    ├── chart-filter.ts            - Chart filtering logic       │
│    └── analyze-dependencies.ts    - Dependency analysis         │
└─────────────────────────────────────────────────────────────────┘
```

## Fast Synthesis

### Overview

Fast synthesis uses esbuild to pre-compile TypeScript code to JavaScript, eliminating the ts-node overhead during synthesis.

### How It Works

1. **Compilation Phase**:
   - Uses esbuild to bundle `main.ts` and all dependencies into `.build/main.js`
   - Compilation typically takes 400-500ms (vs 10-15 seconds with ts-node)
   - Output is placed in `.build/` to avoid conflicts with synthesis output

2. **Synthesis Phase**:
   - Uses the `-a` flag to specify the compiled JavaScript file directly
   - Runs `npx cdk8s synth -a 'node .build/main.js'`
   - No configuration file modifications needed

### Usage

```bash
# Fast synthesis (uses existing compiled JS if available)
npm run synth:fast

# Force recompilation before synthesis
npm run synth:fast -- --compile

# Selective fast synthesis
npm run synth:fast -- --charts NextJsChart,PostgresChart

# Verbose output
npm run synth:fast -- --verbose
```

### Performance Benefits

- **Initial compilation**: ~500ms
- **Subsequent synthesis**: 2-3 seconds (vs 15-20 seconds with ts-node)
- **85-90% faster** than standard synthesis

## Selective Synthesis

### Overview

Selective synthesis allows you to synthesize only specific charts or charts matching certain criteria, dramatically reducing synthesis time when working on individual components.

### Features

1. **Pattern Matching**: Filter charts by name patterns
2. **File-based Selection**: Synthesize charts affected by specific file changes
3. **Directory Filtering**: Select charts in specific directories
4. **Dependency Analysis**: Include dependent/dependency charts automatically

### Usage

```bash
# Synthesize specific charts
npm run synth:selective -- --pattern postgres,redis

# Synthesize charts affected by file changes
npm run synth:selective -- --files charts/postgres-chart.ts

# Include dependencies
npm run synth:selective -- --pattern postgres --include-deps

# Regex pattern matching
npm run synth:selective -- --regex ".*[Dd]atabase.*"
```

### Filtering Options

- `--pattern`: Comma-separated list of chart name patterns
- `--files`: Comma-separated list of changed files
- `--regex`: Regular expression for chart matching
- `--dir`: Filter charts in specific directories
- `--include-deps`: Include charts that depend on selected charts
- `--deps-of`: Select all dependents of specified charts

## Parallel Synthesis

### Overview

Parallel synthesis leverages multi-core processors to synthesize multiple charts concurrently, significantly reducing total synthesis time.

### How It Works

1. **Dependency Analysis**: Builds a dependency graph of all charts
2. **Batch Creation**: Groups charts into batches based on dependencies
3. **Parallel Execution**: Synthesizes charts within each batch concurrently
4. **Ordered Processing**: Ensures dependent charts wait for dependencies

### Usage

```bash
# Parallel synthesis with default settings
npm run synth:parallel

# Custom worker count
npm run synth:parallel -- --workers 8

# Selective parallel synthesis
npm run synth:parallel -- --pattern postgres,redis

# Analyze dependencies first
npm run synth:parallel -- --analyze-first
```

### Performance Scaling

- **2 workers**: ~50% faster
- **4 workers**: ~70% faster
- **8 workers**: ~85% faster (with diminishing returns)

## Smart Watch Mode

### Overview

Smart watch mode combines file watching with intelligent chart selection and optional fast compilation for an optimized development experience.

### Standard Smart Watch

```bash
# Basic smart watch
npm run watch:smart

# Watch specific patterns
npm run watch:smart -- --pattern postgres,redis

# Clear console on each run
npm run watch:smart -- --clear

# Show performance statistics
npm run watch:smart -- --stats
```

### Fast Smart Watch

The fast smart watch combines all optimizations:

```bash
# Fast smart watch with esbuild
npm run watch:smart:fast

# Disable esbuild (use ts-node)
npm run watch:smart:fast -- --no-esbuild

# Watch with statistics
npm run watch:smart:fast -- --stats
```

### How Fast Watch Works

1. **Initial Setup**:
   - Compiles TypeScript to `.build/main.js` using esbuild
   - Sets up file watchers for charts/, lib/, and main.ts
   - Loads dependency graph for smart filtering

2. **On File Change**:
   - Detects which files changed
   - If TypeScript files changed, triggers recompilation (400-500ms)
   - Determines affected charts using dependency analysis
   - Uses `-a` flag to run synthesis with compiled JS
   - Synthesizes only affected charts

3. **Optimizations**:
   - Debounced file watching (500ms default)
   - Incremental compilation with esbuild
   - Selective synthesis based on changes
   - Parallel synthesis when multiple charts affected

## Performance Benchmarks

### Synthesis Time Comparison

| Method | Full Synthesis | Single Chart | 5 Charts |
|--------|---------------|--------------|----------|
| Standard (ts-node) | 45-60s | 15-20s | 25-30s |
| Fast (esbuild) | 3-5s | 2-3s | 3-4s |
| Selective | N/A | 2-15s | 5-20s |
| Parallel (4 workers) | 15-20s | N/A | 8-10s |
| Fast + Parallel | 2-3s | N/A | 2-3s |

### Development Workflow Impact

- **File save to synthesis complete**: 
  - Standard: 15-20 seconds
  - Fast watch: 1-3 seconds
  - **85-90% improvement**

## Usage Guide

### Choosing the Right Approach

1. **Development Workflow**:
   ```bash
   # Best for active development
   npm run watch:smart:fast
   ```

2. **CI/CD Pipeline**:
   ```bash
   # Pre-compile and synthesize
   npm run synth:fast -- --compile
   ```

3. **Working on Specific Charts**:
   ```bash
   # Watch specific charts only
   npm run watch:smart:fast -- --pattern myapp
   ```

4. **Full Project Synthesis**:
   ```bash
   # Parallel synthesis for full project
   npm run synth:parallel -- --workers $(nproc)
   ```

### Best Practices

1. **Use Fast Watch for Development**:
   - Provides fastest feedback loop
   - Automatically recompiles on changes
   - Synthesizes only affected charts

2. **Run Dependency Analysis Periodically**:
   ```bash
   npm run analyze:deps
   ```
   - Improves smart filtering accuracy
   - Run after major refactoring

3. **Configure Worker Count**:
   - Use `$(nproc)` for optimal performance
   - Reduce workers if system becomes unresponsive

4. **Clean Build Periodically**:
   ```bash
   rm -rf .build/ dist/
   npm run synth:fast -- --compile
   ```

## Troubleshooting

### Common Issues

1. **"Cannot find module '.build/main.js'"**
   - **Cause**: Compiled output missing or deleted
   - **Fix**: Run with `--compile` flag or delete `.build/` directory

2. **Changes Not Reflected**
   - **Cause**: File not triggering recompilation
   - **Fix**: Ensure file has `.ts` extension and isn't excluded

3. **Synthesis Still Slow**
   - **Cause**: Not using compiled JavaScript
   - **Check**: Look for "Using esbuild mode" in output
   - **Fix**: Ensure the `.build/main.js` file exists

4. **Parallel Synthesis Hangs**
   - **Cause**: Circular dependencies or resource exhaustion
   - **Fix**: Reduce worker count or check dependency graph

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
# Verbose fast synthesis
npm run synth:fast -- --verbose

# Debug watch mode
npm run watch:smart:fast -- --verbose --stats
```

### Configuration Files

- **cdk8s.yaml**: Main configuration (no longer modified during synthesis)
- **.build/**: Compiled JavaScript output (git-ignored)
- **dependency-graph.json**: Chart dependency analysis cache

## Advanced Configuration

### Environment Variables

```bash
# Custom output directory
CDK8S_OUTPUT_DIR=custom-dist npm run synth:fast

# Selective synthesis via environment
CDK8S_CHARTS=PostgresChart,RedisChart npm run synth

# Enable selective synthesis mode
CDK8S_SELECTIVE_SYNTHESIS=true npm run synth
```

### Integration with CI/CD

```yaml
# GitHub Actions example
- name: Fast Synthesis
  run: |
    npm run synth:fast -- --compile
    
# GitLab CI example  
synth:
  script:
    - npm run synth:parallel -- --workers 4
```

### Custom Scripts

Create custom synthesis workflows:

```json
{
  "scripts": {
    "synth:dev": "npm run watch:smart:fast -- --pattern dev-",
    "synth:prod": "npm run synth:fast -- --compile && npm run test:synth",
    "synth:ci": "npm run synth:parallel -- --workers $(nproc) --analyze-first"
  }
}
```

## Architecture Details

### Dependency Resolution

The system uses multiple strategies for dependency resolution:

1. **Static Analysis**: Parses TypeScript imports
2. **Runtime Detection**: Tracks chart instantiation
3. **Naming Conventions**: Infers relationships from chart names
4. **Explicit Dependencies**: Honors `addDependency()` calls

### File Watching Strategy

- **Debouncing**: Prevents multiple rapid recompilations
- **Selective Watching**: Only watches relevant directories
- **Ignored Patterns**: Excludes test files, build outputs
- **Smart Filtering**: Uses dependency graph for minimal synthesis

### Compilation Strategy

esbuild configuration optimizations:
- **Bundle**: All dependencies in single file
- **Tree Shaking**: Removes unused code
- **Source Maps**: Maintains debugging capability
- **External Modules**: Keeps cdk8s modules external for compatibility

---

This documentation provides a comprehensive guide to the CDK8s synthesis optimizations. For specific implementation details, refer to the individual script files in the `scripts/` directory.