# Basic Package1 App - CDK8s Implementation Summary

## Overview

I've created several CDK8s TypeScript files that synthesize to the equivalent of `/home/vscode/stacks/basic/package1/app.yaml`:

### Files Created

1. **`basic-package1-app.ts`** - Uses the ApplicationConstruct wrapper
2. **`basic-package1-app-direct.ts`** - Uses the ArgoCD Application type directly
3. **`basic-package1-multi-process.env.ts`** - Shows multi-environment deployment options
4. **`basic-package1-README.md`** - Documentation for all implementations

## Key Features of the Original app.yaml

- Uses `cnoe://manifests` for local directory sync
- Deploys to `my-app` namespace with auto-creation
- Automated sync with self-heal enabled
- Simple, straightforward ArgoCD application

## CDK8s Implementation Details

### ApplicationConstruct Version
```bash
npx ts-node basic-package1-app.ts
```

Generates:
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  labels:
    app.kubernetes.io/managed-by: cdk8s
    argocd.environment: local
    example: basic
  name: my-app
  namespace: argocd
spec:
  destination:
    namespace: my-app
    server: https://kubernetes.default.svc
  project: default
  source:
    path: "."
    repoURL: cnoe://manifests
    targetRevision: HEAD
  syncPolicy:
    automated:
      prune: false
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

### Direct Version
```bash
npx ts-node basic-package1-app-direct.ts
```

This version produces YAML that's virtually identical to the original, with only formatting differences.

## Benefits of CDK8s Approach

1. **Type Safety**: Full TypeScript support catches errors at compile time
2. **Reusability**: Easy to create variations for different environments
3. **Programmability**: Use loops, conditions, and functions for complex scenarios
4. **Integration**: Works seamlessly with the ArgoCD constructs library
5. **Version Control**: Better diffing and code review compared to YAML

## Usage

To use any of these implementations:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the desired version:
   ```bash
   npx ts-node basic-package1-app.ts
   ```

3. Apply the generated YAML:
   ```bash
   kubectl apply -f dist/basic-package1.k8s.yaml
   ```

## Multi-Environment Support

The `basic-package1-multi-process.env.ts` file demonstrates how the same application can be deployed to:
- Local environment (using cnoe://)
- Production environment (using GitHub)
- Using factory patterns for consistency

This showcases the power of CDK8s for managing applications across different environments with a single codebase.