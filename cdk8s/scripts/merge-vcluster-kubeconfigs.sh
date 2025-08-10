#!/usr/bin/env bash

set -euo pipefail

# Merge kubeconfigs for all vclusters with localhost connections for Docker Desktop/WSL2
# Uses dedicated ports per environment to avoid conflicts
# Works with the new vcluster architecture using genericSync
# Reads vcluster secrets directly from their namespaces
# Requires: kubectl, jq

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required (brew install jq | apt-get install jq)" >&2
  exit 1
fi

# Define vcluster environments with their dedicated localhost ports
# These ports are used for direct vcluster connections bypassing ingress
declare -A VCLUSTER_PORTS=(
  ["dev"]=8443
  ["staging"]=8444
)

# Define vcluster environments
VCLUSTER_ENVS=("dev" "staging")

# Process each vcluster environment
for ENV in "${VCLUSTER_ENVS[@]}"; do
  NAMESPACE="${ENV}-vcluster"
  SECRET_NAME="vc-${ENV}-vcluster-helm"
  
  # Check if the namespace exists
  if ! kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
    echo "Namespace ${NAMESPACE} not found, skipping..."
    continue
  fi
  
  # Check if the secret exists
  if ! kubectl get secret "${SECRET_NAME}" -n "${NAMESPACE}" >/dev/null 2>&1; then
    echo "Secret ${SECRET_NAME} not found in namespace ${NAMESPACE}, skipping..."
    continue
  fi
  
  echo "Processing ${ENV} vcluster..."
  
  # Get certificate data from the secret
  CA_DATA=$(kubectl get secret "${SECRET_NAME}" -n "${NAMESPACE}" -o jsonpath='{.data.certificate-authority}')
  CERT_DATA=$(kubectl get secret "${SECRET_NAME}" -n "${NAMESPACE}" -o jsonpath='{.data.client-certificate}')
  KEY_DATA=$(kubectl get secret "${SECRET_NAME}" -n "${NAMESPACE}" -o jsonpath='{.data.client-key}')

  # Set the cluster name and server URL using localhost with dedicated port
  # This bypasses Docker Desktop/WSL2 networking issues
  CLUSTER_NAME="${ENV}-vcluster"
  PORT="${VCLUSTER_PORTS[$ENV]}"
  SERVER="https://localhost:${PORT}"
  
  echo "  - Using localhost:${PORT} for ${ENV} vcluster connection"
  
  TMPDIR=$(mktemp -d)
  trap 'rm -rf "${TMPDIR}"' EXIT

  echo "${CA_DATA}"   | base64 -d > "${TMPDIR}/ca.crt"
  echo "${CERT_DATA}" | base64 -d > "${TMPDIR}/client.crt"
  echo "${KEY_DATA}"  | base64 -d > "${TMPDIR}/client.key"

  # Merge into default kubeconfig with embedded certs
  # Note: Using insecure-skip-tls-verify for localhost connections due to certificate mismatch
  kubectl config set-cluster "${CLUSTER_NAME}" \
    --server="${SERVER}" \
    --insecure-skip-tls-verify=true 1>/dev/null

  kubectl config set-credentials "${CLUSTER_NAME}" \
    --client-certificate="${TMPDIR}/client.crt" \
    --client-key="${TMPDIR}/client.key" \
    --embed-certs=true 1>/dev/null

  kubectl config set-context "${CLUSTER_NAME}" --cluster="${CLUSTER_NAME}" --user="${CLUSTER_NAME}" 1>/dev/null

  echo "  - Merged context: ${CLUSTER_NAME}"
done

echo ""
echo "✅ Done! Kubeconfigs merged for localhost connections."
echo ""
echo "To connect to a vcluster:"
echo "  1. First, start port-forwarding (in a separate terminal):"
echo "     vcluster connect dev-vcluster-helm --namespace dev-vcluster --server https://localhost:8443"
echo "     OR"
echo "     vcluster connect staging-vcluster-helm --namespace staging-vcluster --server https://localhost:8444"
echo ""
echo "  2. Then switch context:"
echo "     kubectl config use-context dev-vcluster"
echo "     OR"
echo "     kubectl config use-context staging-vcluster"
echo ""
echo "Note: The vcluster connect command handles port-forwarding automatically."
