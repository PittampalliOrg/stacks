# cdk8s-project/.devcontainer/Makefile
# Streamlined GitOps setup for KIND and AKS clusters with CDK8s
#
# ============================================================================
# CLUSTER NAMING CONVENTION
# ============================================================================
# KIND clusters: Use the suffix after 'kind-' as the CLUSTER name
#   - Context 'kind-gitops' → CLUSTER=gitops
#   - Context 'kind-kind' → CLUSTER=kind
# AKS clusters: Use the full context name as the CLUSTER name
#   - Context 'prod' → CLUSTER=prod
#   - Context 'staging' → CLUSTER=staging
# ============================================================================
# ENVIRONMENT VARIABLES
# ============================================================================
# SKIP_DEPS=1            Skip dependency chain (run individual targets)
# CLUSTER=<name>         Cluster name (see naming convention above)
#
# ============================================================================
# COMMAND STRUCTURE
# ============================================================================
#
# Setup flow:
#   make all                   Complete setup (deploy + validation)
#   make deploy                Core deployment only
#
# Individual components:
#   make azure-infra          Azure resources (AD app, storage for KIND)
#   make k8s-cluster          Create/connect to cluster
#   make workload-identity-setup    Configure workload identity
#   make gitops-setup         Simplified GitOps deployment
#
# Cleanup:
#   make clean                Remove everything
#   make clean-k8s            Remove Kubernetes cluster only
#   make clean-azure          Remove Azure resources (requires confirmation)
#
# Validation:
#   make status               Show cluster and app status
#   make validate-workload-identity    Check federated credentials
# ============================================================================

.DEFAULT_GOAL := all
SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c
.ONESHELL:
.DELETE_ON_ERROR:

# Mark all targets as phony
.PHONY: all deploy base-setup azure-infra k8s-cluster create-aks-cluster deploy-aks \
	workload-identity-setup gitops-public-apps \
	clean clean-k8s clean-azure fresh gitops-setup status help \
	check-dependencies ensure-cluster-connected \
	validate-base-cluster validate-argocd validate-external-secrets validate-workload-identity

# Configuration
# Dynamic PROJECT_ROOT detection for portability
MAKEFILE_PATH := $(abspath $(lastword $(MAKEFILE_LIST)))
MAKEFILE_DIR  := $(dir $(MAKEFILE_PATH))
PROJECT_ROOT  := $(abspath $(MAKEFILE_DIR)/..)
PROJECT_DIR := $(PROJECT_ROOT)
SCRIPT_DIR  := $(PROJECT_ROOT)/.devcontainer/scripts
TMP_DIR     := $(SCRIPT_DIR)/../.tmp
MONITOR     := $(SCRIPT_DIR)/monitor-progress.sh

# Cluster configuration - CLUSTER parameter is required
ifndef CLUSTER
  $(error CLUSTER is required. Usage: make <target> CLUSTER=<name>)
endif

# Determine kubectl context based on cluster name
# KIND clusters use 'kind-' prefix, AKS clusters use the name as-is
ifeq ($(CLUSTER),kind)
  # Special case: 'kind' alone maps to 'kind-kind'
  KUBECTL_CONTEXT := kind-kind
else
  # Check if this is a KIND cluster by looking for kind- prefix context
  KIND_CONTEXT_CHECK := $(shell kubectl config get-contexts -o name | grep -x "kind-$(CLUSTER)" 2>/dev/null)
  ifneq ($(KIND_CONTEXT_CHECK),)
    KUBECTL_CONTEXT := kind-$(CLUSTER)
  else
    # Assume AKS or other cluster - use name as-is
    KUBECTL_CONTEXT := $(CLUSTER)
  endif
endif

# Validate that the context exists
CONTEXT_EXISTS := $(shell kubectl config get-contexts -o name | grep -x "$(KUBECTL_CONTEXT)" 2>/dev/null)
ifeq ($(CONTEXT_EXISTS),)
  $(error kubectl context '$(KUBECTL_CONTEXT)' not found. Available contexts: $(shell kubectl config get-contexts -o name))
endif

# Get the server URL for the determined context
KUBECTL_SERVER := $(shell kubectl config view --context=$(KUBECTL_CONTEXT) -o jsonpath="{.clusters[?(@.name=='$(KUBECTL_CONTEXT)')].cluster.server}" 2>/dev/null)

# Detect cluster type based on server URL
ifneq ($(findstring azmk8s.io,$(KUBECTL_SERVER)),)
  # AKS cluster detected
  CLUSTER_TYPE := aks
else ifneq ($(findstring 127.0.0.1,$(KUBECTL_SERVER))$(findstring localhost,$(KUBECTL_SERVER)),)
  # Local cluster (KIND)
  CLUSTER_TYPE := kind
else
  $(error Unknown cluster type for context $(KUBECTL_CONTEXT). Server: $(KUBECTL_SERVER))
endif

# Export for use in scripts
export CLUSTER
export KUBECTL_CONTEXT
export CLUSTER_TYPE

# Environment file selection based on cluster type
ifeq ($(CLUSTER_TYPE),kind)
  ENV_FILE := $(PROJECT_ROOT)/.env-files/wi.env
else
  ENV_FILE := $(PROJECT_ROOT)/.env-files/production.env
endif

# Platform apps selection based on cluster type
ifeq ($(CLUSTER_TYPE),kind)
  PLATFORM_APPS := platform-apps-kind.yaml
else
  PLATFORM_APPS := platform-apps-aks.yaml
endif

# Workload Identity Service Account Configuration
# Format: namespace:service-account-name
# These service accounts will be created with federated credentials
WORKLOAD_IDENTITY_SERVICE_ACCOUNTS := \
	external-secrets:external-secrets \
	kargo:acr-sa \
	mcp-tools:acr-sa \
	nextjs:acr-sa \
	gitops-pipelines:acr-sa

# Export for use in shell scripts
export WORKLOAD_IDENTITY_SERVICE_ACCOUNTS

