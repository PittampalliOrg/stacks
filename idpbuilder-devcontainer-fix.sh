#!/bin/bash
set -e

echo "🔧 Applying devcontainer fix for idpbuilder..."

# Check if running in devcontainer
if [ ! -S /var/run/docker.sock ]; then
    echo "❌ Docker socket not found. Make sure Docker is properly configured in devcontainer."
    exit 1
fi

# Clean up any existing clusters
echo "🧹 Cleaning up existing clusters..."
kind delete cluster --name localdev 2>/dev/null || true

# Check Docker daemon
echo "🐳 Checking Docker daemon..."
docker version > /dev/null 2>&1 || {
    echo "❌ Docker daemon not responding"
    exit 1
}

# Create a simplified kind config without service account mounts
cat > /tmp/kind-config-devcontainer.yaml <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
networking:
  disableDefaultCNI: false
  podSubnet: "10.244.0.0/16"
  serviceSubnet: "10.96.0.0/12"
nodes:
- role: control-plane
  image: kindest/node:v1.31.4
  extraPortMappings:
  - containerPort: 443
    hostPort: 8443
    protocol: TCP
  - containerPort: 32222
    hostPort: 32222
    protocol: TCP
EOF

# Try to create cluster with idpbuilder
echo "🚀 Creating cluster with idpbuilder..."
if ! idpbuilder create --kind-config /tmp/kind-config-devcontainer.yaml; then
    echo "❌ idpbuilder failed. Trying alternative approach..."
    
    # Create kind cluster directly
    echo "📦 Creating kind cluster directly..."
    if kind create cluster --name localdev --config /tmp/kind-config-devcontainer.yaml --wait 5m; then
        echo "✅ Kind cluster created successfully"
        
        # Copy service account keys if they exist
        if [ -f /home/vscode/workspace/stacks/ref-implementation/keys/sa.key ]; then
            echo "📋 Copying service account keys..."
            docker exec localdev-control-plane mkdir -p /etc/kubernetes/pki/custom-keys
            docker cp /home/vscode/workspace/stacks/ref-implementation/keys/sa.key localdev-control-plane:/etc/kubernetes/pki/custom-keys/
            docker cp /home/vscode/workspace/stacks/ref-implementation/keys/sa.pub localdev-control-plane:/etc/kubernetes/pki/custom-keys/
            echo "✅ Service account keys copied"
        fi
        
        # Continue with idpbuilder packages
        echo "📦 Installing idpbuilder packages..."
        idpbuilder install --use-existing-cluster
    else
        echo "❌ Failed to create kind cluster"
        echo "🔍 Checking for common issues..."
        
        # Check for port conflicts
        netstat -tlnp 2>/dev/null | grep -E ':(8443|32222|6443)' && echo "⚠️  Port conflict detected"
        
        # Check Docker resources
        docker system df
        
        echo "💡 Try running: docker system prune -a"
        exit 1
    fi
fi

echo "✅ Setup complete!"
kubectl get nodes