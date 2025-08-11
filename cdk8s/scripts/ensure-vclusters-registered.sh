#!/usr/bin/env bash

set -euo pipefail

# Script to ensure vclusters are properly registered with ArgoCD
# Validates that cluster secrets exist and are properly configured
# Can be used as a health check or in CI/CD pipelines

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VCLUSTER_ENVS=("dev" "staging")
ARGOCD_NAMESPACE="argocd"
VERBOSE=${VERBOSE:-false}

echo -e "${BLUE}=== VCluster Registration Check ===${NC}"
echo ""

# Function to log verbose messages
log_verbose() {
  if [[ "${VERBOSE}" == "true" ]]; then
    echo -e "${BLUE}[DEBUG]${NC} $1"
  fi
}

# Function to check if vcluster is deployed
check_vcluster_deployed() {
  local env=$1
  local namespace="${env}-vcluster"
  local name="vcluster-${env}-helm"
  
  log_verbose "Checking if ${name} is deployed in ${namespace}"
  
  # Check namespace
  if ! kubectl get namespace "${namespace}" >/dev/null 2>&1; then
    echo -e "${RED}  ✗ Namespace ${namespace} does not exist${NC}"
    return 1
  fi
  
  # Check vcluster pod
  local pod_name="${name}-0"
  if ! kubectl get pod "${pod_name}" -n "${namespace}" >/dev/null 2>&1; then
    echo -e "${RED}  ✗ VCluster pod ${pod_name} not found${NC}"
    return 1
  fi
  
  # Check pod status
  local pod_status=$(kubectl get pod "${pod_name}" -n "${namespace}" -o jsonpath='{.status.phase}' 2>/dev/null)
  local pod_ready=$(kubectl get pod "${pod_name}" -n "${namespace}" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)
  
  if [[ "${pod_status}" != "Running" ]] || [[ "${pod_ready}" != "True" ]]; then
    echo -e "${YELLOW}  ⚠ VCluster ${name} is not ready (status: ${pod_status}, ready: ${pod_ready})${NC}"
    return 1
  fi
  
  echo -e "${GREEN}  ✓ VCluster deployed and running${NC}"
  return 0
}

# Function to check if vcluster secret exists
check_vcluster_secret() {
  local env=$1
  local namespace="${env}-vcluster"
  local secret_name="vc-vcluster-${env}-helm"
  
  log_verbose "Checking for secret ${secret_name} in ${namespace}"
  
  if ! kubectl get secret "${secret_name}" -n "${namespace}" >/dev/null 2>&1; then
    echo -e "${RED}  ✗ VCluster secret ${secret_name} not found${NC}"
    return 1
  fi
  
  # Check secret has required keys
  local keys=$(kubectl get secret "${secret_name}" -n "${namespace}" -o jsonpath='{.data}' | jq -r 'keys[]' 2>/dev/null)
  local required_keys=("certificate-authority" "client-certificate" "client-key")
  
  for key in "${required_keys[@]}"; do
    if ! echo "${keys}" | grep -q "^${key}$"; then
      echo -e "${RED}  ✗ Secret missing required key: ${key}${NC}"
      return 1
    fi
  done
  
  echo -e "${GREEN}  ✓ VCluster secret exists with required keys${NC}"
  return 0
}

# Function to check ArgoCD cluster registration
check_argocd_registration() {
  local env=$1
  local cluster_name="${env}-vcluster"
  
  log_verbose "Checking ArgoCD registration for ${cluster_name}"
  
  # Check if the cluster secret exists in ArgoCD namespace
  local secret_name="cluster-${cluster_name}"
  
  # Look for secrets with the cluster label
  local cluster_secrets=$(kubectl get secrets -n "${ARGOCD_NAMESPACE}" \
    -l "argocd.argoproj.io/secret-type=cluster" \
    -o jsonpath='{.items[*].metadata.name}' 2>/dev/null)
  
  log_verbose "Found cluster secrets: ${cluster_secrets}"
  
  # Check if our cluster is registered
  local found=false
  for secret in ${cluster_secrets}; do
    local server=$(kubectl get secret "${secret}" -n "${ARGOCD_NAMESPACE}" \
      -o jsonpath='{.data.server}' 2>/dev/null | base64 -d 2>/dev/null || true)
    
    local name_from_secret=$(kubectl get secret "${secret}" -n "${ARGOCD_NAMESPACE}" \
      -o jsonpath='{.data.name}' 2>/dev/null | base64 -d 2>/dev/null || true)
    
    log_verbose "Checking secret ${secret}: name=${name_from_secret}, server=${server}"
    
    if [[ "${name_from_secret}" == "${cluster_name}" ]]; then
      found=true
      echo -e "${GREEN}  ✓ Registered in ArgoCD (secret: ${secret})${NC}"
      
      # Validate the secret has proper structure
      local config=$(kubectl get secret "${secret}" -n "${ARGOCD_NAMESPACE}" \
        -o jsonpath='{.data.config}' 2>/dev/null)
      
      if [[ -z "${config}" ]]; then
        echo -e "${YELLOW}  ⚠ Warning: Cluster secret missing config data${NC}"
        return 1
      fi
      
      break
    fi
  done
  
  if [[ "${found}" != "true" ]]; then
    echo -e "${YELLOW}  ⚠ Not registered in ArgoCD (may be pending External Secret sync)${NC}"
    return 1
  fi
  
  return 0
}

