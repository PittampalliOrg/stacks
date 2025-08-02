#!/bin/bash
set -e

echo "Generating ArgoCD API token..."
echo ""

# Get ArgoCD admin password
ARGOCD_PASSWORD=$(kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath='{.data.password}' | base64 -d)
echo "ArgoCD admin password retrieved"

# Generate token using kubectl exec with developer account
echo "Generating token for developer service account..."
TOKEN=$(kubectl exec -n argocd deployment/argocd-server -- bash -c "
  argocd login localhost:8080 --username admin --password '$ARGOCD_PASSWORD' --insecure > /dev/null 2>&1
  argocd account generate-token --account developer
")

if [ -z "$TOKEN" ]; then
  echo "Failed to generate token"
  exit 1
fi

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
echo "az keyvault secret set --vault-name keyvault-thcmfmoo5oeow --name ai-platform-engineering-argocd --value '$SECRET_JSON'"