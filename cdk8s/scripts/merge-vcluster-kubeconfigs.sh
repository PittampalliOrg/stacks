#!/usr/bin/env bash

set -euo pipefail

# Script to set up vcluster connections for Docker Desktop/WSL2
# Uses vcluster CLI for proper connection management
# Supports both direct and port-forwarded connections

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
if ! command -v vcluster >/dev/null 2>&1; then
  echo -e "${RED}Error: vcluster CLI is required${NC}" >&2
  echo "Install with: curl -L -o vcluster 'https://github.com/loft-sh/vcluster/releases/latest/download/vcluster-linux-amd64' && chmod +x vcluster && sudo mv vcluster /usr/local/bin" >&2
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo -e "${RED}Error: kubectl is required${NC}" >&2
  exit 1
fi

# Configuration
VCLUSTER_ENVS=("dev" "staging")
USE_PORT_FORWARD=${USE_PORT_FORWARD:-true}
PORT_START=${PORT_START:-8443}

echo -e "${GREEN}=== VCluster Connection Setup ===${NC}"
echo ""

# Function to check if vcluster is ready
check_vcluster_ready() {
  local env=$1
  local namespace="${env}-vcluster"
  local name="vcluster-${env}-helm"
  
  # Check if namespace exists
  if ! kubectl get namespace "${namespace}" >/dev/null 2>&1; then
    echo -e "${YELLOW}Warning: Namespace ${namespace} not found${NC}"
    return 1
  fi
  
  # Check if vcluster pod is running
  if ! kubectl get pod "${name}-0" -n "${namespace}" >/dev/null 2>&1; then
    echo -e "${YELLOW}Warning: VCluster pod ${name}-0 not found in ${namespace}${NC}"
    return 1
  fi
  
  local pod_status=$(kubectl get pod "${name}-0" -n "${namespace}" -o jsonpath='{.status.phase}' 2>/dev/null)
  if [[ "${pod_status}" != "Running" ]]; then
    echo -e "${YELLOW}Warning: VCluster ${name} is not running (status: ${pod_status})${NC}"
    return 1
  fi
  
  return 0
}

# Function to connect to vcluster
connect_vcluster() {
  local env=$1
  local port=$2
  local namespace="${env}-vcluster"
  local name="vcluster-${env}-helm"
  local context="${env}-vcluster"
  
  echo -e "${GREEN}Processing ${env} vcluster...${NC}"
  
  # Check if vcluster is ready
  if ! check_vcluster_ready "${env}"; then
    echo -e "${YELLOW}Skipping ${env} vcluster (not ready)${NC}"
    return 1
  fi
  
  if [[ "${USE_PORT_FORWARD}" == "true" ]]; then
    # Use port-forwarding method (recommended for Docker Desktop/WSL2)
    echo "  Setting up port-forwarded connection on localhost:${port}..."
    
    # Create kubeconfig entry using vcluster CLI
    # The --print option outputs the kubeconfig without starting port-forwarding
    # We'll save it to a temp file and merge it
    local temp_kubeconfig=$(mktemp)
    trap "rm -f ${temp_kubeconfig}" EXIT
    
    # Note: We need to use insecure-skip-tls-verify when using localhost
    # because the certificate is valid for cnoe.localtest.me, not localhost
    if vcluster connect "${name}" \
      --namespace "${namespace}" \
      --server "https://localhost:${port}" \
      --kube-config-context-name "${context}" \
      --update-current=false \
      --insecure \
      --print > "${temp_kubeconfig}" 2>/dev/null; then
      
      # Merge the kubeconfig into the default config
      KUBECONFIG="${HOME}/.kube/config:${temp_kubeconfig}" kubectl config view --flatten > "${HOME}/.kube/config.new" 2>/dev/null
      mv "${HOME}/.kube/config.new" "${HOME}/.kube/config" 2>/dev/null
      
    else
      echo -e "${YELLOW}  Warning: Failed to create kubeconfig for ${env}${NC}"
      rm -f "${temp_kubeconfig}"
      return 1
    fi
    
    rm -f "${temp_kubeconfig}"
    
    echo -e "${GREEN}  ✓ Created context: ${context} (use with port-forward)${NC}"
    echo "    To connect, run in a separate terminal:"
    echo -e "${YELLOW}    vcluster connect ${name} --namespace ${namespace} --local-port ${port}${NC}"
    
  else
    # Direct connection method (requires cluster network access)
    echo "  Setting up direct cluster connection..."
    
    # Get the service endpoint
    local server="https://${name}.${namespace}.svc:443"
    
    local temp_kubeconfig=$(mktemp)
    trap "rm -f ${temp_kubeconfig}" EXIT
    
    if vcluster connect "${name}" \
      --namespace "${namespace}" \
      --server "${server}" \
      --kube-config-context-name "${context}" \
      --update-current=false \
      --print > "${temp_kubeconfig}" 2>/dev/null; then
      
      # Merge the kubeconfig into the default config
      KUBECONFIG="${HOME}/.kube/config:${temp_kubeconfig}" kubectl config view --flatten > "${HOME}/.kube/config.new" 2>/dev/null
      mv "${HOME}/.kube/config.new" "${HOME}/.kube/config" 2>/dev/null
      
    else
      echo -e "${YELLOW}  Warning: Failed to create kubeconfig for ${env}${NC}"
      rm -f "${temp_kubeconfig}"
      return 1
    fi
    
    rm -f "${temp_kubeconfig}"
    
    echo -e "${GREEN}  ✓ Created context: ${context} (direct connection)${NC}"
  fi
  
  return 0
}

