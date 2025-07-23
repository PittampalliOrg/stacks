# CDK8s Development Workflow Guide

This guide provides best practices and workflows for efficient CDK8s development using the synthesis optimization features.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Workflows](#development-workflows)
3. [Feature Development](#feature-development)
4. [Debugging Workflows](#debugging-workflows)
5. [Team Collaboration](#team-collaboration)
6. [CI/CD Integration](#cicd-integration)

## Getting Started

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd cdk8s

# Install dependencies
npm install

# Analyze dependencies (important for smart synthesis)
npm run analyze:deps

# Verify setup
npm run synth:fast -- --compile
```

### Understanding Your Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `watch:smart:fast` | Development with auto-rebuild | Active coding |
| `synth:fast` | Quick full synthesis | Before commits |
| `synth:selective` | Targeted synthesis | Testing specific charts |
| `synth:parallel` | Multi-core synthesis | CI/CD pipelines |

## Development Workflows

### 1. Daily Development Flow

**Morning Setup**
```bash
# Pull latest changes
git pull origin main

# Update dependencies if package.json changed
npm install

# Re-analyze dependencies if charts were added/removed
npm run analyze:deps

# Start development session
npm run watch:smart:fast -- --clear --stats
```

**Active Development**
```bash
# Working on a specific feature
npm run watch:smart:fast -- --pattern myfeature --include-deps

# Working in a specific directory
npm run watch:smart:fast -- --dir charts/applications/myapp

# Maximum feedback speed (no stats, no clear)
npm run watch:smart:fast
```

**Before Committing**
```bash
# Full fast synthesis to verify everything works
npm run synth:fast

# Run tests
npm test

# Selective test of your changes
npm run synth:selective -- --files $(git diff --name-only)
```

### 2. Feature Branch Workflow

```bash
# Create feature branch
git checkout -b feature/my-new-chart

# Start focused development
npm run watch:smart:fast -- --pattern MyNewChart --stats

# Test with dependencies
npm run synth:selective -- --pattern MyNewChart --include-deps

# Full synthesis before PR
npm run synth:fast -- --compile
```

### 3. Bug Fix Workflow

```bash
# Identify affected charts
npm run analyze:deps -- --deps-of BrokenChart

# Watch the broken chart and its dependencies
npm run watch:smart:fast -- --pattern BrokenChart --include-deps --verbose

# Test the fix
npm run synth:selective -- --pattern BrokenChart --include-dependents

# Verify no regressions
npm run synth:fast && npm test
```

## Feature Development

### Creating a New Chart

1. **Create the chart file**
```typescript
// charts/my-new-chart.ts
import { Chart } from '../lib/base-chart';
import { KubeDeployment } from '../imports/k8s';

export class MyNewChart extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    // Implementation
  }
}
```

2. **Add to main.ts**
```typescript
import { MyNewChart } from './charts/my-new-chart';

// In your app
new MyNewChart(app, 'my-new-chart');
```

3. **Update dependencies**
```bash
# Re-analyze to include new chart
npm run analyze:deps

# Start development
npm run watch:smart:fast -- --pattern MyNewChart
```

### Working with Dependencies

**Upstream Changes** (modifying a base class or library)
```bash
# Find all affected charts
npm run analyze:deps -- --dependents-of BaseChart

# Watch all affected charts
npm run watch:smart:fast -- --deps-of BaseChart
```

**Downstream Changes** (modifying dependent charts)
```bash
# Watch a chart and what it depends on
npm run watch:smart:fast -- --pattern MyApp --include-deps
```

### Multi-Chart Features

```bash
# Working on related charts
npm run watch:smart:fast -- --pattern "postgres,redis,app" --stats

# Working on a feature area
npm run watch:smart:fast -- --dir charts/applications/analytics

# Using regex for complex patterns
npm run watch:smart:fast -- --regex ".*[Aa]nalytics.*"
```

## Debugging Workflows

### Performance Issues

```bash
# Identify slow charts
npm run synth:parallel -- --stats --verbose

# Profile specific chart
time npm run synth:selective -- --pattern SlowChart --verbose

# Compare methods
npm run test:performance -- --chart SlowChart
```

### Dependency Issues

```bash
# Visualize dependencies
npm run analyze:deps -- --output-graph

# Check specific relationships
npm run analyze:deps -- --verbose | grep -A5 -B5 MyChart

# Force fresh analysis
rm dependency-graph.json && npm run analyze:deps -- --verbose
```

### Synthesis Errors

```bash
# Debug mode
DEBUG=cdk8s:* npm run synth:selective -- --pattern BrokenChart

# Check TypeScript errors
npx tsc --noEmit

# Isolated synthesis
npm run synth:selective -- --pattern BrokenChart --no-deps
```

## Team Collaboration

### Shared Development Practices

1. **Consistent Dependency Analysis**
```json
// package.json
{
  "scripts": {
    "postinstall": "npm run analyze:deps",
    "postpull": "npm run analyze:deps"
  }
}
```

2. **Team Aliases**
```bash
# .teamrc or shared shell config
alias cdk8s-dev='npm run watch:smart:fast -- --clear --stats'
alias cdk8s-test='npm run synth:selective -- --files $(git diff --name-only origin/main)'
alias cdk8s-build='npm run synth:fast -- --compile'
```

3. **Pre-commit Hooks**
```bash
#!/bin/bash
# .git/hooks/pre-commit

# Only synthesize changed charts
CHANGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|js)$')
if [ -n "$CHANGED_FILES" ]; then
  npm run synth:selective -- --files "$CHANGED_FILES" || exit 1
fi
```

### Parallel Development

When multiple developers work on different charts:

```bash
# Developer 1: Working on backend
npm run watch:smart:fast -- --pattern "postgres,redis,api"

# Developer 2: Working on frontend
npm run watch:smart:fast -- --pattern "nextjs,nginx"

# Developer 3: Working on monitoring
npm run watch:smart:fast -- --dir charts/monitoring
```

### Merge Conflict Resolution

```bash
# After resolving conflicts, rebuild everything
rm -rf .build/ dist/
npm run analyze:deps
npm run synth:fast -- --compile

# Verify specific charts
npm run synth:selective -- --files $(git diff --name-only HEAD~1)
```

## CI/CD Integration

### GitHub Actions

```yaml
name: CDK8s Synthesis
on: [push, pull_request]

jobs:
  synth:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Analyze dependencies
        run: npm run analyze:deps
      
      - name: Fast synthesis
        run: npm run synth:fast -- --compile
      
      - name: Run tests
        run: npm test

  synth-changed:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Get changed files
        id: changed-files
        run: |
          echo "files=$(git diff --name-only origin/${{ github.base_ref }}...HEAD | grep -E '\.(ts|js)$' | tr '\n' ',' | sed 's/,$//')" >> $GITHUB_OUTPUT
      
      - name: Selective synthesis
        if: steps.changed-files.outputs.files != ''
        run: npm run synth:selective -- --files "${{ steps.changed-files.outputs.files }}"
```

### GitLab CI

```yaml
stages:
  - build
  - test

variables:
  NPM_CONFIG_CACHE: "$CI_PROJECT_DIR/.npm"

cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - .npm/
    - node_modules/
    - dependency-graph.json
    - .build/

synth:fast:
  stage: build
  script:
    - npm ci
    - npm run analyze:deps
    - npm run synth:fast -- --compile
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour

synth:parallel:
  stage: build
  script:
    - npm ci
    - npm run synth:parallel -- --workers $(nproc)
  only:
    - main
    - production
```

### Performance Optimization in CI

```bash
# Optimize for CI environments
export FORCE_COLOR=0  # Disable color output
export CI=true        # Enable CI optimizations

# Use maximum parallelization
npm run synth:parallel -- --workers $(nproc) --no-stats

# Cache compilation results
if [ -d ".build" ]; then
  echo "Using cached compilation"
  npm run synth:fast
else
  echo "Fresh compilation required"
  npm run synth:fast -- --compile
fi
```

## Best Practices Summary

### DO's
- ✅ Run `analyze:deps` after adding/removing charts
- ✅ Use `watch:smart:fast` during development
- ✅ Commit `dependency-graph.json` for team consistency
- ✅ Use selective synthesis in CI for PRs
- ✅ Clean `.build/` directory periodically

### DON'Ts
- ❌ Don't commit `.build/` directory
- ❌ Don't skip dependency analysis after structural changes
- ❌ Don't use standard `npm run synth` when faster options exist
- ❌ Don't modify `cdk8s.yaml` manually during fast synthesis

### Performance Tips

1. **Development Machine**
   - Use `watch:smart:fast` exclusively
   - Keep dependency graph updated
   - Use `--clear` flag for cleaner output

2. **CI Environment**
   - Use `synth:parallel` with optimal workers
   - Cache `.build/` directory between runs
   - Use selective synthesis for PRs

3. **Large Projects**
   - Split charts into logical groups
   - Use directory-based watching
   - Leverage parallel synthesis

---

For more details, see:
- [Synthesis Optimizations Guide](./synthesis-optimizations.md)
- [Quick Reference](./synthesis-quick-reference.md)