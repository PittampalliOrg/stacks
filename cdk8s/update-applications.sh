#!/bin/bash
set -e

echo "Updating ArgoCD applications with domain-based routing..."

# Update Backstage application
echo "Updating Backstage..."
kubectl apply -f dist/backstage.yaml

# Update AI Platform Engineering application  
echo "Updating AI Platform Engineering..."
kubectl apply -f dist/ai-platform-engineering.yaml

# Wait for ArgoCD to pick up changes
echo "Waiting for ArgoCD to sync changes..."
sleep 10

# Check application status
echo "Checking application status..."
kubectl get applications -n argocd | grep -E "(backstage|ai-platform-engineering)"

echo "Update complete!"