# Function to check if applications can target the vcluster
check_application_targeting() {
  local env=$1
  local cluster_name="${env}-vcluster"
  
  log_verbose "Checking if applications can target ${cluster_name}"
  
  # Check if any applications are targeting this cluster
  local apps=$(kubectl get applications -n "${ARGOCD_NAMESPACE}" \
    -o jsonpath="{.items[?(@.spec.destination.name=='${cluster_name}')].metadata.name}" 2>/dev/null)
  
  if [[ -n "${apps}" ]]; then
    echo -e "${GREEN}  ✓ Applications targeting cluster: ${apps}${NC}"
  else
    echo -e "${BLUE}  ℹ No applications currently targeting this cluster${NC}"
  fi
  
  return 0
}

# Function to test actual connectivity
test_cluster_connectivity() {
  local env=$1
  local cluster_name="${env}-vcluster"
  
  log_verbose "Testing connectivity to ${cluster_name}"
  
  # Try to use vcluster CLI to test connection
  if command -v vcluster >/dev/null 2>&1; then
    local namespace="${env}-vcluster"
    local name="vcluster-${env}-helm"
    
    # Try to list namespaces using vcluster
    if vcluster list | grep -q "${name}.*Running"; then
      echo -e "${GREEN}  ✓ VCluster CLI can see the cluster${NC}"
    else
      echo -e "${YELLOW}  ⚠ VCluster CLI cannot list the cluster${NC}"
      return 1
    fi
  else
    log_verbose "vcluster CLI not available, skipping connectivity test"
  fi
  
  return 0
}

# Main execution
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

for ENV in "${VCLUSTER_ENVS[@]}"; do
  echo -e "${BLUE}Checking ${ENV} vcluster:${NC}"
  
  ALL_PASSED=true
  
  # 1. Check deployment
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  if check_vcluster_deployed "${ENV}"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
  else
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    ALL_PASSED=false
  fi
  
  # 2. Check secret
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  if check_vcluster_secret "${ENV}"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
  else
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    ALL_PASSED=false
  fi
  
  # 3. Check ArgoCD registration
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  if check_argocd_registration "${ENV}"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
  else
    WARNINGS=$((WARNINGS + 1))
    # Don't mark as failed, just a warning
  fi
  
  # 4. Check application targeting
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  if check_application_targeting "${ENV}"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
  else
    WARNINGS=$((WARNINGS + 1))
  fi
  
  # 5. Test connectivity
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  if test_cluster_connectivity "${ENV}"; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
  else
    WARNINGS=$((WARNINGS + 1))
  fi
  
  if [[ "${ALL_PASSED}" == "true" ]]; then
    echo -e "${GREEN}  Overall: ✓ All critical checks passed${NC}"
  else
    echo -e "${YELLOW}  Overall: ⚠ Some checks need attention${NC}"
  fi
  
  echo ""
done

# Summary
echo -e "${BLUE}=== Summary ===${NC}"
echo "Total checks: ${TOTAL_CHECKS}"
echo -e "${GREEN}Passed: ${PASSED_CHECKS}${NC}"
if [[ ${FAILED_CHECKS} -gt 0 ]]; then
  echo -e "${RED}Failed: ${FAILED_CHECKS}${NC}"
fi
if [[ ${WARNINGS} -gt 0 ]]; then
  echo -e "${YELLOW}Warnings: ${WARNINGS}${NC}"
fi

echo ""

# Provide recommendations if needed
if [[ ${FAILED_CHECKS} -gt 0 ]] || [[ ${WARNINGS} -gt 0 ]]; then
  echo -e "${BLUE}=== Recommendations ===${NC}"
  
  if [[ ${FAILED_CHECKS} -gt 0 ]]; then
    echo -e "${YELLOW}• Some vclusters are not properly deployed${NC}"
    echo "  Run: kubectl get pods -A | grep vcluster"
    echo "  Check ArgoCD for vcluster applications"
  fi
  
  if [[ ${WARNINGS} -gt 0 ]]; then
    echo -e "${YELLOW}• ArgoCD registration may be pending${NC}"
    echo "  Check External Secrets: kubectl get externalsecrets -n argocd"
    echo "  Force sync if needed: argocd app sync <app-name>"
    echo ""
    echo -e "${YELLOW}• To manually register a cluster:${NC}"
    echo "  vcluster connect vcluster-<env>-helm --namespace <env>-vcluster"
    echo "  argocd cluster add <context-name>"
  fi
  
  echo ""
fi

# Exit code based on critical failures only
if [[ ${FAILED_CHECKS} -gt 0 ]]; then
  echo -e "${RED}Critical checks failed. VClusters may not be fully operational.${NC}"
  exit 1
else
  echo -e "${GREEN}All critical checks passed. VClusters are operational.${NC}"
  
  if [[ ${WARNINGS} -gt 0 ]]; then
    echo -e "${YELLOW}Note: Some non-critical warnings were detected.${NC}"
  fi
  
  exit 0
fi