#!/bin/bash
set -e

INSTALL_YAML="manifests/install.yaml"
CHART_VERSION="1.5.1"
AZURE_TENANT_ID="${AZURE_TENANT_ID:-0c4da9c5-40ea-4e7d-9c7a-e7308d4f8e38}"

echo "# AZURE WORKLOAD IDENTITY WEBHOOK INSTALL RESOURCES" >${INSTALL_YAML}
echo "# Generated with 'ref-implementation/azure-workload-identity/manifests/generate-manifests.sh'" >>${INSTALL_YAML}
echo "" >>${INSTALL_YAML}

helm repo add azure-workload-identity https://azure.github.io/azure-workload-identity/charts --force-update
helm repo update
helm template workload-identity-webhook azure-workload-identity/workload-identity-webhook \
  --namespace azure-workload-identity-system \
  --version ${CHART_VERSION} \
  --set azureTenantID="${AZURE_TENANT_ID}" \
  >>${INSTALL_YAML}

echo "✅ Generated manifests/install.yaml with Azure Tenant ID: ${AZURE_TENANT_ID}"