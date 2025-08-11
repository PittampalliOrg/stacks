# VCluster Connectivity with WSL2 and Docker Desktop

## Table of Contents
- [Overview](#overview)
- [The Challenge](#the-challenge)
- [Networking Architecture](#networking-architecture)
- [Our Solution](#our-solution)
- [Scripts Documentation](#scripts-documentation)
- [Usage Guide](#usage-guide)
- [Troubleshooting](#troubleshooting)
- [Technical Deep Dive](#technical-deep-dive)

## Overview

This document explains how we solved vcluster connectivity challenges in a WSL2/Docker Desktop environment, documenting the networking quirks discovered and the scripts developed to provide reliable vcluster access.

## The Challenge

When running Kubernetes clusters with vclusters in Docker Desktop on WSL2, we encountered several networking challenges:

1. **TLS Certificate Mismatch**: Ingress controllers generate certificates for `*.cnoe.localtest.me` but connections via `localhost` fail certificate validation
2. **Port Conflicts**: Docker Desktop and WSL2 use various ports that may conflict with default vcluster ports
3. **Connection Methods**: The `vcluster connect` command can hang when establishing connections
4. **Multiple Networking Layers**: WSL2 → Windows → Docker Desktop → Kind → VCluster creates complexity

## Networking Architecture

### Layer Stack
```
┌─────────────────────────────────────┐
│         Windows Host                 │
│  └── WSL2 Distribution               │
│      └── Docker Desktop              │
│          └── Kind Cluster            │
│              ├── Host Cluster        │
│              ├── Dev VCluster        │
│              └── Staging VCluster    │
└─────────────────────────────────────┘
```

### Network Flow
```mermaid
graph LR
    User[User in WSL2] -->|kubectl| LH[localhost:8443/9444]
    LH -->|port-forward| KS[Kind Service]
    KS -->|internal| VC[VCluster Pod]
    VC -->|syncs| HC[Host Cluster Resources]
```

### Key Discoveries

1. **Docker Desktop Port Mapping**
   - Docker Desktop maps host ports to container ports
   - Default Kind setup uses port 8443 for API server
   - Multiple vclusters need unique ports to avoid conflicts

2. **TLS Certificate Issues**
   - Ingress-nginx generates certificates for configured hostnames
   - When accessing via `localhost`, certificate validation fails
   - Solution: Use `insecure-skip-tls-verify` for localhost connections

3. **VCluster Connect Behavior**
   - `vcluster connect` tries to establish interactive port-forwarding
   - In scripts, this causes hanging as it waits for user input
   - Solution: Use `--print` flag to only output kubeconfig

4. **Port-Forward vs Direct Connection**
   - Direct service connections (`svc.cluster.local`) don't work from WSL2
   - `kubectl port-forward` provides reliable connectivity
   - Must use unique ports for each vcluster

## Our Solution

We developed two scripts that handle these networking challenges:

### 1. merge-vcluster-kubeconfigs.sh
Configures kubectl contexts for vcluster access with proper handling of WSL2/Docker networking.

### 2. ensure-vclusters-registered.sh
Validates vcluster deployment and registration with comprehensive health checks.

## Scripts Documentation

### merge-vcluster-kubeconfigs.sh

**Purpose**: Creates and merges kubeconfig entries for all vclusters with WSL2/Docker-compatible settings.

**Key Features**:
- Detects and validates running vclusters
- Creates contexts with `insecure-skip-tls-verify` for localhost connections
- Supports both port-forwarding (default) and direct connection modes
- Provides clear instructions for establishing connections

**Configuration Options**:
```bash
# Use port-forwarding mode (recommended for WSL2/Docker)
USE_PORT_FORWARD=true bash scripts/merge-vcluster-kubeconfigs.sh

# Change starting port (default: 8443)
PORT_START=9000 bash scripts/merge-vcluster-kubeconfigs.sh

# Use direct connection (requires cluster network access)
USE_PORT_FORWARD=false bash scripts/merge-vcluster-kubeconfigs.sh
```

**How It Works**:
1. Checks each vcluster namespace for running pods
2. Extracts connection details from vcluster secrets
3. Uses `vcluster connect --print` to generate kubeconfig without hanging
4. Merges configurations into ~/.kube/config
5. Adds `insecure-skip-tls-verify` to handle certificate mismatches

### ensure-vclusters-registered.sh

**Purpose**: Comprehensive health check for vcluster deployment and ArgoCD registration.

**Key Features**:
- Validates vcluster pods are running
- Checks required secrets exist with proper keys
- Verifies ArgoCD cluster registration
- Tests actual connectivity
- Provides actionable recommendations for issues

**Configuration Options**:
```bash
# Run with verbose output
VERBOSE=true bash scripts/ensure-vclusters-registered.sh

# Check specific environments (modify script)
VCLUSTER_ENVS=("dev" "staging" "production")
```

**Health Checks Performed**:
1. **Deployment Check**: Verifies namespace, pod existence, and running status
2. **Secret Check**: Validates vcluster secrets contain required certificates
3. **ArgoCD Registration**: Checks for cluster secrets in ArgoCD namespace
4. **Application Targeting**: Lists applications using each vcluster
5. **Connectivity Test**: Attempts to list vclusters via CLI

## Usage Guide

### Initial Setup

1. **Run the registration check**:
```bash
bash scripts/ensure-vclusters-registered.sh
```

Expected output:
```
=== VCluster Registration Check ===

Checking dev vcluster:
  ✓ VCluster deployed and running
  ✓ VCluster secret exists with required keys
  ✓ Registered in ArgoCD (secret: cluster-dev-vcluster)
  ✓ Applications targeting cluster: backstage-dev nextjs-dev
  ✓ VCluster CLI can see the cluster
  Overall: ✓ All critical checks passed
```

2. **Configure kubeconfig contexts**:
```bash
bash scripts/merge-vcluster-kubeconfigs.sh
```

Expected output:
```
=== VCluster Connection Setup ===

Processing dev vcluster...
  Setting up port-forwarded connection on localhost:8443...
  ✓ Created context: dev-vcluster (use with port-forward)

Processing staging vcluster...
  Setting up port-forwarded connection on localhost:8444...
  ✓ Created context: staging-vcluster (use with port-forward)
```

### Daily Usage

1. **Start port-forwarding** (in separate terminals or background):
```bash
# Terminal 1 - Dev VCluster
kubectl port-forward -n dev-vcluster svc/vcluster-dev-helm 8443:443

# Terminal 2 - Staging VCluster  
kubectl port-forward -n staging-vcluster svc/vcluster-staging-helm 9444:443
```

Note: We use different ports (8443 for dev, 9444 for staging) to avoid conflicts.

2. **Use the contexts**:
```bash
# Switch to dev vcluster
kubectl config use-context dev-vcluster
kubectl get pods -A

# Switch to staging vcluster
kubectl config use-context staging-vcluster
kubectl get pods -A

# Or use context inline
kubectl --context dev-vcluster get ns
kubectl --context staging-vcluster get pods -n backstage
```

### Automation

Create an alias or function in your shell profile:
```bash
# Add to ~/.bashrc or ~/.zshrc
vcluster-connect() {
  local env=${1:-dev}
  local port=${2:-8443}
  
  echo "Connecting to ${env} vcluster on port ${port}..."
  kubectl port-forward -n ${env}-vcluster svc/vcluster-${env}-helm ${port}:443
}

# Usage
vcluster-connect dev 8443
vcluster-connect staging 9444
```

## Troubleshooting

### Common Issues and Solutions

#### 1. TLS Certificate Errors
**Symptom**:
```
x509: certificate is valid for cnoe.localtest.me, *.cnoe.localtest.me, not localhost
```

**Solution**:
The script automatically adds `insecure-skip-tls-verify`. If manually configuring:
```bash
kubectl config set-cluster dev-vcluster --insecure-skip-tls-verify=true
```

#### 2. Port Already in Use
**Symptom**:
```
bind: address already in use
```

**Solution**:
```bash
# Find what's using the port
lsof -i :8443

# Kill existing port-forwards
pkill -f "port-forward.*8443"

# Use a different port
kubectl port-forward -n dev-vcluster svc/vcluster-dev-helm 9443:443
kubectl config set-cluster dev-vcluster --server=https://localhost:9443
```

#### 3. Connection Timeout
**Symptom**:
```
Unable to connect to the server: net/http: TLS handshake timeout
```

**Causes & Solutions**:
- **Port-forward not running**: Ensure port-forward is active
- **Wrong port configured**: Check kubectl config matches port-forward
- **WSL2 networking issue**: Restart WSL2 with `wsl --shutdown` in Windows

#### 4. VCluster Connect Hangs
**Symptom**:
Script hangs when running `vcluster connect`

**Solution**:
Our script uses `--print` flag to avoid this. Never use `vcluster connect` without `--print` in scripts.

#### 5. "Server Not Found" Errors
**Symptom**:
```
the server could not find the requested resource
```

**Causes**:
- Port-forward connected to wrong service (like nginx instead of vcluster)
- Using wrong context or credentials

**Solution**:
Use direct `kubectl port-forward` to vcluster service:
```bash
kubectl port-forward -n dev-vcluster svc/vcluster-dev-helm 8443:443
```

### Diagnostic Commands

```bash
# Check vcluster pods
kubectl get pods -A | grep vcluster

# Verify services
kubectl get svc -n dev-vcluster
kubectl get svc -n staging-vcluster

# Check current context
kubectl config current-context

# View context details
kubectl config view --context=dev-vcluster --minify

# Test connectivity
kubectl --context dev-vcluster cluster-info

# Check port-forward processes
ps aux | grep port-forward

# View vcluster list
vcluster list
```

## Technical Deep Dive

### Why Standard VCluster Connect Doesn't Work

The standard `vcluster connect` command is designed for interactive use:
1. It establishes a port-forward
2. Modifies kubeconfig
3. **Keeps running** to maintain the port-forward
4. In scripts, this causes hanging

Our solution uses `--print` to only output kubeconfig without starting the interactive session.

### Certificate Validation Challenge

1. **The Problem Chain**:
   - VCluster generates certificates for its service DNS name
   - Ingress controllers add their own certificates for external hostnames
   - When using localhost port-forward, neither certificate matches
   - kubectl refuses connection due to certificate mismatch

2. **Why Not Fix the Certificates?**
   - Would require regenerating certificates for each environment
   - Would break when switching between localhost and hostname access
   - Would need different certificates for different access methods

3. **Our Approach**:
   - Accept that localhost access needs `insecure-skip-tls-verify`
   - This is safe because:
     - Connection is local (localhost only)
     - Traffic doesn't leave the machine
     - We still authenticate with valid credentials

### WSL2 Networking Specifics

1. **Network Interfaces**:
   ```
   WSL2 VM ← Virtual Switch → Windows Host ← Docker Desktop
   ```

2. **Port Forwarding Path**:
   - kubectl in WSL2 connects to localhost:8443
   - WSL2 forwards to Windows localhost:8443
   - Windows forwards to Docker Desktop
   - Docker Desktop forwards to Kind container
   - Kind container forwards to vcluster service

3. **Why This Matters**:
   - Each layer can introduce latency
   - Port conflicts can occur at any layer
   - Network resets may require restarting port-forwards

### Design Decisions

1. **Use kubectl port-forward Instead of vcluster connect**
   - More predictable behavior
   - Doesn't modify kubeconfig unexpectedly
   - Easier to manage in scripts
   - Can be run in background with `&`

2. **Separate Ports for Each Environment**
   - Avoids port conflicts
   - Allows simultaneous connections
   - Makes it clear which environment you're accessing

3. **Insecure TLS for Localhost**
   - Pragmatic solution for development
   - Security not compromised (local only)
   - Avoids complex certificate management

4. **Health Check Script**
   - Proactive problem detection
   - Clear diagnostic output
   - Actionable recommendations
   - Helps understand the full stack

## Best Practices

1. **Always Run Health Check First**
   - Ensures vclusters are properly deployed
   - Catches issues before attempting connection

2. **Use Unique Ports**
   - Assign dedicated ports to each environment
   - Document port assignments
   - Avoid conflicts with other services

3. **Automate Port-Forwarding**
   - Use shell functions or scripts
   - Consider tmux/screen for persistent sessions
   - Monitor port-forward health

4. **Regular Validation**
   - Run health checks after cluster recreation
   - Verify contexts after kubeconfig updates
   - Test actual connectivity, not just configuration

## Related Documentation

- [VCluster Architecture](./vcluster-architecture.md)
- [GitOps Architecture Overview](./gitops-architecture-overview.md)
- [Troubleshooting Guide](./troubleshooting-guide.md)
- [Development Workflow](./development-workflow.md)