# Trusting Self-Signed Certificates for Kind Kubernetes with WSL2

This guide explains how to trust the self-signed certificate used by your Kind Kubernetes cluster so that you can access services without browser warnings.

## Overview

When running a Kind Kubernetes cluster with services exposed via ingress, the cluster uses a self-signed certificate for HTTPS. By default, browsers will show security warnings when accessing these services. This guide shows how to trust the certificate globally in Windows and WSL2.

## Certificate Details

- **Issuer**: cnoe.io
- **Domains**: cnoe.localtest.me, *.cnoe.localtest.me
- **Location in Kubernetes**: Secret `idpbuilder-cert` in namespace `ingress-nginx`

## Installation Steps

### 1. Export Certificate from Kubernetes

The certificate has already been exported to:
- **Windows path**: `C:\temp\certificates\cnoe-localtest-me.crt`
- **WSL2 path**: `/mnt/c/temp/certificates/cnoe-localtest-me.crt`

To export it again if needed:
```bash
# Extract certificate from Kubernetes
kubectl get secret idpbuilder-cert -n ingress-nginx -o jsonpath='{.data.tls\.crt}' | base64 -d > /tmp/idpbuilder.crt

# Copy to Windows filesystem
mkdir -p /mnt/c/temp/certificates
cp /tmp/idpbuilder.crt /mnt/c/temp/certificates/cnoe-localtest-me.crt
```

### 2. Install Certificate in Windows (for Browser Trust)

This will make Chrome and Edge trust the certificate.

1. **Open PowerShell as Administrator**
   - Right-click on PowerShell
   - Select "Run as administrator"

2. **Navigate to certificate directory**
   ```powershell
   cd C:\temp\certificates
   ```

3. **Run the installation script**
   ```powershell
   .\install-cert.ps1
   ```

4. **Restart your browsers**
   - Close all Chrome and Edge windows
   - Reopen the browser

### 3. Install Certificate in WSL2 (Optional)

This makes command-line tools in WSL2 trust the certificate.

```bash
# Run the installation script with sudo
sudo bash /home/vpittamp/stacks/scripts/install-cert-wsl.sh
```

## Verification

After installation, you should be able to access these services without certificate warnings:

- ArgoCD: https://argocd.cnoe.localtest.me
- Gitea: https://gitea.cnoe.localtest.me
- Backstage: https://backstage.cnoe.localtest.me
- Headlamp: https://headlamp.cnoe.localtest.me
- Keycloak: https://keycloak.cnoe.localtest.me
- Kargo: https://kargo.cnoe.localtest.me
- Chat: https://chat.cnoe.localtest.me

## Uninstalling the Certificate

If you need to remove the certificate:

### From Windows
```powershell
# Run as Administrator
cd C:\temp\certificates
.\uninstall-cert.ps1
```

### From WSL2
```bash
sudo rm /usr/local/share/ca-certificates/cnoe-localtest-me.crt
sudo update-ca-certificates
```

## Troubleshooting

### Browser still shows warnings
1. Ensure all browser windows are closed before reopening
2. Clear browser cache (Ctrl+Shift+Delete)
3. Check that the certificate was installed in "Trusted Root Certification Authorities"
4. Some browsers may require a system restart

### Certificate installation fails
1. Ensure you're running PowerShell as Administrator
2. Check that the certificate file exists at `C:\temp\certificates\cnoe-localtest-me.crt`
3. Try the manual installation method:
   - Double-click the `.crt` file
   - Click "Install Certificate"
   - Choose "Local Machine"
   - Select "Place all certificates in the following store"
   - Browse and select "Trusted Root Certification Authorities"
   - Complete the wizard

### WSL2 installation issues
1. Ensure you have sudo privileges
2. Check that `/usr/local/share/ca-certificates/` directory exists
3. Verify the certificate was added: `ls /etc/ssl/certs/ | grep cnoe`

## When to Re-install

You'll need to repeat this process if:
- You recreate your Kind cluster (it generates a new certificate)
- The certificate expires (check expiry with `openssl x509 -in /tmp/idpbuilder.crt -text -noout | grep "Not After"`)
- You reinstall Windows or WSL2

## Security Note

This certificate is self-signed and should only be used for local development. Never trust self-signed certificates from unknown sources or use them in production environments.