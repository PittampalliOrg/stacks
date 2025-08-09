# Static Self-Signed Certificate for IDPBuilder

This directory contains the setup for using a static self-signed certificate across all IDPBuilder cluster recreations.

## Problem Solved

By default, IDPBuilder generates a new self-signed certificate every time you run `idpbuilder create`. This causes:
- Browser warnings requiring re-acceptance of the certificate
- Docker registry trust issues requiring reconfiguration
- Windows Certificate Manager needing updates
- ArgoCD sync failures due to certificate mismatch

## Solution

We extract the certificate from a working cluster and reuse it for all future cluster creations using IDPBuilder's `-c` flag for both nginx and ArgoCD.

## Files

- `ca.crt` - The CA certificate
- `tls.crt` - The TLS certificate
- `tls.key` - The private key (keep secure!)
- `generate-nginx-override.sh` - Script to generate nginx override YAML
- `generate-argocd-override.sh` - Script to generate ArgoCD override YAML with TLS certificates
- `nginx-override.yaml` - Generated nginx Secret override (created by script)
- `argocd-override.yaml` - Generated ArgoCD TLS ConfigMap override (created by script)
- `idpbuilder-static-cert.sh` - Wrapper script for idpbuilder
- `update-argocd-certs.sh` - Script to manually update ArgoCD certificates if needed

## Usage

### First Time Setup (Already Done)

The certificates have already been extracted from the current cluster:

```bash
# Extract certificates from existing cluster
kubectl get secret -n ingress-nginx idpbuilder-cert -o jsonpath='{.data.tls\.crt}' | base64 -d > tls.crt
kubectl get secret -n ingress-nginx idpbuilder-cert -o jsonpath='{.data.tls\.key}' | base64 -d > tls.key
cp /etc/docker/certs.d/gitea.cnoe.localtest.me:8443/ca.crt ca.crt
```

### Creating New Clusters

Use the wrapper script instead of calling `idpbuilder create` directly:

```bash
# From the stacks directory
./certificates/idpbuilder-static-cert.sh --kind-config ref-implementation/kind-config.yaml

# Or with custom packages
./certificates/idpbuilder-static-cert.sh \
  --kind-config ref-implementation/kind-config.yaml \
  -p ref-implementation/ \
  -p cdk8s/dist/
```

### Verification

After cluster creation, verify the certificate:

```bash
# Check fingerprint in cluster (should match saved certificate)
kubectl get secret -n ingress-nginx idpbuilder-cert -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -noout -fingerprint

# Expected fingerprint
# SHA1 Fingerprint=EB:A5:E3:B1:E0:98:3E:91:BE:FD:81:BD:71:47:80:0E:31:B9:69:4B
```

## How It Works

1. The wrapper script generates two override files:
   - `nginx-override.yaml` - Contains the static TLS certificate for nginx
   - `argocd-override.yaml` - Contains the TLS ConfigMap so ArgoCD trusts the certificate
2. It calls `idpbuilder create` with both overrides:
   - `-c nginx:nginx-override.yaml` - Ensures nginx uses your static certificate
   - `-c argocd:argocd-override.yaml` - Ensures ArgoCD trusts the same certificate
3. IDPBuilder uses these overrides during cluster creation
4. ArgoCD can immediately sync with public Gitea repositories without manual intervention

## Certificate Details

- **Domain**: `cnoe.localtest.me` and `*.cnoe.localtest.me`
- **Valid Until**: August 9, 2026
- **Fingerprint**: `EB:A5:E3:B1:E0:98:3E:91:BE:FD:81:BD:71:47:80:0E:31:B9:69:4B`

## Windows Certificate Manager

The certificate has been imported into Windows Certificate Manager. No action needed when recreating clusters.

## Docker Configuration

The CA certificate is stored at `/etc/docker/certs.d/gitea.cnoe.localtest.me:8443/ca.crt` in WSL. No reconfiguration needed when recreating clusters.