# Function to test vcluster connection
test_connection() {
  local context=$1
  
  echo -n "  Testing connection... "
  
  if kubectl --context "${context}" get ns >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Success${NC}"
    return 0
  else
    echo -e "${YELLOW}✗ Failed (port-forwarding may be required)${NC}"
    return 1
  fi
}

# Main execution
SUCCESSFUL_CONTEXTS=()
FAILED_ENVS=()
CURRENT_PORT=${PORT_START}

for ENV in "${VCLUSTER_ENVS[@]}"; do
  if connect_vcluster "${ENV}" "${CURRENT_PORT}"; then
    CONTEXT="${ENV}-vcluster"
    
    # Test connection (will likely fail without port-forwarding)
    if [[ "${USE_PORT_FORWARD}" != "true" ]]; then
      test_connection "${CONTEXT}" || true
    fi
    
    SUCCESSFUL_CONTEXTS+=("${CONTEXT}")
    CURRENT_PORT=$((CURRENT_PORT + 1))
  else
    FAILED_ENVS+=("${ENV}")
  fi
  echo ""
done

# Summary
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""

if [[ ${#SUCCESSFUL_CONTEXTS[@]} -gt 0 ]]; then
  echo -e "${GREEN}Successfully configured contexts:${NC}"
  for ctx in "${SUCCESSFUL_CONTEXTS[@]}"; do
    echo "  • ${ctx}"
  done
  echo ""
fi

if [[ ${#FAILED_ENVS[@]} -gt 0 ]]; then
  echo -e "${YELLOW}Failed to configure:${NC}"
  for env in "${FAILED_ENVS[@]}"; do
    echo "  • ${env}"
  done
  echo ""
fi

if [[ "${USE_PORT_FORWARD}" == "true" ]]; then
  echo -e "${GREEN}To use the vclusters:${NC}"
  echo ""
  echo "1. Start port-forwarding in separate terminals:"
  
  CURRENT_PORT=${PORT_START}
  for ENV in "${VCLUSTER_ENVS[@]}"; do
    if [[ " ${SUCCESSFUL_CONTEXTS[@]} " =~ " ${ENV}-vcluster " ]]; then
      echo -e "   ${YELLOW}vcluster connect vcluster-${ENV}-helm --namespace ${ENV}-vcluster --local-port ${CURRENT_PORT}${NC}"
      CURRENT_PORT=$((CURRENT_PORT + 1))
    fi
  done
  
  echo ""
  echo "2. Then use the contexts:"
  echo -e "   ${YELLOW}kubectl config use-context dev-vcluster${NC}"
  echo -e "   ${YELLOW}kubectl config use-context staging-vcluster${NC}"
  echo ""
  echo "3. Verify connection:"
  echo -e "   ${YELLOW}kubectl get ns${NC}"
else
  echo -e "${GREEN}To use the vclusters:${NC}"
  echo -e "   ${YELLOW}kubectl config use-context dev-vcluster${NC}"
  echo -e "   ${YELLOW}kubectl config use-context staging-vcluster${NC}"
fi

echo ""
echo -e "${GREEN}Tips:${NC}"
echo "• Set USE_PORT_FORWARD=false for direct cluster connections"
echo "• Set PORT_START to change the starting port (default: 8443)"
echo "• The vcluster CLI handles certificate management automatically"

# Check if we need to update /etc/hosts (only for direct connections)
if [[ "${USE_PORT_FORWARD}" != "true" ]]; then
  echo ""
  echo -e "${YELLOW}Note: For direct connections, you may need to add cluster DNS entries to /etc/hosts${NC}"
fi