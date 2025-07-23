# CDK8s Smart Watch and Selective Synthesis

This directory contains scripts for intelligent CDK8s synthesis with dependency analysis and selective compilation.

## Overview

The smart watch system dramatically reduces synthesis time by:
- Analyzing dependencies between charts using TypeScript AST
- Only synthesizing charts affected by file changes
- Supporting flexible filtering patterns
- Providing impact analysis for changes

## Scripts

### 1. Dependency Analyzer (`analyze-dependencies.ts`)

Analyzes all CDK8s charts and builds a dependency graph.

```bash
# Basic analysis
npm run analyze:deps

# With verbose output
npm run analyze:deps -- --verbose

# Generate Mermaid diagram
npm run deps:visualize

# Generate GraphViz output
npm run analyze:deps -- --format=graphviz
```

### 2. Smart Watch (`watch-smart.ts`)

Watches for file changes and only synthesizes affected charts.

```bash
# Watch AI-related charts
npm run watch:smart -- --pattern "**/ai/*.ts"

# Watch specific charts and their dependencies
npm run watch:smart -- --files "nextjs-chart.ts,postgres-chart.ts" --include-deps

# Watch everything that depends on postgres
npm run watch:smart -- --dependents-of "postgres-chart.ts"

# Watch charts matching a regex
npm run watch:smart -- --regex ".*kargo.*|.*pipeline.*"

# Watch changed files and their impact
npm run watch:smart -- --changed --include-deps --include-dependents

# Combine multiple filters
npm run watch:smart -- --dir "charts/applications" --exclude "*test*" --include-deps
```

#### Filter Options

- `--pattern <patterns>`: Glob patterns (comma-separated)
- `--files <files>`: Specific files (comma-separated)
- `--regex <pattern>`: Regex pattern for matching files
- `--dir <directories>`: Watch specific directories (comma-separated)
- `--deps-of <files>`: Include dependencies of specified files
- `--dependents-of <files>`: Include dependents of specified files
- `--changed`: Include git-changed files
- `--exclude <patterns>`: Exclude patterns (comma-separated)

#### Modifiers

- `--include-deps`: Include all transitive dependencies
- `--include-dependents`: Include all transitive dependents

#### Watch Options

- `--debounce <ms>`: Debounce time in milliseconds (default: 1000)
- `--clear`: Clear console on each synthesis
- `--stats`: Show synthesis statistics
- `--analyze-first`: Run dependency analysis before watching

### 3. Selective Synthesis (`synth-selective.ts`)

Run synthesis for specific charts without watching.

```bash
# Synthesize only NextJS and Postgres charts
npm run synth:selective -- --charts NextJsChart,PostgresChart

# Synthesize with applications
npm run synth:selective -- --charts NextJsChart --include-apps
```

## Performance Benefits

- **80-90% faster** synthesis for single chart changes
- **Targeted development** - work on specific features without waiting
- **Intelligent rebuilds** - only synthesize what's actually affected
- **Better developer experience** with instant feedback

## How It Works

1. **TypeScript AST Analysis**: Uses ts-morph to analyze imports, dependencies, and relationships
2. **Dependency Graph**: Builds a complete graph of chart dependencies
3. **Impact Analysis**: When files change, determines which charts are affected
4. **Selective Loading**: Only loads and synthesizes required charts

## Examples

### Working on NextJS Features
```bash
# Watch only NextJS-related files and their dependencies
npm run watch:smart -- --pattern "*nextjs*" --include-deps
```

### Working on AI Platform
```bash
# Watch all AI/Kagent charts
npm run watch:smart -- --dir "charts/applications/ai" --stats
```

### Quick Single Chart Synthesis
```bash
# Just synthesize a specific chart and its dependencies
npm run synth:selective -- --charts PostgresChart
```

## Tips

1. Run `npm run analyze:deps` first to build the dependency graph
2. Use `--verbose` to see which charts are being synthesized
3. Use `--stats` to track synthesis performance
4. Combine filters for precise targeting
5. Use `--dry-run` to preview what would be synthesized