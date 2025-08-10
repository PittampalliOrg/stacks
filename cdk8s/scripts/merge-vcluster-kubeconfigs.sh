#!/usr/bin/env bash

set -euo pipefail

# Merge kubeconfigs for all vclusters
# Works with the new vcluster architecture using genericSync
# Reads vcluster secrets directly from their namespaces
# Requires: kubectl, jq

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required (brew install jq | apt-get install jq)" >&2
  exit 1
fi

# Optional: override the host port in kubeconfigs (useful for kind mapping 0.0.0.0:8443->443)
# Set HOST_PORT_OVERRIDE=8443 to use that port instead of the one from the secret
HOST_PORT_OVERRIDE="${HOST_PORT_OVERRIDE:-}"

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

  # Set the cluster name and server URL
  CLUSTER_NAME="${ENV}-vcluster"
  SERVER="https://${ENV}-vcluster.cnoe.localtest.me:443"
  
  # Optionally override the host port (e.g., 8443) while preserving hostname for TLS SNI
  if [[ -n "${HOST_PORT_OVERRIDE}" ]]; then
    # Replace or append port in URL
    # from https://host[:port] -> https://host:HOST_PORT_OVERRIDE
    SERVER_HOST=$(echo "${SERVER}" | sed -E 's#^https://([^/:]+).*$#\1#')
    SERVER="https://${SERVER_HOST}:${HOST_PORT_OVERRIDE}"
  fi
  
  TMPDIR=$(mktemp -d)
  trap 'rm -rf "${TMPDIR}"' EXIT

  echo "${CA_DATA}"   | base64 -d > "${TMPDIR}/ca.crt"
  echo "${CERT_DATA}" | base64 -d > "${TMPDIR}/client.crt"
  echo "${KEY_DATA}"  | base64 -d > "${TMPDIR}/client.key"

  # Merge into default kubeconfig with embedded certs
  kubectl config set-cluster "${CLUSTER_NAME}" \
    --server="${SERVER}" \
    --certificate-authority="${TMPDIR}/ca.crt" \
    --embed-certs=true 1>/dev/null

  kubectl config set-credentials "${CLUSTER_NAME}" \
    --client-certificate="${TMPDIR}/client.crt" \
    --client-key="${TMPDIR}/client.key" \
    --embed-certs=true 1>/dev/null

  kubectl config set-context "${CLUSTER_NAME}" --cluster="${CLUSTER_NAME}" --user="${CLUSTER_NAME}" 1>/dev/null

  echo "Merged context: ${CLUSTER_NAME}"
done

echo "Done. Switch with: kubectl config use-context <env>-vcluster"
