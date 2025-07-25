# ArgoCD Application CDK8s Constructs

This repository contains CDK8s constructs for creating ArgoCD Applications that work seamlessly in both local development (with idpbuilder/Gitea) and production (with GitHub) environments.

## Features

- **Environment-aware configuration**: Automatically adapts to local (idpbuilder/Gitea) or production (GitHub) environments
- **GitRepository support**: Creates idpbuilder GitRepository resources for local Gitea repositories
- **Authentication handling**: Supports both public and private repositories with credential management
- **Factory pattern**: Provides consistent configuration across multiple applications
- **Type-safe**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
# Import required CRDs
cdk8s import argoproj.io
cdk8s import cnoe.io_gitrepositories:=https://raw.githubusercontent.com/cnoe-io/idpbuilder/main/pkg/controllers/resources/idpbuilder.cnoe.io_gitrepositories.yaml
cdk8s import cnoe.io_localbuilds:=https://raw.githubusercontent.com/cnoe-io/idpbuilder/main/pkg/controllers/resources/idpbuilder.cnoe.io_localbuilds.yaml
```

## Quick Start

### Local Development with cnoe://

```typescript
import { ApplicationConstruct } from './lib/application-construct';

new ApplicationConstruct(this, 'local-app', {
  name: 'my-app',
  environment: 'local',
  useCnoePrefix: true,
  path: '../manifests',
  destinationNamespace: 'my-app',
  createNamespace: true,
  automatedSync: true,
  repository: {},
});
```

### Local Development with Gitea

```typescript
new ApplicationConstruct(this, 'gitea-app', {
  name: 'my-app',
  environment: 'local',
  gitProvider: 'gitea',
  path: 'k8s/overlays/dev',
  destinationNamespace: 'my-app',
  createNamespace: true,
  automatedSync: true,
  repository: {
    organization: 'platform-team',
    name: 'my-application',
  },
});
```

### Production with GitHub

```typescript
new ApplicationConstruct(this, 'prod-app', {
  name: 'my-app',
  environment: 'production',
  gitProvider: 'github',
  path: 'k8s/overlays/production',
  destinationNamespace: 'my-app-prod',
  createNamespace: true,
  automatedSync: true,
  selfHeal: true,
  targetRevision: 'v1.0.0',
  repository: {
    organization: 'mycompany',
    name: 'my-application',
  },
});
```

## Using the Factory Pattern

```typescript
import { ArgoCDFactories } from './lib/argocd-environment-factory';

// Create factories for each environment
const localFactory = ArgoCDFactories.createLocalFactory({
  giteaOrganization: 'dev-team',
});

const prodFactory = ArgoCDFactories.createProductionFactory({
  githubOrganization: 'mycompany',
});

// Create applications with consistent settings
localFactory.createApplication(this, 'app', {
  name: 'microservice',
  path: 'k8s/base',
  destinationNamespace: 'microservices',
  repository: { name: 'microservice' },
  automatedSync: true,
});
```

## Architecture

### Core Components

1. **ApplicationConstruct**: Main construct for creating ArgoCD Applications
   - Handles environment-specific URL generation
   - Manages sync policies and automation
   - Supports Helm and Kustomize configurations

2. **GitRepositoryConstruct**: Wrapper for idpbuilder GitRepository CRD
   - Manages Gitea repositories in local environments
   - Handles authentication configuration
   - Provides helper methods for common patterns

3. **ArgoCDEnvironmentFactory**: Factory for consistent application creation
   - Environment-specific defaults
   - Credential management
   - Batch application creation

### Environment URLs

The constructs automatically generate the correct repository URLs:

- **Local Gitea**: `http://gitea.gitea.svc.cluster.local:3000/{org}/{repo}.git`
- **GitHub**: `https://github.com/{org}/{repo}.git`
- **Local cnoe://**: `cnoe://{relative-path}`

## Examples

See the `examples/` directory for comprehensive examples including:
- Simple local development setup
- Production deployment with authentication
- Helm and Kustomize applications
- Factory pattern usage
- Complete application with credential management

## Generated Resources

### Local Environment with Gitea
- ArgoCD Application resource
- GitRepository resource (for idpbuilder)
- Optional Secret for credentials

### Production Environment
- ArgoCD Application resource
- Optional Secret for credentials (references existing secret)

### Local with cnoe://
- ArgoCD Application resource only

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.