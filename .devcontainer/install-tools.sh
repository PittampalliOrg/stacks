#!/bin/bash
set -e

echo "Starting devcontainer tools installation..."

# Create .local/bin directory if it doesn't exist
mkdir -p $HOME/.local/bin
export PATH="$HOME/.local/bin:$PATH"

# Install idpbuilder
echo "Installing idpbuilder..."
curl -fsSL https://raw.githubusercontent.com/cnoe-io/idpbuilder/main/hack/install.sh | bash

# Install dagger
echo "Installing dagger..."
curl -fsSL https://dl.dagger.io/dagger/install.sh | BIN_DIR=$HOME/.local/bin sh

# Setup dagger bash completion
echo "Setting up dagger bash completion..."
mkdir -p /home/vscode/.local/share/bash-completion/completions
dagger completion bash > /home/vscode/.local/share/bash-completion/completions/dagger 2>/dev/null || echo "Warning: Could not setup dagger completion"

# Install claude-code
echo "Installing claude-code..."
npm install -g @anthropic-ai/claude-code

# Install uv
echo "Installing uv..."
curl -LsSf https://astral.sh/uv/install.sh | sh

# Configure MCP servers for claude-code
echo "Configuring MCP servers..."
claude mcp add-json server-fetch --scope user '{
  "command": "uvx",
  "args": [
    "mcp-server-fetch"
  ]
}'

claude mcp add --transport sse context7 https://mcp.context7.com/sse
claude mcp add -t http nx-mcp http://localhost:9445/mcp

claude mcp add github -- docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server
claude mcp add --transport http grep https://mcp.grep.app

# Install vcluster
echo "Installing vcluster..."
curl -L 'https://github.com/loft-sh/vcluster/releases/latest/download/vcluster-linux-amd64' -o ~/.local/bin/vcluster
chmod +x ~/.local/bin/vcluster

# Install argo workflows CLI
echo "Installing argo..."
curl -sLO 'https://github.com/argoproj/argo-workflows/releases/download/v3.6.7/argo-linux-amd64.gz'
gunzip argo-linux-amd64.gz
chmod +x argo-linux-amd64
mv argo-linux-amd64 ~/.local/bin/argo

# Install ArgoCD CLI
echo "Installing argocd CLI..."
curl -sSL -o ~/.local/bin/argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
chmod +x ~/.local/bin/argocd

# Install Azure Workload Identity CLI (azwi)
echo "Installing azwi..."

# Get the latest version
AZWI_VERSION=$(curl -s https://api.github.com/repos/Azure/azure-workload-identity/releases/latest | jq -r '.tag_name')

if [ -z "$AZWI_VERSION" ]; then
    echo "Warning: Could not determine latest azwi version, skipping..."
else
    # Detect OS and architecture
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    
    # Map architecture names
    case $ARCH in
        x86_64)
            ARCH="amd64"
            ;;
        aarch64)
            ARCH="arm64"
            ;;
    esac
    
    # Construct download URL
    AZWI_URL="https://github.com/Azure/azure-workload-identity/releases/download/${AZWI_VERSION}/azwi-${AZWI_VERSION}-${OS}-${ARCH}.tar.gz"
    
    echo "Downloading azwi ${AZWI_VERSION} for ${OS}-${ARCH}..."
    
    if curl -sLO "$AZWI_URL"; then
        if tar -xzf "azwi-${AZWI_VERSION}-${OS}-${ARCH}.tar.gz" 2>/dev/null; then
            chmod +x azwi
            mv azwi ~/.local/bin/azwi
            rm "azwi-${AZWI_VERSION}-${OS}-${ARCH}.tar.gz"
            echo "azwi ${AZWI_VERSION} installed successfully"
        else
            echo "Warning: Failed to extract azwi archive"
            rm -f "azwi-${AZWI_VERSION}-${OS}-${ARCH}.tar.gz"
        fi
    else
        echo "Warning: Could not download azwi from $AZWI_URL"
    fi
fi

# Install npm packages
echo "Installing npm packages (devspace, cdk8s-cli)..."
npm install -g devspace@latest cdk8s-cli

# Install additional tools via apt
echo "Installing system packages (jq, yq)..."
sudo apt-get update
sudo apt-get install -y jq

# Install yq
echo "Installing yq..."
sudo wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64
sudo chmod +x /usr/local/bin/yq

# Install kind
echo "Installing kind..."
curl -Lo ~/.local/bin/kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ~/.local/bin/kind

# Install ORAS
# echo "Installing ORAS..."
# VERSION="1.2.0"
# curl -LO "https://github.com/oras-project/oras/releases/download/v${VERSION}/oras_${VERSION}_linux_amd64.tar.gz"
# mkdir -p oras-install/
# tar -zxf oras_${VERSION}_*.tar.gz -C oras-install/
# sudo mv oras-install/oras /usr/local/bin/
# rm -rf oras_${VERSION}_*.tar.gz oras-install/

# Add .local/bin and backstage bin directories to PATH in .bashrc if not already present
if ! grep -q 'export PATH="$HOME/.local/bin:$PATH"' ~/.bashrc; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
fi

# Add backstage node_modules/.bin to PATH if the directory will exist
if ! grep -q '/home/vscode/backstage/node_modules/.bin' ~/.bashrc; then
    echo 'export PATH="$PATH:/home/vscode/backstage/node_modules/.bin"' >> ~/.bashrc
fi

echo "All tools installation completed!"
echo "Installed tools:"
echo "  - idpbuilder"
echo "  - dagger (with bash completion)"
echo "  - claude-code (with MCP servers: fetch, context7)"
echo "  - vcluster" 
echo "  - argo (Argo Workflows CLI)"
echo "  - argocd (ArgoCD CLI)"
echo "  - azwi (Azure Workload Identity CLI)"
echo "  - devspace"
echo "  - cdk8s-cli"
echo "  - jq"
echo "  - yq"
echo "  - kind"
echo "  - oras"