# Legacy compatibility
WI_ENV := $(ENV_FILE)
PHASE_RUNNER := $(SCRIPT_DIR)/wi-kind.sh

# Environment files are loaded via shell sourcing in each target that needs them

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[0;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

# ============================================================================
# Main Targets
# ============================================================================

# Complete setup
all: deploy
	@echo -e "\n$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	@echo -e "$(GREEN)✅ Setup Complete!$(NC)"
	@echo -e "$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	@$(MAKE) --no-print-directory status

# Core deployment
deploy: check-dependencies base-setup validate-base-cluster workload-identity-setup gitops-public-apps validate-argocd validate-external-secrets post-argocd-workload-identity
	@echo -e "\n$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	@echo -e "$(GREEN)✅ Deployment Complete!$(NC)"
	@echo -e "$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	@echo -e "$(BLUE)Applications are syncing in the background.$(NC)"
	@echo ""
	@echo "Monitor application status with:"
	@echo -e "  $(YELLOW)kubectl get apps -n argocd$(NC)"

# Fresh restart (preserves Azure resources)
fresh: clean-k8s all

# Simplified GitOps setup
gitops-setup: clean-k8s k8s-cluster workload-identity-setup gitops-public-apps
	@printf "\n$(GREEN)════════════════════════════════════════════════════════════════$(NC)\n"
	@printf "$(GREEN)✅ GitOps setup complete!$(NC)\n"
	@printf "$(GREEN)════════════════════════════════════════════════════════════════$(NC)\n"
	@echo ""
	@echo -e "$(BLUE)📋 Next steps:$(NC)"
	@echo "1. Check application status: kubectl get applications -n argocd"
	@echo "2. Access ArgoCD UI: http://argocd.localtest.me"
	@echo "3. Monitor sync progress in the ArgoCD UI"

# Complete AKS deployment including cluster creation
deploy-aks: CLUSTER_NAME=$(CLUSTER)
deploy-aks: create-aks-cluster all
	@echo -e "\n$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	@echo -e "$(GREEN)✅ AKS cluster created and configured!$(NC)"
	@echo -e "$(GREEN)════════════════════════════════════════════════════════════════$(NC)"

# ============================================================================
# Infrastructure Setup
# ============================================================================

# Combined base setup
base-setup: azure-infra k8s-cluster
	@echo -e "$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	@echo -e "$(GREEN)✅ Base Infrastructure Setup Complete$(NC)"
	@echo -e "$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	@echo "Using kubectl context: $(KUBECTL_CONTEXT)"

# Azure infrastructure only
azure-infra: $(if $(SKIP_DEPS),,$(TMP_DIR))
	@echo -e "$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	@echo -e "$(GREEN)☁️  Azure Infrastructure Setup$(NC)"
	@echo -e "$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	@echo "Setting up Azure infrastructure..."
	
	# Only run storage/OIDC setup for KIND clusters
	@if [ "$(CLUSTER_TYPE)" = "kind" ]; then \
		echo -e "$(BLUE)📋 Checking KIND-specific Azure infrastructure...$(NC)"; \
		if CLUSTER="$(CLUSTER)" KUBECTL_CONTEXT="$(KUBECTL_CONTEXT)" CLUSTER_TYPE="$(CLUSTER_TYPE)" $(SCRIPT_DIR)/check-azure-infra.sh; then \
			echo -e "\n$(GREEN)✅ Existing Azure infrastructure meets all requirements$(NC)"; \
			echo "Skipping provisioning of new resources."; \
		else \
			echo -e "\n$(YELLOW)⚠️  Azure infrastructure validation failed or incomplete$(NC)"; \
			echo "Provisioning required resources..."; \
			echo -e "\n$(BLUE)📦 Creating Azure storage account...$(NC)"; \
			$(PHASE_RUNNER) storage || exit 1; \
			echo -e "\n$(BLUE)🔐 Setting up OIDC provider...$(NC)"; \
			$(PHASE_RUNNER) oidc || exit 1; \
		fi; \
	else \
		echo -e "$(YELLOW)ℹ️  Skipping storage/OIDC setup for AKS cluster (uses Azure-managed OIDC)$(NC)"; \
	fi
	
	# Create Azure AD app early so client ID is available for ArgoCD
	@echo -e "\n$(BLUE)🔑 Setting up Azure AD app registration...$(NC)"
	@if [ -x "$(SCRIPT_DIR)/create-azure-ad-app.sh" ]; then \
		CLUSTER="$(CLUSTER)" KUBECTL_CONTEXT="$(KUBECTL_CONTEXT)" ENV_FILE="$(ENV_FILE)" $(SCRIPT_DIR)/create-azure-ad-app.sh || exit 1; \
	else \
		echo -e "$(RED)❌ create-azure-ad-app.sh not found$(NC)" && exit 1; \
	fi
	
	@echo -e "\n$(GREEN)✅ Azure infrastructure ready$(NC)\n"

# Kubernetes cluster only
k8s-cluster: $(if $(SKIP_DEPS),,$(TMP_DIR))
	@echo -e "$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	@echo -e "$(GREEN)🚢 Kubernetes Cluster Setup$(NC)"
	@echo -e "$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	@if [ "$(CLUSTER_TYPE)" != "kind" ]; then \
		echo "Using existing cluster: $(CLUSTER)"; \
		$(MAKE) ensure-cluster-connected; \
	else \
		echo "Creating KIND cluster with Docker..."; \
		echo -e "$(BLUE)🧹 Optimizing Docker resources before cluster creation...$(NC)"; \
		if which docker &>/dev/null; then \
			docker system prune -af --volumes || true; \
		fi; \
		echo -e "$(BLUE)🔌 Ensuring Docker is available...$(NC)"; \
		if ! docker info &>/dev/null; then \
			echo -e "$(RED)❌ Docker is not running. Please start Docker Desktop.$(NC)" && exit 1; \
		fi; \
	fi
	
	# KIND-specific setup only runs when CLUSTER_TYPE=kind
	@if [ "$(CLUSTER_TYPE)" = "kind" ]; then \
		echo -e "$(BLUE)🔧 Ensuring Azure infrastructure exists for KIND cluster...$(NC)"; \
		$(MAKE) azure-infra CLUSTER=$(CLUSTER); \
		set -a; source $(ENV_FILE) 2>/dev/null || true; set +a; \
		if [ -z "$$SERVICE_ACCOUNT_ISSUER" ]; then \
			echo -e "$(RED)❌ Failed to set up Azure infrastructure$(NC)" && exit 1; \
		else \
			echo -e "$(BLUE)Using OIDC issuer: $$SERVICE_ACCOUNT_ISSUER$(NC)"; \
		fi; \
		echo -e "\n$(BLUE)🐳 Creating kind cluster with Docker...$(NC)"; \
	fi
	# Run KIND-specific setup steps
	@if [ "$(CLUSTER_TYPE)" = "kind" ]; then \
		if grep -qi microsoft /proc/version; then \
			echo -e "$(BLUE)🖥️  Docker Desktop WSL2 integration detected$(NC)"; \
		fi; \
		set -a; \
		source $(ENV_FILE) 2>/dev/null || true; \
		set +a; \
		$(PHASE_RUNNER) kind; \
		echo -e "\n$(BLUE)🔍 Validating cluster OIDC configuration...$(NC)"; \
		set -a; source $(ENV_FILE) 2>/dev/null || true; set +a; \
		CLUSTER_ISSUER=$$(kubectl get --raw /.well-known/openid-configuration 2>/dev/null | jq -r .issuer) && \
		if [ "$$CLUSTER_ISSUER" = "$$SERVICE_ACCOUNT_ISSUER" ]; then \
			echo -e "$(GREEN)✅ Cluster OIDC issuer matches expected: $$CLUSTER_ISSUER$(NC)"; \
		else \
			echo -e "$(RED)❌ Cluster OIDC issuer mismatch!$(NC)" && \
			echo "Expected: $$SERVICE_ACCOUNT_ISSUER" && \
			echo "Actual: $$CLUSTER_ISSUER" && \
			exit 1; \
		fi; \
		echo -e "\n$(BLUE)🔑 Updating JWKS in storage account...$(NC)"; \
		$(SCRIPT_DIR)/update-oidc-jwks.sh || \
			echo -e "$(YELLOW)⚠️  Failed to update JWKS - manual update may be needed$(NC)"; \
		echo -e "\n$(BLUE)🌐 Configuring DNS for GitOps...$(NC)"; \
		$(SCRIPT_DIR)/configure-dns-for-gitops.sh || { \
			echo -e "$(RED)❌ DNS configuration failed - GitOps will not work properly$(NC)"; \
			echo -e "$(YELLOW)💡 Try running: kubectl apply -f https://raw.githubusercontent.com/coredns/deployment/master/kubernetes/coredns.yaml.sed$(NC)"; \
			exit 1; \
		}; \
		echo -e "\n$(BLUE)🌐 Setting up NGINX proxy for browser access...$(NC)"; \
		if [ -x "$(SCRIPT_DIR)/setup-nginx-proxy.sh" ]; then \
			$(SCRIPT_DIR)/setup-nginx-proxy.sh || echo -e "$(YELLOW)⚠️  Proxy setup failed, continuing anyway$(NC)"; \
		else \
			echo -e "$(YELLOW)⚠️  Proxy setup script not found$(NC)"; \
		fi; \
	fi
	@echo -e "\n$(GREEN)✅ Kubernetes cluster ready$(NC)\n"

# Create AKS cluster (requires environment variables)
create-aks-cluster:
	@echo -e "$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	@echo -e "$(GREEN)🚀 Creating AKS Cluster$(NC)"
	@echo -e "$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	@if [ -z "$(CLUSTER_NAME)" ]; then \
		echo -e "$(RED)❌ CLUSTER_NAME not set. Usage: make create-aks-cluster CLUSTER_NAME=my-cluster$(NC)"; \
		exit 1; \
	fi
	@# Default RESOURCE_GROUP to CLUSTER_NAME if not set
	@if [ -z "$(RESOURCE_GROUP)" ]; then \
		RG="$(CLUSTER_NAME)"; \
	else \
		RG="$(RESOURCE_GROUP)"; \
	fi; \
	echo "Creating AKS cluster '$(CLUSTER_NAME)' in resource group '$$RG'..."; \
	CLUSTER_NAME="$(CLUSTER_NAME)" \
	RESOURCE_GROUP="$$RG" \
	LOCATION="$(LOCATION)" \
	NODE_VM_SIZE="$(NODE_VM_SIZE)" \
	NODE_COUNT="$(NODE_COUNT)" \
	$(SCRIPT_DIR)/create-aks-cluster.sh
	@echo -e "\n$(GREEN)✅ AKS cluster created successfully!$(NC)"

# Helper to ensure we're connected to a cluster
ensure-cluster-connected:
	@if ! kubectl --context $(KUBECTL_CONTEXT) cluster-info &>/dev/null; then \
		echo -e "$(RED)❌ Not connected to any Kubernetes cluster$(NC)"; \
		echo "Please connect to a cluster first:"; \
		echo "  - For KIND: make k8s-cluster"; \
		echo "  - For AKS: az aks get-credentials --name <cluster-name> --resource-group <rg>"; \
		exit 1; \
	fi
	@echo -e "$(GREEN)✅ Connected to $(CLUSTER) cluster$(NC)"

# Workload Identity and External Secrets setup
workload-identity-setup: $(if $(SKIP_DEPS),,ensure-cluster-connected)
	@echo -e "$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	@echo -e "$(GREEN)🔧 Workload Identity and External Secrets Setup$(NC)"
	@echo -e "$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	
# 	# Setup workload identity (webhook for KIND, verify for AKS)
# 	@if [ "$(CLUSTER_TYPE)" = "kind" ]; then \
# 		echo -e "$(BLUE)📦 Installing workload identity webhook for KIND cluster...$(NC)"; \
# 	else \
# 		echo -e "$(BLUE)🔍 Verifying workload identity configuration for AKS cluster...$(NC)"; \
# 		echo -e "$(YELLOW)ℹ️  AKS clusters have workload identity pre-installed$(NC)"; \
# 	fi
# 	@set -a; source $(ENV_FILE) 2>/dev/null || true; set +a; \
# 	CLUSTER_TYPE="$(CLUSTER_TYPE)" KUBECTL_CONTEXT="$(KUBECTL_CONTEXT)" source $(SCRIPT_DIR)/cluster-lib.sh && \
# 	setup_workload_identity || { \
# 		echo -e "$(RED)❌ Failed to setup/verify workload identity$(NC)"; \
# 		exit 1; \
# 	}
# 	@if [ "$(CLUSTER_TYPE)" = "kind" ]; then \
# 		echo -e "$(GREEN)✅ Workload Identity webhook installed$(NC)"; \
# 	else \
# 		echo -e "$(GREEN)✅ Workload Identity verified - AKS cluster ready$(NC)"; \
# 	fi
	
# 	# Install External Secrets Operator
# 	@echo -e "\n$(BLUE)📦 Installing External Secrets Operator...$(NC)"
# 	@set -a; source $(ENV_FILE) 2>/dev/null || true; set +a; \
# 	CLUSTER_TYPE="$(CLUSTER_TYPE)" KUBECTL_CONTEXT="$(KUBECTL_CONTEXT)" source $(SCRIPT_DIR)/cluster-lib.sh && \
# 	ESO_NS=external-secrets install_external_secrets_operator || { \
# 		echo -e "$(RED)❌ Failed to install External Secrets Operator$(NC)"; \
# 		exit 1; \
# 	}
# 	@echo -e "$(GREEN)✅ External Secrets Operator installed$(NC)"

	
	# Set up Azure AD app and service accounts with federated credentials
	@echo -e "\n$(BLUE)🔧 Setting up Azure AD app and service accounts...$(NC)"
	@set -a; \
	source $(ENV_FILE) 2>/dev/null || true; \
	set +a; \
	CLUSTER_TYPE="$(CLUSTER_TYPE)" KUBECTL_CONTEXT="$(KUBECTL_CONTEXT)" source $(SCRIPT_DIR)/cluster-lib.sh && \
	require_az_login && \
	require_service_account_issuer && \
	resolve_keyvault && \
	ensure_keyvault_access && \
	ensure_acr_pull_role
	
	# Create federated credentials for all configured service accounts
	@echo -e "\n$(BLUE)🔧 Creating federated credentials for configured service accounts...$(NC)"
	@for sa_config in $(WORKLOAD_IDENTITY_SERVICE_ACCOUNTS); do \
		namespace=$${sa_config%%:*}; \
		sa_name=$${sa_config##*:}; \
		echo -e "\n$(BLUE)   Setting up $$namespace/$$sa_name...$(NC)"; \
		if [ "$$namespace" != "external-secrets" ]; then \
			if ! kubectl --context $(KUBECTL_CONTEXT) get namespace $$namespace >/dev/null 2>&1; then \
				echo -e "$(YELLOW)⚠️  Namespace $$namespace doesn't exist yet, will be created by ArgoCD later$(NC)"; \
				echo -e "$(YELLOW)    Skipping $$namespace/$$sa_name for now...$(NC)"; \
				continue; \
			fi; \
		fi; \
		set -a; source $(ENV_FILE) 2>/dev/null || true; set +a; \
		CLUSTER_TYPE="$(CLUSTER_TYPE)" KUBECTL_CONTEXT="$(KUBECTL_CONTEXT)" source $(SCRIPT_DIR)/cluster-lib.sh && \
		ESO_NAMESPACE=$$namespace ESO_SA_NAME=$$sa_name create_eso_service_account || \
		echo -e "$(YELLOW)⚠️  Failed to create $$namespace/$$sa_name, continuing...$(NC)"; \
	done
	
	# Wait for the external-secrets service account to be ready with proper annotations
	@echo -e "\n$(BLUE)⏳ Waiting for external-secrets service account to be ready...$(NC)"
	@for i in {1..30}; do \
		if kubectl get sa external-secrets -n external-secrets >/dev/null 2>&1; then \
			CLIENT_ID=$$(kubectl get sa external-secrets -n external-secrets -o jsonpath='{.metadata.annotations.azure\.workload\.identity/client-id}' 2>/dev/null || echo ""); \
			if [ -n "$$CLIENT_ID" ]; then \
				echo -e "$(GREEN)✅ Service account is ready with workload identity: $$CLIENT_ID$(NC)"; \
				break; \
			fi; \
		fi; \
		printf "\r⏳ Waiting for service account ($$i/30)..."; \
		sleep 2; \
	done
	
	# Reconcile federated credentials to ensure they have the correct issuer
	@echo -e "\n$(BLUE)🔄 Reconciling federated credentials...$(NC)"
	@set -a; source $(ENV_FILE) 2>/dev/null || true; set +a; \
	CLUSTER_TYPE="$(CLUSTER_TYPE)" KUBECTL_CONTEXT="$(KUBECTL_CONTEXT)" source $(SCRIPT_DIR)/cluster-lib.sh && \
	reconcile_federated_credentials || \
		echo -e "$(YELLOW)⚠️  Failed to reconcile federated credentials, continuing...$(NC)"
	
# 	# Create ClusterSecretStore for Azure Key Vault
# 	@echo -e "\n$(BLUE)🔐 Creating ClusterSecretStore for Azure Key Vault...$(NC)"
# 	@set -a; source $(ENV_FILE) 2>/dev/null || true; set +a; \
# 	CLUSTER_TYPE="$(CLUSTER_TYPE)" KUBECTL_CONTEXT="$(KUBECTL_CONTEXT)" source $(SCRIPT_DIR)/cluster-lib.sh && \
# 	if [ -z "$$AZURE_KEYVAULT_NAME" ]; then \
# 		AZURE_KEYVAULT_NAME=$$(get_keyvault_name 2>/dev/null || echo ""); \
# 	fi; \
# 	if [ -n "$$AZURE_KEYVAULT_NAME" ]; then \
# 		printf '%s\n' \
# 			'---' \
# 			'# ClusterSecretStore for Azure Key Vault' \
# 			'apiVersion: external-secrets.io/v1' \
# 			'kind: ClusterSecretStore' \
# 			'metadata:' \
# 			'  name: azure-keyvault-store' \
# 			'  labels:' \
# 			'    app.kubernetes.io/managed-by: bootstrap' \
# 			'spec:' \
# 			'  provider:' \
# 			'    azurekv:' \
# 			"      vaultUrl: https://$$AZURE_KEYVAULT_NAME.vault.azure.net" \
# 			'      authType: WorkloadIdentity' \
# 			'      serviceAccountRef:' \
# 			'        name: external-secrets' \
# 			'        namespace: external-secrets' \
# 			'---' | kubectl apply -f - && \
# 		echo -e "$(GREEN)✅ ClusterSecretStore created$(NC)" || \
# 		echo -e "$(YELLOW)⚠️  Failed to create ClusterSecretStore, continuing...$(NC)"; \
# 	else \
# 		echo -e "$(YELLOW)⚠️  AZURE_KEYVAULT_NAME not found in environment$(NC)"; \
# 	fi
	
# 	# Verify ClusterSecretStore is ready
# 	@echo -e "\n$(BLUE)🔍 Verifying ClusterSecretStore readiness...$(NC)"
# 	@for i in {1..30}; do \
# 		STATUS=$$(kubectl --context $(KUBECTL_CONTEXT) get clustersecretstore azure-keyvault-store -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo ""); \
# 		if [ "$$STATUS" = "True" ]; then \
# 			echo -e "$(GREEN)✅ ClusterSecretStore is ready$(NC)"; \
# 			break; \
# 		fi; \
# 		if [ $$i -eq 30 ]; then \
# 			echo -e "$(YELLOW)⚠️  ClusterSecretStore not ready after 30s, continuing anyway...$(NC)"; \
# 			kubectl --context $(KUBECTL_CONTEXT) describe clustersecretstore azure-keyvault-store 2>/dev/null || true; \
# 		fi; \
# 		sleep 1; \
# 	done
	
# 	# Create argocd namespace if it doesn't exist
# 	@echo -e "\n$(BLUE)📁 Creating argocd namespace...$(NC)"
# 	@kubectl --context $(KUBECTL_CONTEXT) create namespace argocd --dry-run=client -o yaml | kubectl --context $(KUBECTL_CONTEXT) apply -f -
	
# 	# Create GitHub PEM ExternalSecret if it doesn't exist
# 	@echo -e "\n$(BLUE)🔐 Creating GitHub PEM ExternalSecret...$(NC)"
# 	@if kubectl --context $(KUBECTL_CONTEXT) get externalsecret github-pem -n argocd >/dev/null 2>&1; then \
# 		echo -e "$(YELLOW)ℹ️  GitHub PEM ExternalSecret already exists$(NC)"; \
# 	else \
# 		printf '%s\n' \
# 			'---' \
# 			'# GitHub PEM Key ExternalSecret' \
# 			'apiVersion: external-secrets.io/v1' \
# 			'kind: ExternalSecret' \
# 			'metadata:' \
# 			'  name: github-pem' \
# 			'  namespace: argocd' \
# 			'  labels:' \
# 			'    app.kubernetes.io/managed-by: bootstrap' \
# 			'spec:' \
# 			'  refreshInterval: 10m' \
# 			'  secretStoreRef:' \
# 			'    name: azure-keyvault-store' \
# 			'    kind: ClusterSecretStore' \
# 			'  target:' \
# 			'    name: github-pem' \
# 			'    creationPolicy: Owner' \
# 			'  data:' \
# 			'    - secretKey: privateKey' \
# 			'      remoteRef:' \
# 			'        key: github-app-private-key' \
# 			'---' | kubectl apply -f - && \
# 		echo -e "$(GREEN)✅ GitHub PEM ExternalSecret created$(NC)" || \
# 		echo -e "$(YELLOW)⚠️  Failed to create GitHub PEM ExternalSecret, continuing...$(NC)"; \
# 	fi
	
# 	# Wait for github-pem secret to be ready with better error handling
# 	@echo -e "\n$(BLUE)⏳ Waiting for github-pem secret to be synced...$(NC)"
# 	@for i in {1..60}; do \
# 		if kubectl --context $(KUBECTL_CONTEXT) get secret github-pem -n argocd -o jsonpath='{.data.privateKey}' 2>/dev/null | grep -q .; then \
# 			echo -e "$(GREEN)✅ GitHub PEM secret is ready$(NC)"; \
# 			break; \
# 		fi; \
# 		if [ $$i -eq 60 ]; then \
# 			echo -e "$(RED)❌ GitHub PEM secret not ready after 60s$(NC)"; \
# 			echo -e "$(YELLOW)ℹ️  Checking ExternalSecret status...$(NC)"; \
# 			kubectl --context $(KUBECTL_CONTEXT) get externalsecret github-pem -n argocd -o jsonpath='{.status.conditions[0]}' 2>/dev/null || true; \
# 			echo ""; \
# 			echo -e "$(YELLOW)ℹ️  Checking ClusterSecretStore status...$(NC)"; \
# 			kubectl --context $(KUBECTL_CONTEXT) get clustersecretstore azure-keyvault-store -o jsonpath='{.status.conditions[0]}' 2>/dev/null || true; \
# 			echo ""; \
# 			exit 1; \
# 		fi; \
# 		if [ $$((i % 10)) -eq 0 ]; then \
# 			echo -e "$(YELLOW)⏳ Still waiting... ($$i/60)$(NC)"; \
# 		fi; \
# 		sleep 1; \
# 	done
	
# 	# Create GitHub repository credentials for ArgoCD
# 	@echo -e "\n$(BLUE)🔐 Creating GitHub repository credentials for ArgoCD...$(NC)"
# 	@set -a; source $(ENV_FILE) 2>/dev/null || true; set +a; \
# 	PRIVATE_KEY=$$(kubectl --context $(KUBECTL_CONTEXT) get secret github-pem -n argocd -o jsonpath='{.data.privateKey}' | base64 -d) && \
# 	kubectl --context $(KUBECTL_CONTEXT) create secret generic github-app-repo-creds \
# 		-n argocd \
# 		--from-literal=type=git \
# 		--from-literal=url=https://github.com/PittampalliOrg/cdk8s-project.git \
# 		--from-literal=githubAppID=$${GH_APP_ID:-937905} \
# 		--from-literal=githubAppInstallationID=$${GH_INSTALLATION_ID:-58301875} \
# 		--from-literal=githubAppPrivateKey="$$PRIVATE_KEY" \
# 		--dry-run=client -o yaml | \
# 	kubectl --context $(KUBECTL_CONTEXT) apply -f - && \
# 	kubectl --context $(KUBECTL_CONTEXT) label secret github-app-repo-creds -n argocd \
# 		argocd.argoproj.io/secret-type=repository --overwrite && \
# 	echo -e "$(GREEN)✅ GitHub repository credentials created$(NC)" || \
# 	echo -e "$(YELLOW)⚠️  Failed to create GitHub repository credentials$(NC)"
	
# 	@echo -e "\n$(GREEN)✅ Workload Identity setup complete$(NC)\n"

# Validate workload identity configuration
validate-workload-identity: ensure-cluster-connected
	@echo -e "$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	@echo -e "$(GREEN)🔍 Validating Workload Identity Configuration$(NC)"
	@echo -e "$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	@CLUSTER="$(CLUSTER)" KUBECTL_CONTEXT="$(KUBECTL_CONTEXT)" ENV_FILE="$(ENV_FILE)" $(SCRIPT_DIR)/validate-workload-identity.sh

# Create workload identity for remaining namespaces after ArgoCD sync
post-argocd-workload-identity: ensure-cluster-connected
	@echo -e "$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	@echo -e "$(GREEN)🔧 Creating Workload Identity for Additional Namespaces$(NC)"
	@echo -e "$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	@echo "This creates service accounts for namespaces that ArgoCD has now created..."
	
	# Wait for namespaces to be created by ArgoCD
	@echo -e "\n$(BLUE)⏳ Waiting for ArgoCD to create namespaces...$(NC)"
	@for sa_config in $(WORKLOAD_IDENTITY_SERVICE_ACCOUNTS); do \
		namespace=$${sa_config%%:*}; \
		if [ "$$namespace" = "external-secrets" ]; then \
			continue; \
		fi; \
		echo -n "Waiting for namespace $$namespace..."; \
		for i in {1..60}; do \
			if kubectl --context $(KUBECTL_CONTEXT) get namespace $$namespace >/dev/null 2>&1; then \
				echo -e " $(GREEN)✅$(NC)"; \
				break; \
			fi; \
			if [ $$i -eq 60 ]; then \
				echo -e " $(YELLOW)⚠️ Not found after 60s$(NC)"; \
			else \
				sleep 1; \
			fi; \
		done; \
	done
	
	# Create service accounts for the remaining namespaces
	@echo -e "\n$(BLUE)🔧 Creating service accounts for additional namespaces...$(NC)"
	@for sa_config in $(WORKLOAD_IDENTITY_SERVICE_ACCOUNTS); do \
		namespace=$${sa_config%%:*}; \
		sa_name=$${sa_config##*:}; \
		if [ "$$namespace" = "external-secrets" ]; then \
			echo -e "$(BLUE)   Skipping $$namespace/$$sa_name (already created)$(NC)"; \
			continue; \
		fi; \
		if kubectl --context $(KUBECTL_CONTEXT) get namespace $$namespace >/dev/null 2>&1; then \
			echo -e "\n$(BLUE)   Setting up $$namespace/$$sa_name...$(NC)"; \
			set -a; source $(ENV_FILE) 2>/dev/null || true; set +a; \
			CLUSTER_TYPE="$(CLUSTER_TYPE)" KUBECTL_CONTEXT="$(KUBECTL_CONTEXT)" source $(SCRIPT_DIR)/cluster-lib.sh && \
			ESO_NAMESPACE=$$namespace ESO_SA_NAME=$$sa_name create_eso_service_account || \
			echo -e "$(YELLOW)⚠️  Failed to create $$namespace/$$sa_name$(NC)"; \
		else \
			echo -e "$(YELLOW)⚠️  Namespace $$namespace still not found, skipping $$sa_name$(NC)"; \
		fi; \
	done
	
	@echo -e "\n$(GREEN)✅ Additional workload identity setup complete$(NC)\n"

# ============================================================================
# GitOps Deployment
# ============================================================================

# Phase 3: Bootstrap GitOps with public apps (no auth required)
gitops-public-apps: $(if $(SKIP_DEPS),,workload-identity-setup)
	@echo -e "$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	@echo -e "$(GREEN)🚀 Phase 3: GitOps Bootstrap - Public Applications$(NC)"
	@echo -e "$(GREEN)════════════════════════════════════════════════════════════════$(NC)"
	@echo "Installing ArgoCD and public Helm chart applications..."
	
	# Install minimal ArgoCD
	@echo -e "\n$(BLUE)📦 Installing ArgoCD...$(NC)"
	@kubectl --context $(KUBECTL_CONTEXT) create namespace argocd --dry-run=client -o yaml | kubectl --context $(KUBECTL_CONTEXT) apply -f -
	@kubectl --context $(KUBECTL_CONTEXT) apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
	
	# Wait for ArgoCD to be ready with progress monitoring
	@echo -e "\n$(BLUE)⏳ Waiting for ArgoCD components...$(NC)"
	@kubectl --context $(KUBECTL_CONTEXT) -n argocd wait --for=condition=available --timeout=300s deployment/argocd-server
	@kubectl --context $(KUBECTL_CONTEXT) -n argocd wait --for=condition=available --timeout=300s deployment/argocd-repo-server
	@$(MONITOR) argocd-controller 900 || true
	
	# Configure ArgoCD for automation
	@echo -e "\n$(BLUE)🔧 Configuring ArgoCD...$(NC)"
	@kubectl --context $(KUBECTL_CONTEXT) -n argocd patch configmap argocd-cm --type merge -p '{"data":{"application.instanceLabelKey":"argocd.argoproj.io/instance"}}'
	@kubectl --context $(KUBECTL_CONTEXT) -n argocd patch configmap argocd-cmd-params-cm --type merge -p '{"data":{"server.insecure":"true"}}'
	
	# Restart ArgoCD server with new config
	@echo -e "\n$(BLUE)🔄 Restarting ArgoCD server...$(NC)"
	@kubectl --context $(KUBECTL_CONTEXT) -n argocd rollout restart deployment/argocd-server
	@kubectl --context $(KUBECTL_CONTEXT) -n argocd rollout status deployment/argocd-server --timeout=180s
	
	# ArgoCD ingress is now created by CDK8s platform-core-chart
	@echo -e "\n$(BLUE)ℹ️  ArgoCD ingress will be created by platform-core-chart via ArgoCD$(NC)"
	
	# Apply ArgoCD configuration
	@echo -e "\n$(BLUE)🔧 Applying ArgoCD configuration...$(NC)"
	@kubectl --context $(KUBECTL_CONTEXT) apply -k $(PROJECT_ROOT)/bootstrap/argocd-config/
	
	# Apply the bootstrap application based on cluster type
	@echo -e "\n$(BLUE)🎯 Applying ArgoCD bootstrap application...$(NC)"
	@if [ "$(CLUSTER_TYPE)" = "kind" ]; then \
		echo "Applying KIND platform apps..."; \
		kubectl --context $(KUBECTL_CONTEXT) apply -f $(PROJECT_ROOT)/bootstrap/platform-apps-kind.yaml; \
	else \
		echo "Applying AKS platform apps..."; \
		kubectl --context $(KUBECTL_CONTEXT) apply -f $(PROJECT_ROOT)/bootstrap/platform-apps-aks.yaml; \
	fi
	
	# Wait for bootstrap app to sync
	@echo -e "\n$(BLUE)⏳ Waiting for bootstrap application to sync...$(NC)"
	@kubectl --context $(KUBECTL_CONTEXT) wait --for=condition=ready applicationset/platform-apps -n argocd --timeout=300s || true
	
	@echo -e "\n$(GREEN)✅ GitOps public apps deployed$(NC)"


# ============================================================================
# Validation Targets
# ============================================================================

check-dependencies:
	@echo -e "$(BLUE)🔍 Checking required dependencies...$(NC)"
	@echo "Target cluster: $(CLUSTER) (context: $(KUBECTL_CONTEXT), type: $(CLUSTER_TYPE))"
	@which kubectl >/dev/null || { echo -e "$(RED)❌ kubectl not found$(NC)" && exit 1; }
	@which az >/dev/null || { echo -e "$(RED)❌ Azure CLI not found$(NC)" && exit 1; }
	@which jq >/dev/null || { echo -e "$(RED)❌ jq not found$(NC)" && exit 1; }
	@which docker >/dev/null || { echo -e "$(RED)❌ Docker not found$(NC)" && exit 1; }
	@echo -e "$(GREEN)✅ All dependencies installed$(NC)"

validate-base-cluster:
	@echo -e "\n$(BLUE)🔍 Validating base cluster...$(NC)"
	@kubectl --context $(KUBECTL_CONTEXT) cluster-info >/dev/null || { echo -e "$(RED)❌ Cluster not accessible$(NC)" && exit 1; }
	@kubectl --context $(KUBECTL_CONTEXT) get nodes >/dev/null || { echo -e "$(RED)❌ Cannot list nodes$(NC)" && exit 1; }
	@echo -e "$(GREEN)✅ Base cluster validation passed$(NC)"

validate-argocd:
	@echo -e "\n$(BLUE)🔍 Validating ArgoCD installation...$(NC)"
	@kubectl --context $(KUBECTL_CONTEXT) -n argocd wait --for=condition=available --timeout=30s deployment/argocd-server >/dev/null 2>&1 || \
		{ echo -e "$(YELLOW)⚠️  ArgoCD server not ready yet$(NC)"; }
	@kubectl --context $(KUBECTL_CONTEXT) -n argocd get application argocd-bootstrap >/dev/null 2>&1 || \
		{ echo -e "$(YELLOW)⚠️  Bootstrap application not found yet$(NC)"; }
	@echo -e "$(GREEN)✅ ArgoCD validation complete$(NC)"

validate-external-secrets:
	@echo -e "\n$(BLUE)🔍 Validating External Secrets Operator...$(NC)"
	@kubectl --context $(KUBECTL_CONTEXT) get deployment -n external-secrets external-secrets >/dev/null 2>&1 || \
		{ echo -e "$(YELLOW)⚠️  External Secrets deployment not found$(NC)"; }
	@kubectl get crd externalsecrets.external-secrets.io >/dev/null 2>&1 || \
		{ echo -e "$(YELLOW)⚠️  External Secrets CRD not found$(NC)"; }
	@echo -e "$(GREEN)✅ External Secrets validation complete$(NC)"

# ============================================================================
# Cleanup Targets
# ============================================================================

# Remove Kubernetes cluster only
clean-k8s:
	@echo -e "$(RED)════════════════════════════════════════════════════════════════$(NC)"
	@echo -e "$(RED)🗑️  Kubernetes Cluster Cleanup$(NC)"
	@echo -e "$(RED)════════════════════════════════════════════════════════════════$(NC)"
	@if [ "$(CLUSTER_TYPE)" = "kind" ]; then \
		echo "Deleting KIND cluster..."; \
		kind delete cluster --name kind 2>/dev/null || echo "KIND cluster not found"; \
	else \
		echo -e "$(YELLOW)⚠️  Not deleting non-KIND cluster: $(CLUSTER)$(NC)"; \
		echo "To disconnect from this cluster, run:"; \
		echo "  kubectl config use-context <other-context>"; \
	fi
	@echo -e "$(GREEN)✅ Kubernetes cleanup complete$(NC)"

# Remove Azure resources (requires confirmation)
clean-azure:
	@echo -e "$(RED)════════════════════════════════════════════════════════════════$(NC)"
	@echo -e "$(RED)🗑️  Azure Infrastructure Cleanup$(NC)"
	@echo -e "$(RED)════════════════════════════════════════════════════════════════$(NC)"
	@echo -e "$(YELLOW)⚠️  WARNING: This will delete ALL Azure resources including:$(NC)"
	@echo "  - Storage account with OIDC configuration"
	@echo "  - Azure AD app registrations"
	@echo "  - Federated credentials"
	@echo ""
	@read -p "Are you sure you want to delete all Azure resources? (yes/no): " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		echo "Deleting Azure resources..."; \
		CLUSTER="$(CLUSTER)" KUBECTL_CONTEXT="$(KUBECTL_CONTEXT)" $(SCRIPT_DIR)/cleanup-azure-resources.sh || true; \
		echo -e "$(GREEN)✅ Azure resources deleted$(NC)"; \
	else \
		echo -e "$(YELLOW)Cleanup cancelled$(NC)"; \
	fi

# Remove everything
clean-all: clean-azure clean-k8s

# Alias for clean-all
clean: clean-all

# ============================================================================
# Status and Help
# ============================================================================

# Show cluster and application status
status:
	@echo -e "$(BLUE)════════════════════════════════════════════════════════════════$(NC)"
	@echo -e "$(BLUE)📊 Cluster Status$(NC)"
	@echo -e "$(BLUE)════════════════════════════════════════════════════════════════$(NC)"
	@echo ""
	@echo "Cluster: $(CLUSTER)"
	@echo "Context: $(KUBECTL_CONTEXT)"
	@echo "Type: $(CLUSTER_TYPE)"
	@kubectl --context $(KUBECTL_CONTEXT) cluster-info 2>/dev/null || echo -e "$(RED)❌ Not connected to cluster$(NC)"
	@echo ""
	@if kubectl --context $(KUBECTL_CONTEXT) get ns argocd >/dev/null 2>&1; then \
		echo "ArgoCD Status:"; \
		kubectl --context $(KUBECTL_CONTEXT) get pods -n argocd --no-headers | awk '{printf "  %-40s %s\n", $$1, $$3}'; \
		echo ""; \
		echo "ArgoCD UI: http://argocd.localtest.me"; \
		echo "  Username: admin"; \
		echo "  Password: password"; \
		echo ""; \
		echo "Applications:"; \
		kubectl --context $(KUBECTL_CONTEXT) get applications -n argocd --no-headers 2>/dev/null | \
			awk '{printf "  %-30s %-10s %s\n", $$1, $$6, $$7}' || \
			echo "  No applications found"; \
	else \
		echo -e "$(YELLOW)ArgoCD not installed$(NC)"; \
	fi

# Help text
help:
	@echo "cdk8s-project GitOps Setup"
	@echo ""
	@echo "$(GREEN)Setup Commands:$(NC)"
	@echo "  all                       - Complete setup (deploy + status)"
	@echo "  deploy                    - Deploy core infrastructure"
	@echo "  gitops-setup              - Simplified GitOps deployment"
	@echo "  fresh                     - Clean and redeploy (preserves Azure)"
	@echo ""
	@echo "$(GREEN)AKS-Specific Commands:$(NC)"
	@echo "  create-aks-cluster        - Create new AKS cluster (requires CLUSTER_NAME)"
	@echo "  deploy-aks                - Create AKS cluster and run full setup"
	@echo ""
	@echo "$(GREEN)Individual Components:$(NC)"
	@echo "  azure-infra               - Setup Azure resources"
	@echo "  k8s-cluster               - Create/connect Kubernetes cluster"
	@echo "  workload-identity-setup   - Configure workload identity"
	@echo "  post-argocd-workload-identity - Create SAs for ArgoCD-created namespaces"
	@echo "  validate-workload-identity - Check federated credentials"
	@echo ""
	@echo "$(GREEN)Cleanup Commands:$(NC)"
	@echo "  clean                     - Remove everything"
	@echo "  clean-k8s                 - Remove Kubernetes cluster only"
	@echo "  clean-azure               - Remove Azure resources (careful!)"
	@echo ""
	@echo "$(GREEN)Status Commands:$(NC)"
	@echo "  status                    - Show cluster and app status"
	@echo "  help                      - Show this help message"
	@echo ""
	@echo "$(GREEN)Environment Variables:$(NC)"
	@echo "  CLUSTER=<name>            - Override cluster detection"
	@echo "  SKIP_DEPS=1               - Skip dependency validation"
	@echo ""
	@echo "$(GREEN)AKS Examples:$(NC)"
	@echo "  make deploy-aks CLUSTER_NAME=production    # Creates RG 'production'"
	@echo "  make deploy-aks CLUSTER_NAME=prod RESOURCE_GROUP=rg6  # Uses RG 'rg6'"

# ============================================================================
# Hidden/Internal Targets
# ============================================================================

$(TMP_DIR):
	@mkdir -p $(TMP_DIR)