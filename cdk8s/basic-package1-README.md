# Basic Package1 ArgoCD Application

This directory contains CDK8s TypeScript implementations that synthesize to the equivalent of the ArgoCD Application defined in `/home/vscode/stacks/basic/package1/app.yaml`.

## Original YAML

The original `app.yaml` defines a simple ArgoCD Application that:
- Uses `cnoe://manifests` to sync from a local directory
- Deploys to the `my-app` namespace
- Has automated sync with self-heal enabled
- Creates the namespace if it doesn't exist

## CDK8s Implementations

### 1. Using ApplicationConstruct (`basic-package1-app.ts`)

This version uses our custom `ApplicationConstruct` wrapper:

```typescript
new ApplicationConstruct(this, 'my-app', {
  name: 'my-app',
  namespace: 'argocd',
  environment: 'local',
  useCnoePrefix: true,
  path: 'manifests',
  destinationNamespace: 'my-app',
  createNamespace: true,
  automatedSync: true,
  selfHeal: true,
  repository: {},
  labels: {
    'example': 'basic',
  },
});
```

### 2. Direct Application (`basic-package1-app-direct.ts`)

This version uses the imported ArgoCD Application type directly:

```typescript
new Application(this, 'my-app', {
  metadata: {
    name: 'my-app',
    namespace: 'argocd',
    labels: {
      'example': 'basic',
    },
  },
  spec: {
    destination: {
      namespace: 'my-app',
      server: 'https://kubernetes.default.svc',
    },
    source: {
      repoUrl: 'cnoe://manifests',
      targetRevision: 'HEAD',
      path: '.',
    },
    project: 'default',
    syncPolicy: {
      automated: {
        selfHeal: true,
      },
      syncOptions: ['CreateNamespace=true'],
    },
  },
});
```

### 3. Multi-Environment (`basic-package1-multi-process.env.ts`)

This version demonstrates how the same application can be deployed to different environments:

- **Local**: Uses `cnoe://manifests` (same as original)
- **Production**: Uses GitHub repository
- **Factory Pattern**: Shows how to use the factory for consistent configuration

## Running the Examples

1. Synthesize a specific version:
```bash
npx ts-node basic-package1-app.ts
```

2. View the generated YAML:
```bash
cat dist/basic-package1.k8s.yaml
```

3. Apply to cluster:
```bash
kubectl apply -f dist/basic-package1.k8s.yaml
```

## Comparison

All versions generate functionally equivalent YAML, with minor differences:

- **ApplicationConstruct version**: Adds extra labels like `app.kubernetes.io/managed-by: cdk8s`
- **Direct version**: Produces YAML closest to the original
- **Multi-env version**: Adds environment-specific configurations

## Benefits of CDK8s Approach

1. **Type Safety**: TypeScript provides compile-time type checking
2. **Reusability**: Create multiple similar applications with different parameters
3. **Environment Management**: Easy to manage different configurations for different environments
4. **Programmatic Control**: Use loops, conditions, and functions to generate complex configurations
5. **IDE Support**: Get autocomplete, documentation, and error checking in your IDE