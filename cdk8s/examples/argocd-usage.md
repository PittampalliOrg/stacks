# ArgoCD Application CDK8s Constructs Usage Guide

This guide demonstrates how to use the CDK8s constructs to create ArgoCD Applications that work seamlessly in both local development (with idpbuilder/Gitea) and production (with GitHub) environments.

## Overview

The constructs provide:
- **ApplicationConstruct**: Creates ArgoCD Application resources with environment-aware configuration
- **GitRepositoryConstruct**: Manages idpbuilder GitRepository resources for local Gitea repositories  
- **ArgoCDEnvironmentFactory**: Simplifies creating consistent applications across environments

## Local Development with idpbuilder

### Option 1: Using cnoe:// prefix (Simplest)

For local development when your manifests are in the same repository:

```typescript
new ApplicationConstruct(this, 'local-app', {
  name: 'my-app',
  environment: 'local',
  useCnoePrefix: true,
  path: '../manifests', // Relative path to manifests
  destinationNamespace: 'my-app',
  createNamespace: true,
  automatedSync: true,
  repository: {},
});
```

### Option 2: Using Gitea Repository

For local development with a Gitea repository managed by idpbuilder:

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

This automatically creates:
1. An ArgoCD Application pointing to `http://gitea.gitea.svc.cluster.local:3000/platform-team/my-application.git`
2. A GitRepository resource for idpbuilder to manage the repository

## Production Deployment with GitHub

### Public Repository

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
  prune: true,
  targetRevision: 'v1.2.3',
  repository: {
    url: 'https://github.com/myorg/my-app.git',
  },
});
```

### Private Repository

For private repositories, you need to provide credentials:

```typescript
new ApplicationConstruct(this, 'private-app', {
  name: 'my-private-app',
  environment: 'production',
  gitProvider: 'github',
  path: 'deploy/k8s',
  destinationNamespace: 'my-private-app',
  createNamespace: true,
  automatedSync: false,
  repository: {
    organization: 'myorg',
    name: 'private-app',
    isPrivate: true,
    credentialsSecret: 'github-credentials', // Must exist
  },
});
```

## Using the Environment Factory

The factory pattern provides consistent configuration across multiple applications:

```typescript
// Local development factory
const localFactory = ArgoCDFactories.createLocalFactory({
  argoCDNamespace: 'argocd',
  giteaOrganization: 'platform-team',
});

// Production factory
const prodFactory = ArgoCDFactories.createProductionFactory({
  argoCDNamespace: 'argocd',
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

## Complete Example with Credential Management

```typescript
const factory = ArgoCDFactories.createProductionFactory({
  githubOrganization: 'acme-corp',
});

const { application, gitRepository, credentialsSecret } = 
  factory.createApplicationWithRepository(this, 'app', {
    name: 'enterprise-app',
    path: 'kubernetes/production',
    destinationNamespace: 'enterprise',
    repository: {
      name: 'enterprise-app',
      isPrivate: true,
      credentials: {
        username: 'git',
        password: process.env.GITHUB_TOKEN!,
      },
    },
    targetRevision: 'release-1.0',
    automatedSync: false,
    createNamespace: true,
  });
```

## Environment-Specific URLs

The constructs automatically generate the correct repository URLs:

- **Local Gitea**: `http://gitea.gitea.svc.cluster.local:3000/{org}/{repo}.git`
- **GitHub**: `https://github.com/{org}/{repo}.git`

## Authentication

### Local Development
- Public Gitea repositories: No authentication required
- Private Gitea repositories: Create a secret with username/password

### Production (GitHub)
- Public repositories: No authentication required
- Private repositories: Create a secret with:
  - `username`: Can be any value (e.g., 'git')
  - `password`: GitHub Personal Access Token (PAT)

## Sync Policies

Configure automated sync behavior:

```typescript
{
  automatedSync: true,      // Enable automated sync
  selfHeal: true,          // Auto-correct drift
  prune: true,             // Remove deleted resources
  createNamespace: true,   // Create namespace if missing
  syncOptions: [
    'CreateNamespace=true',
    'PrunePropagationPolicy=foreground',
    'PruneLast=true',
  ],
}
```

## Helm and Kustomize Support

### Helm Applications

```typescript
{
  helm: {
    releaseName: 'prometheus',
    valueFiles: ['values.yaml', 'values-prod.yaml'],
    values: 'key: value',
  },
}
```

### Kustomize Applications

```typescript
{
  kustomize: {
    images: ['myapp=myregistry/myapp:dev-latest'],
  },
}
```

## Running the Examples

1. Import the constructs:
```bash
cdk8s import argoproj.io
cdk8s import cnoe.io_gitrepositories:=https://raw.githubusercontent.com/cnoe-io/idpbuilder/main/pkg/controllers/resources/idpbuilder.cnoe.io_gitrepositories.yaml
```

2. Synthesize the manifests:
```bash
cdk8s synth
```

3. Apply to your cluster:
```bash
kubectl apply -f dist/
```

## Best Practices

1. **Use environment factories** for consistent configuration across applications
2. **Store credentials securely** - Never hardcode credentials in your code
3. **Use specific tags/versions** for production deployments
4. **Enable automated sync** for development, manual sync for production
5. **Configure appropriate sync policies** based on your requirements
6. **Use GitRepository resources** for local Gitea repositories with idpbuilder