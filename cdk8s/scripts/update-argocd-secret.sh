#!/bin/bash
set -e

echo "This script will help you update the ArgoCD secret in Azure Key Vault"
echo ""

# Get ArgoCD admin password
ARGOCD_PASSWORD=$(kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath='{.data.password}' | base64 -d)
echo "ArgoCD admin password retrieved"

# Login using the ingress URL
echo "Logging into ArgoCD CLI via ingress..."
argocd login argocd.cnoe.localtest.me:8443 --username admin --password "$ARGOCD_PASSWORD" --insecure --grpc-web

echo "Generating API token..."
TOKEN=$(argocd account generate-token --account admin)

# Create the JSON structure
SECRET_JSON=$(cat <<EOF
{
  "ARGOCD_TOKEN": "$TOKEN",
  "ARGOCD_API_URL": "https://argocd-server.argocd.svc.cluster.local",
  "ARGOCD_VERIFY_SSL": "false"
}
EOF
)

echo ""
echo "Generated secret configuration:"
echo "$SECRET_JSON"
echo ""
echo "Please update your Azure Key Vault secret 'ai-platform-engineering-argocd' with the above JSON"
echo ""
echo "Using Azure CLI:"
echo "az keyvault secret set --vault-name YOUR_KEYVAULT_NAME --name ai-platform-engineering-argocd --value '$SECRET_JSON'"