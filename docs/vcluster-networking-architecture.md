# vCluster Networking Architecture

## Overview

This document describes the networking architecture for vCluster deployments in our CDK8s-based platform, specifically addressing how we expose vCluster API servers through Kubernetes Ingress with SSL passthrough. This approach solves connectivity issues commonly encountered with Docker Desktop's WSL2 integration and provides a stable, production-like access pattern.

## Architecture Components

### 1. Kind Cluster Configuration

Our Kind cluster is configured with specific port mappings to enable external access:

```yaml
nodes:
- extraPortMappings:
  - containerPort: 443
    hostPort: 8443
    protocol: TCP
```

This mapping exposes the Kind cluster's port 443 (where nginx-ingress listens) to the host's port 8443, allowing external HTTPS traffic to reach the cluster.

### 2. vCluster Deployment Structure

Each vCluster deployment consists of:

1. **vCluster StatefulSet**: The main vCluster components (syncer and embedded k3s)
2. **vCluster Service**: ClusterIP service exposing ports 443 and 10250
3. **vCluster Ingress**: NGINX ingress with SSL passthrough for API access

```
┌─────────────────────────────────────────────────────────┐
│                     Host Machine (WSL2)                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  https://dev-vcluster.cnoe.localtest.me:8443           │
│                         │                                │
│                         ▼                                │
│  ┌───────────────────────────────────────────────────┐  │
│  │          Docker Desktop (WSL2 Integration)        │  │
│  ├───────────────────────────────────────────────────┤  │
│  │                                                    │  │
│  │  ┌──────────────────────────────────────────────┐ │  │
│  │  │         Kind Container (localdev)            │ │  │
│  │  ├──────────────────────────────────────────────┤ │  │
│  │  │                                               │ │  │
│  │  │  Port Mapping: Host 8443 → Container 443     │ │  │
│  │  │                                               │ │  │
│  │  │  ┌─────────────────────────────────────────┐ │ │  │
│  │  │  │    NGINX Ingress Controller (Port 443)  │ │ │  │
│  │  │  │         SSL Passthrough Enabled         │ │ │  │
│  │  │  └─────────────┬───────────────────────────┘ │ │  │
│  │  │                │                             │ │  │
│  │  │                ▼                             │ │  │
│  │  │  ┌─────────────────────────────────────────┐ │ │  │
│  │  │  │        vCluster Ingress                 │ │ │  │
│  │  │  │   Host: dev-vcluster.cnoe.localtest.me  │ │ │  │
│  │  │  │   Backend: vcluster-dev-helm:443        │ │ │  │
│  │  │  └─────────────┬───────────────────────────┘ │ │  │
│  │  │                │                             │ │  │
│  │  │                ▼                             │ │  │
│  │  │  ┌─────────────────────────────────────────┐ │ │  │
│  │  │  │      vCluster Service (Port 443)        │ │ │  │
│  │  │  │       TargetPort: 8443                  │ │ │  │
│  │  │  └─────────────┬───────────────────────────┘ │ │  │
│  │  │                │                             │ │  │
│  │  │                ▼                             │ │  │
│  │  │  ┌─────────────────────────────────────────┐ │ │  │
│  │  │  │    vCluster Pod (Syncer Port 8443)      │ │ │  │
│  │  │  │         Embedded k3s API Server          │ │ │  │
│  │  │  └─────────────────────────────────────────┘ │ │  │
│  │  │                                               │ │  │
│  │  └──────────────────────────────────────────────┘ │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### SSL Passthrough vs Termination

We use **SSL passthrough** instead of SSL termination at the ingress level. This is critical because:

1. **Certificate Trust**: vCluster generates its own certificates for the API server
2. **Direct TLS Connection**: Clients establish TLS directly with the vCluster API server
3. **Security**: No decryption/re-encryption at the ingress layer
4. **Compatibility**: Works with kubectl and other Kubernetes clients expecting proper TLS

### Ingress Configuration

The vCluster ingress requires specific annotations for SSL passthrough:

```yaml
annotations:
  nginx.ingress.kubernetes.io/backend-protocol: HTTPS
  nginx.ingress.kubernetes.io/ssl-passthrough: "true"
  nginx.ingress.kubernetes.io/ssl-redirect: "true"
```

### Port Configuration

- **vCluster Syncer**: Listens on port 8443 (default)
- **vCluster Service**: Maps port 443 → targetPort 8443
- **NGINX Ingress**: Receives on port 443, passes through to service
- **Kind Mapping**: Host port 8443 → Container port 443
- **External Access**: `https://dev-vcluster.cnoe.localtest.me:8443`

## WSL2 and Docker Desktop Considerations

### The Challenge

Docker Desktop with WSL2 integration introduces networking complexities:

