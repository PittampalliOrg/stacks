#!/bin/bash
# Script to install the self-signed certificate in WSL2

CERT_FILE="/tmp/idpbuilder.crt"
DEST_FILE="/usr/local/share/ca-certificates/cnoe-localtest-me.crt"

echo "Installing self-signed certificate in WSL2..."
echo ""

# Check if certificate file exists
if [ ! -f "$CERT_FILE" ]; then
    echo "Error: Certificate file not found at $CERT_FILE"
    echo "Please run the certificate export process first."
    exit 1
fi

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "This script needs to be run with sudo."
    echo "Usage: sudo bash $0"
    exit 1
fi

# Copy certificate to ca-certificates directory
echo "Copying certificate to $DEST_FILE..."
cp "$CERT_FILE" "$DEST_FILE"

# Update CA certificates
echo "Updating CA certificates..."
update-ca-certificates

echo ""
echo "Certificate installed successfully in WSL2!"
echo ""
echo "The certificate will now be trusted by:"
echo "- curl, wget, and other command-line tools"
echo "- Docker when pulling from registries with this certificate"
echo "- Any other applications that use the system CA bundle"
echo ""
echo "Note: This only affects WSL2. For browser trust, use the Windows PowerShell script."