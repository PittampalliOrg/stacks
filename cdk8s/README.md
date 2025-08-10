# CDK8s Project

A comprehensive CDK8s project with advanced synthesis optimizations, GitOps integration, and intelligent development workflows.

## Key Features

- **⚡ Ultra-Fast Synthesis**: 12-20x faster synthesis with esbuild and selective compilation
- **🎯 Smart Development**: Intelligent file watching with dependency-aware rebuilds  
- **🚀 Parallel Processing**: Synthesize independent charts simultaneously
- **📊 Dependency Analysis**: Automatic chart relationship mapping
- **🔧 GitOps Ready**: Full ArgoCD integration with Kargo pipelines
- **🎨 Developer Experience**: Optimized workflows for rapid iteration

## Quick Start

### Prerequisites
- Node.js 18+
- TypeScript
- CDK8s CLI
- kubectl (for deployment)

### Installation

```bash
# Install dependencies
npm install

# First-time setup: analyze chart dependencies
npm run analyze:deps

# Fast synthesis (recommended)
npm run synth:fast
```

## 🚀 Synthesis Performance

Our optimized synthesis pipeline reduces build times dramatically:

| Method | Time | Use Case |
|--------|------|----------|
| Standard synthesis | ~60s | Baseline |
| Fast synthesis | ~15s | Full builds |
| Selective synthesis | ~5s | Single charts |
| Smart watch | ~3s | Development |

[Learn more about synthesis optimizations →](docs/synthesis-optimizations.md)

## Development Workflows

### 1. Smart Development Mode

Watch files intelligently and only rebuild affected charts:

```bash
# Watch all files with fast compilation
npm run watch:smart:fast

# Watch specific feature area
npm run watch:smart:fast -- --pattern "charts/apps/**" --stats

# Watch with dependencies
npm run watch:smart:fast -- --files my-chart.ts --include-deps
```

### 2. Selective Synthesis

Build only what you need:

```bash
# Synthesize specific charts
npm run synth:selective -- --charts NextJsChart,PostgresChart

# Include ArgoCD applications
npm run synth:selective -- --charts NextJsChart --include-apps
```

### 3. Fast Full Synthesis

For CI/CD and full builds:

```bash
# Fast synthesis with esbuild
npm run synth:fast

# Force recompilation
npm run synth:fast -- --compile
```

[See all commands →](docs/synthesis-quick-reference.md)

## Project Structure

```
.
├── charts/              # CDK8s chart definitions
│   ├── applications/    # ArgoCD application charts
│   ├── base-chart.ts    # Base chart class
│   └── ...             # Individual charts
├── lib/                 # Shared libraries and utilities
├── scripts/             # Build and development tools
│   ├── synth-fast.ts    # Fast synthesis engine
│   ├── synth-selective.ts # Selective synthesis
│   └── watch-smart.ts   # Smart file watcher
├── dist/                # Synthesized Kubernetes manifests
└── docs/                # Documentation
```

## Available Scripts

### Core Commands

| Command | Description |
|---------|-------------|
| `npm run synth` | Standard synthesis (slow) |
| `npm run synth:fast` | Fast synthesis with esbuild |
| `npm run synth:selective` | Selective chart synthesis |
| `npm run watch:smart:fast` | Smart watch with fast compilation |
| `npm run analyze:deps` | Analyze chart dependencies |
| `npm run compile:fast` | Fast TypeScript compilation |

### Testing & Validation

| Command | Description |
|---------|-------------|
| `npm test` | Run tests |
| `npm run test:update` | Update test snapshots |
| `npm run import` | Import CRDs |

### GitOps & Deployment

| Command | Description |
|---------|-------------|
| `npm run deploy` | Deploy to Kubernetes |
| `npm run destroy` | Remove from Kubernetes |

## VCluster Targets

- Some apps (for example `sample-vcluster-app`) target a vcluster using Argo CD `spec.destination.name` (e.g., `staging-vcluster`).
- Ensure vclusters are registered as Argo CD clusters before syncing these apps:

```bash
# After creating vclusters via IDPBuilder
idpbuilder create -p vcluster-multi-env

# Register vclusters in Argo CD (idempotent)
bash scripts/ensure-vclusters-registered.sh

# Then synthesize and sync CDK8s apps
npm run synth:fast
idpbuilder create -p cdk8s/dist
```

Troubleshooting:
- If an Argo CD Application shows `InvalidSpecError: there are no clusters with this name: staging-vcluster`, run `bash scripts/ensure-vclusters-registered.sh` and retry.

## Documentation

- [Synthesis Optimizations Guide](docs/synthesis-optimizations.md) - Detailed guide on performance features
- [Quick Reference](docs/synthesis-quick-reference.md) - Command cheat sheet
- [Script Documentation](scripts/README.md) - Smart watch and selective synthesis

## Architecture Highlights

### Dependency Analysis
The project uses TypeScript AST analysis to automatically map relationships between charts, enabling:
- Selective synthesis of only affected charts
- Impact analysis for changes
- Parallel synthesis of independent charts

### Fast Compilation
Using esbuild instead of tsc provides:
- 52x faster TypeScript compilation
- Incremental builds
- Watch mode integration

### Smart Filtering
Flexible filtering system supports:
- Glob patterns
- Regex matching
- Dependency-based selection
- Git change detection

## Contributing

1. Run dependency analysis after adding new charts: `npm run analyze:deps`
2. Use smart watch during development: `npm run watch:smart:fast`
3. Test with selective synthesis before committing
4. Ensure all tests pass: `npm test`

## Performance Tips

1. **Keep dependencies updated**: Run `npm run analyze:deps` after structural changes
2. **Use the right tool**: 
   - Development: `watch:smart:fast`
   - CI/CD: `synth:fast`
   - Testing: `synth:selective`
3. **Monitor performance**: Use `--stats` flag to track synthesis times

## Troubleshooting

### Common Issues

**"Dependency graph not found"**
```bash
npm run analyze:deps
```

**"Compilation failed"**
```bash
# Check TypeScript errors
npx tsc --noEmit
```

**"Chart not found"**
- Use exact class names (e.g., `NextJsChart`, not `nextjs`)
- Run `npm run analyze:deps -- --verbose` to see all charts

[Full troubleshooting guide →](docs/synthesis-optimizations.md#troubleshooting)

## License

This project is licensed under the MIT License.
