#!/bin/bash

echo "🚀 Starting idpbuilder with automatic nginx proxy setup"
echo "====================================================="
echo ""

# Pass all arguments to idpbuilder create
echo "📦 Running idpbuilder create..."
idpbuilder create "$@"

# Check if idpbuilder create was successful
if [ $? -ne 0 ]; then
    echo "❌ idpbuilder create failed. Exiting without setting up proxy."
    exit 1
fi

echo ""
echo "⏳ Waiting for cluster to be ready..."
# Wait a bit for the cluster to stabilize
sleep 5

# Wait for ingress-nginx to be ready
echo "🔄 Waiting for ingress-nginx controller to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/component=controller -n ingress-nginx --timeout=300s

# Now set up the nginx proxy
echo ""
echo "🔧 Setting up nginx proxy for browser access..."
/home/vscode/workspace/stacks/.devcontainer/setup-nginx-proxy.sh

echo ""
echo "✅ idpbuilder cluster is ready with nginx proxy!"
echo ""
echo "📌 Quick Access URLs:"
echo "  ArgoCD:    http://argocd.cnoe.localtest.me"
echo "  Gitea:     http://gitea.cnoe.localtest.me"
echo "  Backstage: http://backstage.cnoe.localtest.me"
echo "  Kargo:     http://kargo.cnoe.localtest.me"
echo ""
echo "💡 Tip: You can also use https:// for secure access on port 443"