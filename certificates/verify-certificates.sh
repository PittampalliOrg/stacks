#!/bin/bash
# Verify that the saved certificates match the ones in the current cluster

echo "Verifying certificates..."
echo ""

# Get saved certificate fingerprint
SAVED_FINGERPRINT=$(openssl x509 -in /home/vpittamp/stacks/certificates/tls.crt -noout -fingerprint | cut -d= -f2)
echo "Saved certificate fingerprint:   $SAVED_FINGERPRINT"

# Get cluster certificate fingerprint
CLUSTER_FINGERPRINT=$(kubectl get secret -n ingress-nginx idpbuilder-cert -o jsonpath='{.data.tls\.crt}' 2>/dev/null | base64 -d | openssl x509 -noout -fingerprint | cut -d= -f2)

if [ -z "$CLUSTER_FINGERPRINT" ]; then
  echo "Error: Could not retrieve certificate from cluster. Is the cluster running?"
  exit 1
fi

echo "Cluster certificate fingerprint: $CLUSTER_FINGERPRINT"
echo ""

if [ "$SAVED_FINGERPRINT" = "$CLUSTER_FINGERPRINT" ]; then
  echo "✓ Certificates match!"
else
  echo "✗ Certificates do not match!"
  echo "This might mean the cluster was created without using the static certificate."
  exit 1
fi