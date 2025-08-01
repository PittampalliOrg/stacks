#!/usr/bin/env bash

# For Kubectl AMD64 / x86_64
[ $(uname -m) = x86_64 ] && curl -sLO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
# For Kubectl ARM64
[ $(uname -m) = aarch64 ] && curl -sLO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/arm64/kubectl"
chmod +x ./kubectl
sudo mv ./kubectl /usr/local/bin/kubectl

# For Kind AMD64 / x86_64
[ $(uname -m) = x86_64 ] && curl -sLo ./kind https://kind.sigs.k8s.io/dl/v0.22.0/kind-linux-amd64
# For Kind ARM64
[ $(uname -m) = aarch64 ] && curl -sLo ./kind https://kind.sigs.k8s.io/dl/v0.22.0/kind-linux-arm64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind

# setup autocomplete for kubectl and alias k
sudo apt-get update -y && sudo apt-get install bash-completion -y
mkdir $HOME/.kube
echo "source <(kubectl completion bash)" >> $HOME/.bashrc
echo "alias k=kubectl" >> $HOME/.bashrc
echo "complete -F __start_kubectl k" >> $HOME/.bashrc

# Configure git if environment variables are set
if [ -n "$GIT_COMMITER_NAME" ]; then
    echo "Configuring git user.name to: $GIT_COMMITER_NAME"
    git config --global user.name "$GIT_COMMITER_NAME"
fi

if [ -n "$GIT_COMMITER_EMAIL" ]; then
    echo "Configuring git user.email to: $GIT_COMMITER_EMAIL"
    git config --global user.email "$GIT_COMMITER_EMAIL"
fi

# Add alias for idpbuilder with automatic nginx proxy setup
echo "alias idpbuilder-create='/home/vscode/workspace/stacks/.devcontainer/idpbuilder-with-proxy.sh'" >> $HOME/.bashrc

# 1. Configure GPG agent
# mkdir -p ~/.gnupg
# echo "pinentry-program /usr/bin/pinentry" > ~/.gnupg/gpg-agent.conf
# echo "allow-loopback-pinentry" >> ~/.gnupg/gpg-agent.conf

# # 2. Configure GPG client
# echo "use-agent" > ~/.gnupg/gpg.conf
# echo "pinentry-mode loopback" >> ~/.gnupg/gpg.conf

# # 3. Restart GPG agent and set environment
# gpgconf --kill gpg-agent
# export GPG_TTY=$(tty)
# echo 'export GPG_TTY=$(tty)' >> ~/.bashrc

# # 4. Configure Git for GPG signing
git config --global commit.gpgsign false
# git config --global tag.gpgsign true
# git config --global gpg.program gpg
