#!/bin/bash

# Import GPG key if both parts are available
if [ -n "$GPG_SECRET_KEY_PART1" ] && [ -n "$GPG_SECRET_KEY_PART2" ]; then
    echo "Importing GPG key..."
    echo "$GPG_SECRET_KEY_PART1$GPG_SECRET_KEY_PART2" | tr -d "'" | base64 -d | gunzip | gpg --batch --yes --no-tty --import
    if [ $? -eq 0 ]; then
        echo "GPG key imported successfully"
        
        # Automatically configure Git to use the imported key for signing
        echo "Configuring Git to use the imported GPG key..."
        GPG_KEY_ID=$(gpg --list-secret-keys --keyid-format LONG | grep -E "^sec" | head -1 | awk '{print $2}' | cut -d'/' -f2)
        
        if [ -n "$GPG_KEY_ID" ]; then
            git config --global user.signingkey "$GPG_KEY_ID"
            echo "Git configured to use GPG key: $GPG_KEY_ID"
        else
            echo "Warning: Could not detect GPG key ID for Git configuration"
        fi
    else
        echo "Failed to import GPG key"
    fi
else
    echo "GPG key parts not found, skipping GPG import"
fi

# Check if idpbuilder cluster exists and nginx proxy is not running
if kubectl cluster-info &>/dev/null 2>&1; then
    # Check if proxy container is running
    if ! docker ps --filter "name=idpbuilder-nginx-proxy" --format '{{.Names}}' | grep -q "idpbuilder-nginx-proxy"; then
        echo "🔄 Detected idpbuilder cluster but nginx proxy is not running. Starting proxy..."
        /home/vscode/workspace/stacks/.devcontainer/setup-nginx-proxy.sh
    else
        echo "✅ Nginx proxy is already running"
    fi
fi