# CDK8s Synthesis Quick Reference

## Command Cheat Sheet

### 🚀 Most Common Commands

```bash
# Development - watch files and rebuild on change
npm run watch:smart:fast

# Fast synthesis - full project with esbuild
npm run synth:fast

# Selective synthesis - specific charts only
npm run synth:selective -- --pattern postgres,redis

# Parallel synthesis - use all CPU cores
npm run synth:parallel
```

### 📊 Analysis & Dependencies

```bash
# Analyze chart dependencies (run after adding new charts)
npm run analyze:deps

# Verbose dependency analysis
npm run analyze:deps -- --verbose

# Show dependency graph
npm run analyze:deps -- --output-graph
```

## Development Workflows

### 🎯 Working on a Single Chart

```bash
# Watch a specific chart and its dependencies
npm run watch:smart:fast -- --pattern MyChart --include-deps

# Synthesize just one chart
npm run synth:selective -- --pattern MyChart

# Fast synthesis of one chart
npm run synth:fast -- --charts MyChart
```

### 🔧 Working on a Feature Area

```bash
# Watch all database-related charts
npm run watch:smart:fast -- --pattern postgres,redis,mysql

# Watch charts in a specific directory
npm run watch:smart:fast -- --dir charts/applications/databases

# Use regex for complex patterns
npm run watch:smart:fast -- --regex ".*[Dd]atabase.*"
```

### 🏗️ Full Project Builds

```bash
# Fast synthesis with fresh compilation
npm run synth:fast -- --compile

# Parallel synthesis with optimal workers
npm run synth:parallel -- --workers $(nproc)

# Standard synthesis (fallback)
npm run synth
```

## Filtering Options

### Pattern Matching

```bash
# Simple pattern (partial match)
--pattern postgres

# Multiple patterns
--pattern postgres,redis,mysql

# Exact match
--pattern "^PostgresChart$"
```

### File-Based Selection

```bash
# Single file
--files charts/postgres-chart.ts

# Multiple files
--files charts/postgres-chart.ts,lib/utils.ts

# Changed files (Git)
--files $(git diff --name-only HEAD)
```

### Dependency Options

```bash
# Include dependencies of selected charts
--include-deps

# Include charts that depend on selected
--include-dependents

# Select all dependents of a chart
--deps-of PostgresChart

# Select dependencies of a chart
--dependencies-of AppChart
```

### Directory Filtering

```bash
# Single directory
--dir charts/applications

# Multiple directories
--dir charts/applications,charts/infrastructure

# Recursive directory match
--dir "**/databases"
```

## Performance Flags

### Speed Optimizations

```bash
# Force compilation before synthesis
--compile

# Skip compilation check
--no-compile

# Use specific worker count
--workers 4

# Disable esbuild (fallback to ts-node)
--no-esbuild
```

### Output Options

```bash
# Verbose output
--verbose, -v

# Show performance statistics
--stats

# Clear console before each run
--clear

# Custom output directory
--output-dir custom-dist
```

## Common Use Cases

### CI/CD Pipeline

```bash
# Fast synthesis with compilation
npm run synth:fast -- --compile

# Parallel synthesis for speed
npm run synth:parallel -- --workers 4

# Selective synthesis for changed files
npm run synth:selective -- --files $(git diff --name-only origin/main)
```

### Local Development

```bash
# Start development session
npm run watch:smart:fast -- --clear --stats

# Focus on your feature
npm run watch:smart:fast -- --pattern myfeature

# Include related charts
npm run watch:smart:fast -- --pattern myfeature --include-deps
```

### Testing Changes

```bash
# Test single chart synthesis
npm run synth:selective -- --pattern MyChart --verbose

# Test with dependencies
npm run synth:selective -- --pattern MyChart --include-deps

# Dry run (see what would be synthesized)
npm run synth:selective -- --pattern MyChart --dry-run
```

## Environment Variables

```bash
# Enable selective synthesis globally
export CDK8S_SELECTIVE_SYNTHESIS=true

# Set specific charts
export CDK8S_CHARTS=PostgresChart,RedisChart

# Custom output directory
export CDK8S_OUTPUT_DIR=custom-dist

# Debug mode
export DEBUG=cdk8s:*
```

## Debugging

### Verbose Modes

```bash
# Verbose synthesis
npm run synth:fast -- --verbose

# Debug dependency analysis
npm run analyze:deps -- --verbose --debug

# Stats for performance analysis
npm run watch:smart:fast -- --stats --verbose
```

### Common Issues Quick Fixes

```bash
# Missing dependencies error
npm run analyze:deps

# Compilation errors
npx tsc --noEmit

# Clean rebuild
rm -rf .build/ dist/ && npm run synth:fast -- --compile

# Reset dependency cache
rm dependency-graph.json && npm run analyze:deps
```

## Advanced Combinations

### Complex Filtering

```bash
# Multiple filters combined
npm run synth:selective -- \
  --pattern postgres \
  --dir charts/databases \
  --include-deps \
  --stats

# Regex with dependencies
npm run synth:selective -- \
  --regex ".*Database.*" \
  --include-dependents \
  --verbose
```

### Performance Testing

```bash
# Compare synthesis methods
time npm run synth
time npm run synth:fast
time npm run synth:parallel -- --workers 8

# Benchmark specific charts
npm run synth:selective -- --pattern MyChart --stats --repeat 5
```

## Tips & Tricks

### 1. Fastest Development Loop
```bash
# One-time setup
npm run analyze:deps

# Start coding
npm run watch:smart:fast -- --clear --stats
```

### 2. Pre-commit Hook
```bash
# In .git/hooks/pre-commit
npm run synth:selective -- --files $(git diff --cached --name-only) --fail-on-error
```

### 3. Aliases for Common Commands
```bash
# Add to ~/.bashrc or ~/.zshrc
alias cdk8s-watch='npm run watch:smart:fast -- --clear --stats'
alias cdk8s-synth='npm run synth:fast'
alias cdk8s-check='npm run synth:selective -- --dry-run'
```

### 4. Custom NPM Scripts
```json
{
  "scripts": {
    "dev": "npm run watch:smart:fast -- --clear --stats",
    "build:prod": "npm run synth:fast -- --compile",
    "build:ci": "npm run synth:parallel -- --workers $(nproc)"
  }
}
```

---

For detailed documentation, see the [Synthesis Optimizations Guide](./synthesis-optimizations.md)