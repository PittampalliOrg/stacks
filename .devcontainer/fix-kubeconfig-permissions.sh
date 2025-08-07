#!/bin/bash

# Fix .kube directory and config permissions
echo "🔧 Fixing kubeconfig permissions..."

# Create .kube directory if it doesn't exist
if [ ! -d "$HOME/.kube" ]; then
    mkdir -p "$HOME/.kube"
    echo "✅ Created .kube directory"
fi

# Fix ownership of .kube directory and all its contents
if [ -d "$HOME/.kube" ]; then
    # Get the current user and group
    CURRENT_USER=$(whoami)
    CURRENT_GROUP=$(id -gn)
    
    # Fix ownership
    sudo chown -R "$CURRENT_USER:$CURRENT_GROUP" "$HOME/.kube"
    
    # Ensure proper permissions
    chmod 755 "$HOME/.kube"
    
    # Fix config file permissions if it exists
    if [ -f "$HOME/.kube/config" ]; then
        chmod 600 "$HOME/.kube/config"
        echo "✅ Fixed kubeconfig permissions"
    else
        echo "⚠️  No kubeconfig file found at $HOME/.kube/config"
    fi
    
    # Remove any stale lock files
    if [ -f "$HOME/.kube/config.lock" ]; then
        sudo rm -f "$HOME/.kube/config.lock"
        echo "✅ Removed stale lock file"
    fi
else
    echo "❌ .kube directory not found"
fi