1. **Network Isolation**: WSL2 runs in a lightweight VM with its own network namespace
2. **Port Forwarding Issues**: Direct port-forwarding from WSL2 to Docker containers can fail
3. **Network Namespace Conflicts**: vCluster CLI's port-forward mechanism conflicts with Docker Desktop's network handling

### Our Solution

By using Ingress with SSL passthrough, we avoid these issues:

1. **No Port Forwarding**: Traffic flows through standard HTTPS ingress
2. **DNS Resolution**: `*.localtest.me` resolves to 127.0.0.1 globally
3. **Stable Endpoints**: Ingress provides consistent URLs regardless of pod restarts
4. **Native Docker Desktop Support**: Uses Docker Desktop's built-in port mapping

## Implementation Details

### CDK8s Chart Structure

Our implementation consists of separate charts for clear separation of concerns:

1. **VclusterDevChart/VclusterStagingChart**: Deploys vCluster using Helm
2. **VclusterDevIngressChart/VclusterStagingIngressChart**: Creates ingress resources

### Helm Values Configuration

Key vCluster Helm values for networking:

```typescript
const helmValues = {
  sync: {
    toHost: {
      ingresses: { enabled: false }, // Disable syncing ingresses FROM vcluster
    },
  },
  controlPlane: {
    proxy: {
      extraSANs: [
        'vcluster-dev-helm.dev-vcluster.svc',
        'dev-vcluster.cnoe.localtest.me', // Add ingress hostname
      ],
    },
  },
  exportKubeConfig: {
    server: 'https://vcluster-dev-helm.dev-vcluster.svc:443',
  },
};
```

### ArgoCD Application Configuration

Applications are deployed with specific sync waves:
- Wave 10: vCluster deployment
- Wave 15: vCluster ingress (after vCluster is ready)

## Troubleshooting

### Common Issues and Solutions

#### 1. vCluster CLI Connection Fails

**Symptom**: 
```
Failed handling connection" err="an error occurred forwarding 11934 -> 443: 
error forwarding port 443 to pod... connection refused
```

**Solution**: Use the ingress URL directly:
```bash
vcluster connect vcluster-dev-helm -n dev-vcluster \
  --server=https://dev-vcluster.cnoe.localtest.me:8443
```

#### 2. Ingress Not Created

**Symptom**: No ingress resource in vcluster namespace

**Check**:
```bash
kubectl get ingress -n dev-vcluster
kubectl get app vcluster-dev-ingress -n argocd -o jsonpath='{.status.conditions}'
```

**Solution**: Ensure IDPBuilder has processed the application and created git repositories

#### 3. SSL Certificate Errors

**Symptom**: Certificate validation failures

**Solution**: Use `--insecure-skip-tls-verify` for testing:
```bash
kubectl --server=https://dev-vcluster.cnoe.localtest.me:8443 \
  --insecure-skip-tls-verify get namespaces
```

#### 4. DNS Resolution Issues

**Symptom**: Cannot resolve `*.cnoe.localtest.me`

**Solution**: The `localtest.me` domain should resolve to 127.0.0.1. Verify:
```bash
nslookup dev-vcluster.cnoe.localtest.me
```

### Manual Port-Forward Workaround

If ingress is not available, you can manually port-forward:

```bash
# Direct port-forward to vCluster StatefulSet
kubectl port-forward -n dev-vcluster statefulset/vcluster-dev-helm 18443:8443 &

# Get vCluster kubeconfig
vcluster connect vcluster-dev-helm -n dev-vcluster --print > /tmp/vcluster.kubeconfig

# Use kubectl with the kubeconfig
KUBECONFIG=/tmp/vcluster.kubeconfig kubectl \
  --server=https://localhost:18443 \
  --insecure-skip-tls-verify get namespaces
```

## Security Considerations

1. **TLS Encryption**: All traffic is encrypted end-to-end
2. **Certificate Management**: vCluster manages its own certificates
3. **Network Policies**: Can be applied to restrict vCluster access
4. **RBAC**: vCluster provides isolated RBAC within each virtual cluster

## Performance Implications

1. **SSL Passthrough**: Minimal latency as no decryption/re-encryption
2. **Single Ingress Controller**: Shared across all vClusters
3. **Connection Pooling**: NGINX maintains persistent connections

## Future Enhancements

1. **Certificate Manager Integration**: Automated certificate management
2. **Network Policies**: Implement zero-trust networking
3. **Multi-cluster Support**: Extend to support remote clusters
4. **Observability**: Add metrics and tracing for vCluster connections

## References

- [vCluster Documentation](https://www.vcluster.com/docs)
- [NGINX Ingress SSL Passthrough](https://kubernetes.github.io/ingress-nginx/user-guide/tls/#ssl-passthrough)
- [Kind Ingress Guide](https://kind.sigs.k8s.io/docs/user/ingress/)
- [Docker Desktop WSL2 Backend](https://docs.docker.com/desktop/windows/wsl/)
- [IDPBuilder Documentation](https://github.com/cnoe-io/idpbuilder)