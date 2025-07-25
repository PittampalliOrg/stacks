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

# Configure MCP servers for claude-code
echo "Configuring MCP servers..."
claude mcp add fetch -s user -- npx -y @kazuph/mcp-fetch
claude mcp add --transport sse context7 https://mcp.context7.com/sse

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

# Install Azure Workload Identity CLI (azwi)
echo "Installing azwi..."
if curl -sLO 'https://github.com/Azure/azure-workload-identity/releases/latest/download/azwi-v1.3.0-linux-amd64.tar.gz'; then
    if tar -xzf azwi-v1.3.0-linux-amd64.tar.gz 2>/dev/null; then
        chmod +x azwi
        mv azwi ~/.local/bin/azwi
        rm azwi-v1.3.0-linux-amd64.tar.gz
        echo "azwi installed successfully"
    else
        echo "Warning: Failed to extract azwi tar.gz, trying direct binary download..."
        curl -sL 'https://github.com/Azure/azure-workload-identity/releases/latest/download/azwi-v1.3.0-linux-amd64' -o ~/.local/bin/azwi || {
            echo "Warning: Could not install azwi, skipping..."
        }
        chmod +x ~/.local/bin/azwi 2>/dev/null || true
        rm -f azwi-v1.3.0-linux-amd64.tar.gz
    fi
else
    echo "Warning: Could not download azwi, skipping..."
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

# Add .local/bin to PATH in .bashrc if not already present
if ! grep -q 'export PATH="$HOME/.local/bin:$PATH"' ~/.bashrc; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
fi

echo "All tools installation completed!"
echo "Installed tools:"
echo "  - idpbuilder"
echo "  - dagger (with bash completion)"
echo "  - claude-code (with MCP servers: fetch, context7)"
echo "  - vcluster" 
echo "  - argo"
echo "  - azwi (if available)"
echo "  - devspace"
echo "  - cdk8s-cli"
echo "  - jq"
echo "  - yq"
echo "  - kind"