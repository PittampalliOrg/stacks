// CDK8s Main Application - Last updated: 2025-07-06
// Recent changes: Kargo moved to platform project for RBAC permissions
import { App, YamlOutputType } from 'cdk8s';
import { InfraSecretsChart } from './charts/infra-secrets-chart';
import { AllSecretsChart } from './charts/all-secrets-chart';
import { BackstageCatalogChart } from './lib/backstage-catalog-chart';
import { VClusterApplicationSetChart } from './charts/vcluster-applicationset-chart';
// import { CrossplaneChart } from './charts/crossplane-chart-refactored'; // DEPRECATED: Removing Crossplane
import { PlatformCoreChart } from './charts/platform-core-chart';
import { PlatformPrerequisitesChart } from './charts/platform-prerequisites-chart';
// import { GitHubAuthChart } from './charts/github-auth-chart'; // File doesn't exist
import { MonitoringHelmAppChart } from './charts/applications/observability/monitoring-helm-app-chart';
import { InfrastructureAppsChart } from './charts/infrastructure-apps-chart';
import { CriticalInfraChart } from './charts/critical-infra-chart';
import { ArgoWorkflowsUiChart } from './charts/argo-workflows-ui-chart';
import { ArgoWorkflowsIngressChart } from './charts/argo-workflows-ingress-chart';
import { DaggerInfraChart } from './charts/dagger-infra-chart';
import { ArgoWorkflowTemplatesChart } from './charts/argo-workflow-templates-chart';
import { AlloyChart } from './charts/alloy-chart';
import { GrafanaSetupChart } from './charts/grafana-setup-chart';
import { PrometheusChart } from './charts/prometheus-chart';
import { PostgresChart } from './charts/postgres-chart';
import { RedisChart } from './charts/redis-chart';
import { NextJsChart } from './charts/nextjs-chart';
import { AppStackSecretsChart } from './charts/app-stack-secrets-chart';
import { NextJsFeatureFlagsChart } from './charts/nextjs-feature-flags-chart';
import { KargoChart } from './charts/kargo-chart';
// import { KargoPipelineChart } from './charts/kargo-pipeline-chart'; // DEPRECATED: Using 4 separate pipelines
import { KargoNextjsPipelineChart } from './charts/kargo-nextjs-pipeline-chart';
import { KargoBackstagePipelineChart } from './charts/kargo-backstage-pipeline-chart';
import { KargoFlagdUiPipelineChart } from './charts/kargo-flagd-ui-pipeline-chart';
import { KargoClaudeCodeUiPipelineChart } from './charts/kargo-claudecodeui-pipeline-chart';
import { KargoPipelinesProjectChart } from './charts/kargo-pipelines-project-chart';
import { KargoPipelinesCredentialsChart } from './charts/kargo-pipelines-credentials-chart';
import { KargoWebhookConfigChart } from './charts/kargo-webhook-config';
import { HubbleUIChart } from './charts/hubble-ui-chart';
// import { McpInspectorUiChart } from './charts/mcp-inspector-ui-chart'; // DEPRECATED: Using Docker chart instead
// import { KagentArgoCDAppChart } from './charts/kagent-argocd-app-chart'; // File doesn't exist
import { KagentCoreChart } from './charts/kagent-core-chart';
import { KagentIngressChart } from './charts/kagent-ingress-chart';
import { KagentAgentsChart } from './charts/kagent-agents-chart';
import { KagentModelsChart } from './charts/kagent-models-chart';
// import { KagentDefaultModelConfigChart } from './charts/kagent-default-modelconfig-chart'; // REMOVED: Managed by Helm chart
// import { KagentToolServersChart } from './charts/kagent-toolservers-chart'; // DEPRECATED: Using KGateway instead
// import { KGatewayChart } from './charts/kgateway-chart'; // File doesn't exist
// import { KGatewayResourcesChart } from './charts/kgateway-resources-chart'; // DEPRECATED
import { KGatewayMCPServersChart } from './charts/kgateway-mcp-servers-chart';
import { KGatewayMCPGatewayChart } from './charts/kgateway-mcp-gateway-chart';
import { KGatewayMCPRoutesChart } from './charts/kgateway-mcp-routes-chart';
import { KGatewayKagentToolServersChart } from './charts/kgateway-kagent-toolservers-chart';
import { MCPTestServersChart } from './charts/mcp-test-servers-chart';
import { MCPTextToolsChart } from './charts/mcp-text-tools-chart';
import { MCPEchoServerChart } from './charts/mcp-echo-server-chart';
import { Context7MCPServerChart } from './charts/context7-mcp-server-chart';
import { KGatewayAlloyObservabilityChart } from './charts/kgateway-alloy-observability-chart';
import { HttpbinChart } from './charts/httpbin-chart';
import { KGatewayHTTPGatewayChart } from './charts/kgateway-http-gateway-chart';
import { KGatewayGrafanaDashboardsChart } from './charts/kgateway-grafana-dashboards-chart';
import { KGatewayObservabilityChart } from './charts/kgateway-observability-chart';
import { OpenFeatureConfigChart } from './charts/openfeature-config-chart';
import { FlagdUiChart } from './charts/flagd-ui-chart';
import { FlagdUiNextJsChart } from './charts/flagd-ui-nextjs-chart';
import { FlagdServiceChart } from './charts/flagd-service-chart';
import { ClaudeCodeUIChart } from './charts/claudecodeui-chart';
import { FeatureFlagsDemoChart } from './charts/feature-flags-demo-chart';
// import { McpInspectorChart } from './charts/mcp-inspector-chart'; // DEPRECATED: Using Docker chart instead
import { McpInspectorDockerChart } from './charts/mcp-inspector-docker-chart';
// import { AgentGatewayChart } from './charts/agent-gateway-chart'; // DEPRECATED: Using KGateway instead
// import { FetchMcpServerChart } from './charts/fetch-mcp-server-chart'; // DEPRECATED: Using KGateway instead
// import { WebScrapingAgentChart } from './charts/web-scraping-agent-chart'; // DEPRECATED: Using KGateway instead
import { EnvironmentResolver } from './lib/environment-resolver';
// import { BootstrapPresyncChart } from './charts/bootstrap-presync-chart'; // File doesn't exist
import { CrdProvidersChart } from './charts/crd-providers-chart';
import { ArgoCDConfigChart } from './charts/argocd-config-chart';
import { ArgoCDWebhookConfigChart } from './charts/argocd-webhook-config';
import { BootstrapSecretsChart } from './charts/bootstrap-secrets-chart';
import { CertManagerIssuersChart } from './charts/cert-manager-issuers-chart';
// import { ArgoCDSyncFixesChart } from './charts/argocd-sync-fixes'; // REMOVED: File deleted, fixes applied directly in app definitions

// Import application charts for App of Apps pattern
import { AppProjectsChart } from './charts/applications/app-projects-chart';

// Platform foundation apps
import { PlatformSecretsAppChart } from './charts/applications/platform/platform-secrets-app-chart';
import { PlatformRbacAppChart } from './charts/applications/platform/platform-rbac-app-chart';
import { PlatformConfigAppChart } from './charts/applications/platform/platform-config-app-chart';
import { FlagdPlatformAppChart } from './charts/applications/platform/flagd-platform-app-chart';
import { InfraSecretsAppChart } from './charts/applications/platform/infra-secrets-app-chart';
import { AppStackSecretsAppChart } from './charts/applications/platform/app-stack-secrets-app-chart';
import { ArgoCDConfigAppChart } from './charts/applications/platform/argocd-config-app-chart';
import { ArgoCDWebhookConfigAppChart } from './charts/applications/platform/argocd-webhook-config-app-chart';
import { BootstrapSecretsAppChart } from './charts/applications/platform/bootstrap-secrets-app-chart';
import { InfrastructureAppsAppChart } from './charts/applications/platform/infrastructure-apps-app-chart';
import { HttpbinAppChart } from './charts/applications/platform/httpbin-app-chart';
import { KGatewayHTTPGatewayAppChart } from './charts/applications/platform/kgateway-http-gateway-app-chart';
import { BackstageAppChart } from './charts/applications/platform/backstage-app-chart';
import { BackstageSecretsAppChart } from './charts/applications/platform/backstage-secrets-app-chart';
import { BackstageChart } from './charts/backstage-chart';
import { BackstageSecretsChart } from './charts/backstage-secrets-chart';
import { HeadlampSecretsChart } from './charts/headlamp-secrets-chart';
import { K8sDependencyTrackerChart } from './charts/k8s-dependency-tracker-chart';
import { K8sDependencyTrackerDeploymentChart } from './charts/k8s-dependency-tracker-deployment-chart';
import { K8sDependencyTrackerAppChart } from './charts/applications/platform/k8s-dependency-tracker-app-chart';

// CRD Provider apps 
import { CertManagerAppChart } from './charts/applications/platform/cert-manager-app-chart';
import { CertManagerIssuersAppChart } from './charts/applications/platform/cert-manager-issuers-app-chart';
import { GatewayApiAppChart } from './charts/applications/platform/gateway-api-app-chart';
import { OpenFeatureOperatorAppChart } from './charts/applications/platform/openfeature-operator-app-chart';
import { ArgoWorkflowsCrdsAppChart } from './charts/applications/platform/argo-workflows-crds-app-chart';

// Application stack apps
import { PostgresAppChart } from './charts/applications/apps/postgres-app-chart';
import { RedisAppChart } from './charts/applications/apps/redis-app-chart';
import { NextJsAppChart } from './charts/applications/apps/nextjs-app-chart';
import { ClaudeCodeUIAppChart } from './charts/applications/apps/claudecodeui-app-chart';
import { FeatureFlagsAppChart } from './charts/applications/apps/feature-flags-app-chart';

// Developer tools apps
import { ArgoWorkflowsAppChart } from './charts/applications/devtools/argo-workflows-app-chart';
import { VClusterAppChart } from './charts/applications/devtools/vcluster-app-chart';
import { KargoAppChart } from './charts/applications/devtools/kargo-app-chart';
import { KargoHelmAppChart } from './charts/applications/devtools/kargo-helm-app-chart';
import { KargoIngressAppChart } from './charts/applications/devtools/kargo-ingress-app-chart';
import { KargoPipelineAppChart } from './charts/applications/devtools/kargo-pipeline-app-chart';
import { KargoNextjsPipelineAppChart } from './charts/applications/devtools/kargo-nextjs-pipeline-app-chart';
import { KargoBackstagePipelineAppChart } from './charts/applications/devtools/kargo-backstage-pipeline-app-chart';
import { KargoFlagdUiPipelineAppChart } from './charts/applications/devtools/kargo-flagd-ui-pipeline-app-chart';
import { KargoClaudeCodeUiPipelineAppChart } from './charts/applications/devtools/kargo-claudecodeui-pipeline-app-chart';
import { KargoPipelinesProjectAppChart } from './charts/applications/devtools/kargo-pipelines-project-app-chart';
import { KargoPipelinesCredentialsAppChart } from './charts/applications/devtools/kargo-pipelines-credentials-app-chart';
import { KargoWebhookConfigAppChart } from './charts/applications/devtools/kargo-webhook-config-app-chart';
import { ArgoRolloutsHelmAppChart } from './charts/applications/devtools/argo-rollouts-helm-app-chart';
import { HeadlampAppChart } from './charts/applications/devtools/headlamp-app-chart';

// Observability stack apps
import { MonitoringInfraAppChart } from './charts/applications/observability/monitoring-infra-app-chart';
import { GrafanaAppChart } from './charts/applications/observability/grafana-app-chart';
import { AlloyAppChart } from './charts/applications/observability/alloy-app-chart';
import { PrometheusAppChart } from './charts/applications/observability/prometheus-app-chart';
import { KGatewayObservabilityAppChart } from './charts/applications/observability/kgateway-observability-app-chart';
import { HeadlampSecretsAppChart } from './charts/applications/observability/headlamp-secrets-app-chart';

// AI platform apps
import { KagentHelmAppChart } from './charts/applications/ai/kagent-helm-app-chart';
import { KagentCoreAppChart } from './charts/applications/ai/kagent-core-app-chart';
import { KagentConfigAppChart } from './charts/applications/ai/kagent-config-app-chart';
// import { KagentDefaultModelConfigAppChart } from './charts/applications/ai/kagent-default-modelconfig-app-chart'; // REMOVED: Managed by Helm chart
import { KagentAgentsAppChart } from './charts/applications/ai/kagent-agents-app-chart';
import { KagentToolServersAppChart } from './charts/applications/ai/kagent-toolservers-app-chart';
import { McpGatewayAppChart } from './charts/applications/ai/mcp-gateway-app-chart';
import { McpInspectorAppChart } from './charts/applications/ai/mcp-inspector-app-chart';
import { MCPServersAppChart } from './charts/applications/ai/mcp-servers-app-chart';
import { MCPTestServersAppChart } from './charts/applications/ai/mcp-test-servers-app-chart';
import { MCPRoutesAppChart } from './charts/applications/ai/mcp-routes-app-chart';
import { MCPEchoServerAppChart } from './charts/applications/ai/mcp-echo-server-app-chart';
import { MCPTextToolsAppChart } from './charts/applications/ai/mcp-text-tools-app-chart';
import { Context7MCPServerAppChart } from './charts/applications/ai/context7-mcp-server-app-chart';

// Note: Environment variables are passed by ArgoCD with ARGOCD_ENV_ prefix
// Azure variables come from repo-server environment (via dynamic patch)

const outputDir = 'dist'; // Always use dist to satisfy CDK8s CLI

// Note: Backstage component mappings are no longer needed
// The deterministic catalog generator automatically discovers all components

// Create app with environment resolver for backward compatibility
// New charts receive config directly, old charts still use placeholders
const app = new App({
  resolvers: [
    new EnvironmentResolver(), // Still needed for charts using placeholders
    // BackstageKubernetesResolver removed - labels are added by the deterministic catalog
  ],
  // Generate one file per chart with stable naming based on chart ID
  yamlOutputType: YamlOutputType.FOLDER_PER_CHART_FILE_PER_RESOURCE,
  outdir: outputDir,
});

// Note: Removed complex CDK8S_APP logic in favor of sync waves

// Check if we're in bootstrap mode
// In bootstrap mode, the argocd-config and cdk8s-applications are created separately
// to avoid circular dependencies
const isBootstrapMode = process.env.CDK8S_BOOTSTRAP_MODE === 'true' || require('fs').existsSync('.cdk8s-bootstrap');

// Check if critical infrastructure should be included
// Critical infra (DNS, storage) is managed separately for better reliability
const includeCriticalInfra = process.env.INCLUDE_CRITICAL_INFRA === 'true';

// Log synthesis configuration
console.log(`📁 Output directory: ${outputDir}`);

if (includeCriticalInfra) {
  // Only include if explicitly requested to avoid duplication
  new CriticalInfraChart(app, 'critical-infra', {
    dnsServers: ['8.8.8.8', '8.8.4.4']
  });
}

// Phase -1: CRD Providers (must be deployed before anything else)
// These install the Custom Resource Definitions required by other resources
// DEPRECATED: CRD providers are now managed through App of Apps pattern
// const crdProviders = new CrdProvidersChart(app, 'crd-providers');


// Phase 0: Platform Prerequisites (includes DNS bootstrap, service accounts)
const platformPrereqs = new PlatformPrerequisitesChart(app, 'platform-prerequisites', {
  // Azure config will be injected via environment placeholders and resolver
});
// platformPrereqs.addDependency(crdProviders); // CRDs now managed through App of Apps

// Phase 0.5: ArgoCD Configuration
// This manages ArgoCD configuration declaratively instead of via imperative Makefile patches
const argoCDConfig = new ArgoCDConfigChart(app, 'argocd-config');
const argoCDWebhookConfig = new ArgoCDWebhookConfigChart(app, 'argocd-webhook-config');
argoCDConfig.addDependency(platformPrereqs);

// Phase 0.55: ArgoCD Sync Fixes
// Apply sync policy fixes for applications with webhook issues
// const argoCDSyncFixes = new ArgoCDSyncFixesChart(app, 'argocd-sync-fixes'); // REMOVED: Fixes applied directly in app definitions
// argoCDSyncFixes.addDependency(argoCDConfig);

// Phase 0.6: Bootstrap Secrets (GitHub repository credentials, ClusterSecretStore)
// These are required for ArgoCD to access private repositories
const bootstrapSecrets = new BootstrapSecretsChart(app, 'bootstrap-secrets');
bootstrapSecrets.addDependency(argoCDConfig);

// Phase 1: Platform Core (namespaces, configmaps, RBAC)
const platformCore = new PlatformCoreChart(app, 'platform-core', {
  config: {
    branch: process.env.GIT_BRANCH || 'master',
    environment: process.env.ENVIRONMENT || 'dev'
  }
});
platformCore.addDependency(bootstrapSecrets);

// Phase 1.5: Infrastructure Apps (NGINX Ingress Controller, etc.)
// This must be deployed before any ingress resources are created
const infrastructureApps = new InfrastructureAppsChart(app, 'infrastructure-apps');
infrastructureApps.addDependency(platformCore);

// Cert-manager ClusterIssuers (after platform core)
// These provide Let's Encrypt certificate issuers for TLS
const certManagerIssuers = new CertManagerIssuersChart(app, 'cert-manager-issuers');
certManagerIssuers.addDependency(platformCore);

// Phase 2: All Secrets (consolidated ExternalSecrets)
// This comes early to ensure secrets are available for all applications
const allSecrets = new AllSecretsChart(app, 'all-secrets');
allSecrets.addDependency(infrastructureApps);



// Phase 4: Infrastructure Applications
const infraApps = new MonitoringHelmAppChart(app, 'monitoring-helm-apps', {
  azureTenantId: process.env.AZURE_TENANT_ID || '',
  azureRegion: process.env.AZURE_REGION || 'eastus'
});


// Phase 4: GitHub Authentication
// const githubAuth = new GitHubAuthChart(app, 'github-auth', {
//   azureClientId: process.env.AZURE_CLIENT_ID || '',
//   azureTenantId: process.env.AZURE_TENANT_ID || '',
//   azureKeyVaultName: process.env.AZURE_KEYVAULT_NAME || '',
//   githubAppId: process.env.GH_APP_ID || ''
// });
// githubAuth.addDependency(infraApps);

// Phase 4.5: OpenFeature Configuration for feature flags
const openfeatureConfig = new OpenFeatureConfigChart(app, 'openfeature-config');
openfeatureConfig.addDependency(infraApps); // Depends on OpenFeature operator being deployed

// Phase 4.6: Flagd Service for centralized feature flag evaluation
const flagdService = new FlagdServiceChart(app, 'flagd-service', {
  enableServiceMonitor: false // Disable until Prometheus CRDs are installed
});
// Note: flagdService dependencies are added after the FeatureFlag charts are created

// Phase 4.7: Flagd UI for feature flag management (Simple HTML version)
// const flagdUi = new FlagdUiChart(app, 'flagd-ui');
// flagdUi.addDependency(flagdService); // Depends on flagd service

// Phase 4.8: Flagd UI Next.js for feature flag management
// Moved to NextJS mode - not part of platform infrastructure
// const flagdUiNextJs = new FlagdUiNextJsChart(app, 'flagd-ui-nextjs', { namespace: 'nextjs' });
// flagdUiNextJs.addDependency(flagdService); // Depends on flagd service

// Phase 4.9: Feature Flags Demo Configuration
const featureFlagsDemo = new FeatureFlagsDemoChart(app, 'feature-flags-demo');
featureFlagsDemo.addDependency(infraApps); // Depends on OpenFeature operator being deployed

// Phase 5: Crossplane for infrastructure management
// DEPRECATED: Removing Crossplane due to issues
// const crossplane = new CrossplaneChart(app, 'crossplane');
// crossplane.addDependency(platformCore);

// Phase 6: Infrastructure secrets (GitHub auth, ACR, etc.)
const infraSecrets = new InfraSecretsChart(app, 'infra-secrets');
infraSecrets.addDependency(infraApps); // Changed from githubAuth which doesn't exist

// Phase 7: vCluster ApplicationSet (creates vClusters dynamically)
const vclusterApplicationSet = new VClusterApplicationSetChart(app, 'vcluster-applicationset', {
  branch: process.env.GIT_BRANCH || 'master',
  argocdNamespace: 'argocd'
});
vclusterApplicationSet.addDependency(platformCore);
vclusterApplicationSet.addDependency(allSecrets); // Use consolidated secrets

// Phase 8: Argo Workflows UI (NodePort service for UI access)
const argoWorkflowsUi = new ArgoWorkflowsUiChart(app, 'argo-workflows-ui');
argoWorkflowsUi.addDependency(platformCore);

// Phase 8.1: Argo Workflows Ingress
const argoWorkflowsIngress = new ArgoWorkflowsIngressChart(app, 'argo-workflows-ingress');
argoWorkflowsIngress.addDependency(platformCore);
argoWorkflowsIngress.addDependency(infrastructureApps); // Needs NGINX ingress controller

// Phase 9: Dagger Infrastructure (RBAC for Dagger workflows)
const daggerInfra = new DaggerInfraChart(app, 'dagger-infra');
daggerInfra.addDependency(platformCore);

// Phase 10: Argo Workflow Templates (reusable workflow definitions)
const argoWorkflowTemplates = new ArgoWorkflowTemplatesChart(app, 'argo-workflow-templates');
argoWorkflowTemplates.addDependency(argoWorkflowsUi);

// Phase 11: Monitoring UI Services (Alloy, Grafana UI, Prometheus)
// Note: Monitoring stack (Grafana, Loki, Tempo) is deployed via InfrastructureAppsChart
const alloy = new AlloyChart(app, 'alloy');
alloy.addDependency(infraApps);

// Phase 11.0.5: Prometheus Metrics Storage
const prometheus = new PrometheusChart(app, 'prometheus');
prometheus.addDependency(infraApps); // Needs namespace and RBAC

// Phase 11.1: KGateway Observability Integration
const kgatewayObservability = new KGatewayObservabilityChart(app, 'kgateway-observability');
kgatewayObservability.addDependency(platformCore); // Depends on kgateway being deployed

const kgatewayAlloyObservability = new KGatewayAlloyObservabilityChart(app, 'kgateway-alloy-observability');
kgatewayAlloyObservability.addDependency(alloy);

// Phase 11.2: KGateway Grafana Dashboards
const kgatewayDashboards = new KGatewayGrafanaDashboardsChart(app, 'kgateway-grafana-dashboards');
kgatewayDashboards.addDependency(infraApps); // Depends on Grafana being deployed via Helm

// Phase 11.5: Grafana Setup (API Token Creation)
const grafanaSetup = new GrafanaSetupChart(app, 'grafana-setup');
grafanaSetup.addDependency(infraApps); // Depends on infrastructure apps (includes Grafana)
grafanaSetup.addDependency(infraApps); // Needs external-secrets for KeyVault access

// Phase 11.6: Kargo (GitOps Promotion Engine)
// Note: Kargo Helm deployment is handled via InfrastructureAppsChart
const kargo = new KargoChart(app, 'kargo');
kargo.addDependency(infraApps);

// Phase 11.7: Hubble UI (Cilium Network Observability)
const hubbleUi = new HubbleUIChart(app, 'hubble-ui');
hubbleUi.addDependency(platformCore);

// Phase 11.8: Headlamp Secrets (Azure AD Authentication)
const headlampSecrets = new HeadlampSecretsChart(app, 'headlamp-secrets');
headlampSecrets.addDependency(infraSecrets); // Needs ClusterSecretStore

// Phase 11.6: Kagent AI Platform
// Deploy kagent via ArgoCD Application for better Helm chart management
// COMMENTED OUT: KagentArgoCDAppChart file doesn't exist
// const kagentApp = new KagentArgoCDAppChart(app, 'kagent-argocd-app');
// kagentApp.addDependency(infraApps); // Needs ArgoCD and External Secrets

// Phase 11.6: Kagent core deployment
const kagentCore = new KagentCoreChart(app, 'kagent-core');
kagentCore.addDependency(infraApps); // Needs External Secrets for OpenAI key

const kagentIngress = new KagentIngressChart(app, 'kagent-ingress');
kagentIngress.addDependency(platformCore); // Ingress depends on namespace existing

// Phase 11.7: Kagent Model Configurations
// Deploy different AI model configurations for kagent
const kagentModels = new KagentModelsChart(app, 'kagent-models');
kagentModels.addDependency(kagentCore); // Models depend on kagent and external secrets

// Phase 11.8: Kagent Default Model Config
// REMOVED: Now managed by Kagent Helm chart to avoid conflicts

// Phase 11.9: Kagent Custom Agents
// Deploy custom AI agents for specific use cases
const kagentAgents = new KagentAgentsChart(app, 'kagent-agents');
kagentAgents.addDependency(kagentModels); // Agents depend on models being configured

// Phase 11.9: KGateway (Enterprise MCP Gateway)
// Provides enterprise-grade Model Context Protocol (MCP) gateway with security and observability
// COMMENTED OUT: KGatewayChart file doesn't exist
// const kgateway = new KGatewayChart(app, 'kgateway');
// kgateway.addDependency(platformCore);
// kgateway.addDependency(infraApps); // Needs Gateway API CRDs

// Phase 11.10: KGateway MCP Servers
// Deploy MCP servers configured for KGateway
const kgatewayMcpServers = new KGatewayMCPServersChart(app, 'kgateway-mcp-servers');
// kgatewayMcpServers.addDependency(kgateway); // COMMENTED: kgateway doesn't exist
kgatewayMcpServers.addDependency(infraApps); // Needs GitHub token from external secrets

// Phase 11.10.1: KGateway MCP Gateway
// Create Gateway API resources for proper MCP routing through kgateway
const kgatewayMcpGateway = new KGatewayMCPGatewayChart(app, 'kgateway-mcp-gateway');
// kgatewayMcpGateway.addDependency(kgateway); // Needs kgateway controller - COMMENTED: kgateway doesn't exist
kgatewayMcpGateway.addDependency(kgatewayMcpServers); // Routes to MCP servers

// Phase 11.10.2: KGateway MCP Routes
// Create HTTPRoute resources for routing to MCP servers
const kgatewayMcpRoutes = new KGatewayMCPRoutesChart(app, 'kgateway-mcp-routes');
kgatewayMcpRoutes.addDependency(kgatewayMcpGateway); // Needs Gateway to be created first
kgatewayMcpRoutes.addDependency(kgatewayMcpServers); // Routes to MCP servers

// Phase 11.11: Kagent Tool Servers (KGateway Integration)
// Configure external tool servers for kagent agents via KGateway
const kgatewayKagentToolServers = new KGatewayKagentToolServersChart(app, 'kgateway-kagent-toolservers');
kgatewayKagentToolServers.addDependency(kagentCore); // Depends on Kagent CRDs
kgatewayKagentToolServers.addDependency(kgatewayMcpServers); // Depends on KGateway MCP servers

// Phase 11.11.1: MCP Test Servers
// Deploy test MCP servers (Everything and Time) for validation
const mcpTestServers = new MCPTestServersChart(app, 'mcp-test-servers');
mcpTestServers.addDependency(kgatewayMcpServers); // Deploy alongside other MCP servers

// Phase 11.11.1a: TypeScript MCP Echo Server
// Replace Python echo server with TypeScript implementation
const mcpEchoServer = new MCPEchoServerChart(app, 'mcp-echo-server');
mcpEchoServer.addDependency(kgatewayMcpServers); // Deploy alongside other MCP servers

// Phase 11.11.1b: TypeScript MCP Text Tools Server
// Deploy MCP server with text manipulation tools
const mcpTextTools = new MCPTextToolsChart(app, 'mcp-text-tools');
mcpTextTools.addDependency(kgatewayMcpServers); // Deploy alongside other MCP servers

// Phase 11.11.1c: Context-7 MCP Server
// Deploy Context-7 documentation retrieval server
const context7McpServer = new Context7MCPServerChart(app, 'context7-mcp-server');
context7McpServer.addDependency(kgatewayMcpServers); // Deploy alongside other MCP servers


// NOTE: Removed kubernetes-mcp, notion-mcp, and playwright-mcp servers
// These are CLI-based tools that don't support HTTP transport required by Kagent
// Only MCP servers with HTTP transport support (like context7) will work

// Phase 11.11.2: HTTP Gateway for Testing
// Create a simple HTTP gateway following kgateway documentation
const kgatewayHttpGateway = new KGatewayHTTPGatewayChart(app, 'kgateway-http-gateway');
kgatewayHttpGateway.addDependency(platformCore); // Needs Gateway API CRDs

// Phase 11.11.3: Httpbin Test Application
// Deploy httpbin for testing gateway functionality
const httpbin = new HttpbinChart(app, 'httpbin');
httpbin.addDependency(kgatewayHttpGateway); // Needs HTTP gateway to be created first

// Phase 11.12: Agent Gateway (SSE MCP Server wrapper) - DEPRECATED: Using KGateway instead
// Provides SSE wrapper for stdio-based MCP servers
// const agentGateway = new AgentGatewayChart(app, 'agent-gateway');
// agentGateway.addDependency(platformCore);
// agentGateway.addDependency(infraApps); // Needs GitHub token from external secrets

// Phase 11.13: Kagent Tool Servers (Agent Gateway Integration) - DEPRECATED: Using KGateway instead
// Configure tool servers for kagent agents via agent-gateway
// const kagentToolServers = new KagentToolServersChart(app, 'kagent-toolservers');
// kagentToolServers.addDependency(agentGateway); // Depends on agent-gateway deployments
// kagentToolServers.addDependency(kagentResources); // Depends on kagent CRDs

// Phase 11.14: Fetch MCP Server - DEPRECATED: Using KGateway instead
// Provides web fetching capabilities via MCP
// const fetchMcpServer = new FetchMcpServerChart(app, 'fetch-mcp-server');
// fetchMcpServer.addDependency(agentGateway);
// fetchMcpServer.addDependency(kagentResources); // Needs kagent CRDs for toolserver

// Phase 11.15: Web Scraping Agent - DEPRECATED: Using KGateway instead
// AI agent specialized in web scraping and data extraction
// const webScrapingAgent = new WebScrapingAgentChart(app, 'web-scraping-agent');
// webScrapingAgent.addDependency(fetchMcpServer); // Depends on fetch MCP tools
// webScrapingAgent.addDependency(kagentModels); // Depends on models being configured

// Phase 11.16: KGateway Resources (Gateway API resources) - DEPRECATED
// Not using kgateway MCP gateway functionality due to implementation issues
// const kgatewayResources = new KGatewayResourcesChart(app, 'kgateway-resources');
// Note: Dependencies are managed at the ArgoCD Application level in infrastructure-apps-chart.ts
// The kgateway-resources Application depends on the kgateway Application being healthy

// Phase 11.17: MCP Inspector (Visual debugging tool for MCP servers)
// Provides an interactive UI for testing and debugging MCP servers
// Using Docker version for better configuration options
const mcpInspector = new McpInspectorDockerChart(app, 'mcp-inspector');
mcpInspector.addDependency(platformCore); // Needs namespaces
mcpInspector.addDependency(kgatewayMcpServers); // Can connect to MCP servers

// Phase 11.18: MCP Inspector UI - REMOVED (Docker chart includes ingress)
// const mcpInspectorUi = new McpInspectorUiChart(app, 'mcp-inspector-ui');
// mcpInspectorUi.addDependency(mcpInspector); // Depends on MCP Inspector deployment

// Phase 12: Application Stack Secrets
const appStackSecrets = new AppStackSecretsChart(app, 'app-stack-secrets');
appStackSecrets.addDependency(infraSecrets); // Needs ClusterSecretStore

// Phase 12.1: Application Infrastructure (Postgres, Redis)
const postgres = new PostgresChart(app, 'postgres');
postgres.addDependency(appStackSecrets); // Now depends on app-stack-secrets instead of infraSecrets

const redis = new RedisChart(app, 'redis');
redis.addDependency(infraSecrets);

// Phase 12.05: Backstage Secrets
const backstageSecrets = new BackstageSecretsChart(app, 'backstage-secrets');
backstageSecrets.addDependency(infraSecrets); // Needs ClusterSecretStore

// Phase 12.1: Backstage Developer Portal
// Provides a unified interface for accessing all platform services
const backstage = new BackstageChart(app, 'backstage');
backstage.addDependency(postgres); // Needs PostgreSQL for data storage
backstage.addDependency(bootstrapSecrets); // Needs GitHub token for catalog
backstage.addDependency(backstageSecrets); // Needs auth and ArgoCD secrets

// Phase 12.2: Kubernetes Dependency Tracker
// Provides backend API for tracking Kubernetes resource dependencies for Backstage
const k8sDependencyTracker = new K8sDependencyTrackerChart(app, 'k8s-dependency-tracker');
k8sDependencyTracker.addDependency(infrastructureApps); // Needs NGINX ingress controller
k8sDependencyTracker.addDependency(platformCore); // Needs namespaces and RBAC

// Phase 12.3: Kubernetes Dependency Tracker Deployment (Alternative to Helm)
// Direct deployment since OCI registry requires authentication
const k8sDependencyTrackerDeployment = new K8sDependencyTrackerDeploymentChart(app, 'k8s-dependency-tracker-deployment');
k8sDependencyTrackerDeployment.addDependency(infrastructureApps); // Needs NGINX ingress controller
k8sDependencyTrackerDeployment.addDependency(platformCore); // Needs namespaces and RBAC

// Phase 13: NextJS Application
const nextjs = new NextJsChart(app, 'nextjs', {
  infraSecrets: infraSecrets
});
nextjs.addDependency(postgres);
nextjs.addDependency(redis);

// Phase 13.1: NextJS Feature Flags
const nextjsFeatureFlags = new NextJsFeatureFlagsChart(app, 'nextjs-feature-flags');
nextjsFeatureFlags.addDependency(nextjs);
nextjsFeatureFlags.addDependency(infraApps); // Depends on OpenFeature operator being deployed

// Phase 13.1.5: Claude Code UI
const claudecodeui = new ClaudeCodeUIChart(app, 'claudecodeui');
claudecodeui.addDependency(platformCore);

// Phase 13.2: Flagd UI for NextJS namespace
const flagdUiNextJs = new FlagdUiNextJsChart(app, 'flagd-ui-nextjs', { namespace: 'nextjs' });
flagdUiNextJs.addDependency(flagdService); // Depends on platform flagd service

// Phase 14: Kargo Pipelines - Central project and 4 independent pipelines
// 14.0: Central Kargo Project
const kargoPipelinesProject = new KargoPipelinesProjectChart(app, 'kargo-pipelines-project');
kargoPipelinesProject.addDependency(kargo); // Depends on Kargo being installed

// 14.0.1: Kargo Pipelines Credentials
const kargoPipelinesCredentials = new KargoPipelinesCredentialsChart(app, 'kargo-pipelines-credentials');
kargoPipelinesCredentials.addDependency(kargoPipelinesProject); // Depends on namespace existing
kargoPipelinesCredentials.addDependency(allSecrets); // Depends on AllSecrets for ClusterSecretStore

// 14.1: Next.js Pipeline
const kargoNextjsPipeline = new KargoNextjsPipelineChart(app, 'kargo-nextjs-pipeline', {
  gitBranch: process.env.GIT_BRANCH || 'app',
  githubRepo: 'https://github.com/PittampalliOrg/cdk8s-project.git'
});
kargoNextjsPipeline.addDependency(kargoPipelinesCredentials); // Depends on credentials being created
kargoNextjsPipeline.addDependency(allSecrets); // Needs GitHub credentials

// 14.2: Backstage Pipeline
const kargoBackstagePipeline = new KargoBackstagePipelineChart(app, 'kargo-backstage-pipeline', {
  gitBranch: process.env.GIT_BRANCH || 'app',
  githubRepo: 'https://github.com/PittampalliOrg/cdk8s-project.git'
});
kargoBackstagePipeline.addDependency(kargoPipelinesCredentials); // Depends on credentials being created
kargoBackstagePipeline.addDependency(allSecrets); // Needs GitHub credentials

// 14.3: Flagd UI Pipeline
const kargoFlagdUiPipeline = new KargoFlagdUiPipelineChart(app, 'kargo-flagd-ui-pipeline', {
  gitBranch: process.env.GIT_BRANCH || 'app',
  acrRegistry: 'vpittamp.azurecr.io',
  githubRepo: 'https://github.com/PittampalliOrg/cdk8s-project.git'
});
kargoFlagdUiPipeline.addDependency(kargoPipelinesCredentials); // Depends on credentials being created
kargoFlagdUiPipeline.addDependency(allSecrets); // Needs ACR credentials

// 14.4: Claude Code UI Pipeline
const kargoClaudeCodeUiPipeline = new KargoClaudeCodeUiPipelineChart(app, 'kargo-claudecodeui-pipeline', {
  gitBranch: process.env.GIT_BRANCH || 'app',
  acrRegistry: 'vpittamp.azurecr.io',
  githubRepo: 'https://github.com/PittampalliOrg/cdk8s-project.git'
});
kargoClaudeCodeUiPipeline.addDependency(kargoPipelinesCredentials); // Depends on credentials being created
kargoClaudeCodeUiPipeline.addDependency(allSecrets); // Needs ACR credentials

// Phase 14.5: Kargo Webhook Configuration for automatic freight discovery
const kargoWebhookConfig = new KargoWebhookConfigChart(app, 'kargo-webhook-config', {
  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET
});
kargoWebhookConfig.addDependency(kargoNextjsPipeline); // Depends on Kargo pipelines being configured
kargoWebhookConfig.addDependency(kargoBackstagePipeline);
kargoWebhookConfig.addDependency(kargoFlagdUiPipeline);
kargoWebhookConfig.addDependency(kargoClaudeCodeUiPipeline);

// Note: Analysis templates and webhooks removed - not part of core Kargo
// Use Kargo UI and API for monitoring pipeline status

// Note: VCluster application deployments are handled by the CDK8s plugin
// which generates all workload manifests together when syncing

// Add flagdService dependencies after all FeatureFlag charts are created
// This ensures flagd starts only after all required FeatureFlags exist
flagdService.addDependency(openfeatureConfig);     // cdk8s-env-config
flagdService.addDependency(featureFlagsDemo);      // demo-flags
flagdService.addDependency(nextjsFeatureFlags);    // nextjs-app-features

// Synthesize the resources app
app.synth();

// Now create a second app for Applications (App of Apps pattern)
console.log('\n📦 Creating ArgoCD Applications...');

// Create a separate app instance for Applications
const appOfApps = new App({
  yamlOutputType: YamlOutputType.FOLDER_PER_CHART_FILE_PER_RESOURCE,
  outdir: outputDir + '/apps',
  resolvers: [new EnvironmentResolver()]
});

// Create AppProjects first (needed for other apps)
new AppProjectsChart(appOfApps, 'app-projects');

// CRD Provider applications (sync waves -295 to -280)
new CertManagerAppChart(appOfApps, 'cert-manager-app');
new CertManagerIssuersAppChart(appOfApps, 'cert-manager-issuers-app');
new ArgoWorkflowsCrdsAppChart(appOfApps, 'argo-workflows-crds-app');
new GatewayApiAppChart(appOfApps, 'gateway-api-app');
new OpenFeatureOperatorAppChart(appOfApps, 'openfeature-operator-app');

// Platform foundation applications (sync waves -100 to -1)
new ArgoCDConfigAppChart(appOfApps, 'argocd-config-app');
new ArgoCDWebhookConfigAppChart(appOfApps, 'argocd-webhook-config-app');
new BootstrapSecretsAppChart(appOfApps, 'bootstrap-secrets-app');
new InfrastructureAppsAppChart(appOfApps, 'infrastructure-apps-app'); // NGINX ingress controller and other core infra
new PlatformSecretsAppChart(appOfApps, 'platform-secrets-app'); // Manages all-secrets for nextjs namespace
new PlatformRbacAppChart(appOfApps, 'platform-rbac-app');
new PlatformConfigAppChart(appOfApps, 'platform-config-app');
new FlagdPlatformAppChart(appOfApps, 'flagd-platform-app');
new InfraSecretsAppChart(appOfApps, 'infra-secrets-app');
new AppStackSecretsAppChart(appOfApps, 'app-stack-secrets-app');
new BackstageSecretsAppChart(appOfApps, 'backstage-secrets-app'); // Backstage auth secrets
new BackstageAppChart(appOfApps, 'backstage-app'); // Developer portal
new K8sDependencyTrackerAppChart(appOfApps, 'k8s-dependency-tracker-app'); // K8s resource dependency tracking for Backstage

// Developer tools applications (sync waves 30-90)
new ArgoWorkflowsAppChart(appOfApps, 'argo-workflows-app');
new ArgoRolloutsHelmAppChart(appOfApps, 'argo-rollouts-helm-app');
new VClusterAppChart(appOfApps, 'vcluster-app');
new KargoHelmAppChart(appOfApps, 'kargo-helm-app');
new KargoIngressAppChart(appOfApps, 'kargo-ingress-app');
new KargoAppChart(appOfApps, 'kargo-app');
// new KargoPipelineAppChart(appOfApps, 'kargo-pipeline-app'); // DEPRECATED: Using 4 separate pipelines
new KargoPipelinesProjectAppChart(appOfApps, 'kargo-pipelines-project-app');
new KargoPipelinesCredentialsAppChart(appOfApps, 'kargo-pipelines-credentials-app');
new KargoNextjsPipelineAppChart(appOfApps, 'kargo-nextjs-pipeline-app');
new KargoBackstagePipelineAppChart(appOfApps, 'kargo-backstage-pipeline-app');
new KargoFlagdUiPipelineAppChart(appOfApps, 'kargo-flagd-ui-pipeline-app');
new KargoClaudeCodeUiPipelineAppChart(appOfApps, 'kargo-claudecodeui-pipeline-app');
new KargoWebhookConfigAppChart(appOfApps, 'kargo-webhook-config-app');

// Observability stack applications (sync waves 40-60)
new MonitoringInfraAppChart(appOfApps, 'monitoring-infra-app');
new PrometheusAppChart(appOfApps, 'prometheus-app');
new GrafanaAppChart(appOfApps, 'grafana-app');
new AlloyAppChart(appOfApps, 'alloy-app');
new KGatewayObservabilityAppChart(appOfApps, 'kgateway-observability-app');
new HeadlampSecretsAppChart(appOfApps, 'headlamp-secrets-app');
new HeadlampAppChart(appOfApps, 'headlamp-app');

// KGateway test applications
new KGatewayHTTPGatewayAppChart(appOfApps, 'kgateway-http-gateway-app');
new HttpbinAppChart(appOfApps, 'httpbin-app');

// AI platform applications (sync waves 70-85)
// Kagent deployment with customizations
new KagentHelmAppChart(appOfApps, 'kagent-helm-app');
new KagentCoreAppChart(appOfApps, 'kagent-core-app');
new KagentConfigAppChart(appOfApps, 'kagent-config-app');
// new KagentDefaultModelConfigAppChart(appOfApps, 'kagent-default-modelconfig-app'); // REMOVED: Managed by Helm chart
new KagentAgentsAppChart(appOfApps, 'kagent-agents-app');
new KagentToolServersAppChart(appOfApps, 'kagent-toolservers-app');
new McpGatewayAppChart(appOfApps, 'mcp-gateway-app');
new MCPServersAppChart(appOfApps, 'mcp-servers-app');
new MCPTestServersAppChart(appOfApps, 'mcp-test-servers-app');
new MCPEchoServerAppChart(appOfApps, 'mcp-echo-server-app');
new MCPTextToolsAppChart(appOfApps, 'mcp-text-tools-app');
new Context7MCPServerAppChart(appOfApps, 'context7-mcp-server-app');
new MCPRoutesAppChart(appOfApps, 'mcp-routes-app');
new McpInspectorAppChart(appOfApps, 'mcp-inspector-app');

// Application stack applications (sync waves 90-120)
new PostgresAppChart(appOfApps, 'postgres-app');
new RedisAppChart(appOfApps, 'redis-app');
new NextJsAppChart(appOfApps, 'nextjs-app');
new ClaudeCodeUIAppChart(appOfApps, 'claudecodeui-app');
new FeatureFlagsAppChart(appOfApps, 'feature-flags-app');

// Synthesize the applications
appOfApps.synth();

// Synthesize the main app to build the construct tree
console.log('\n🔨 Synthesizing main application...');
app.synth();

// Now generate the Backstage catalog from the synthesized app
console.log('\n📚 Generating Backstage catalog...');
const catalogApp = new App({
  outdir: outputDir + '/backstage-catalog',
  yamlOutputType: YamlOutputType.FILE_PER_CHART,
});

// Create the Backstage catalog using deterministic mode
// Everything is automatically discovered from the construct tree!
const catalogChart = new BackstageCatalogChart(catalogApp, 'backstage-catalog', {
  mainApp: app, // Pass the main app for full construct tree access
  // Configuration is loaded automatically from backstage-catalog-config.json
  // No need to manually specify:
  // - chartMappings
  // - crdClasses
  // - customCrdConfigs
  // - additionalComponents
});

// Note: External resources will be discovered if they're referenced in the construct tree
// If you need to add truly external resources (not in K8s), you can still use:
// catalogChart.addExternalResource('postgres-database', 'Neon PostgreSQL database for applications', 'database');

// Synthesize the catalog
catalogApp.synth();

// Post-synthesis validation
console.log('\nRunning post-synthesis validation...');
try {
  const fs = require('fs');
  const resourcesDir = outputDir;
  const appsDir = outputDir + '/apps';
  
  if (fs.existsSync(resourcesDir)) {
    console.log('✅ Resources synthesis completed successfully');
    console.log(`📁 Resources directory: ${resourcesDir}`);
  }
  
  if (fs.existsSync(appsDir)) {
    console.log('✅ Applications synthesis completed successfully');
    console.log(`📁 Applications directory: ${appsDir}`);
    
    // Count synthesized applications
    const appFiles = fs.readdirSync(appsDir, { recursive: true })
      .filter((file: string) => file.endsWith('.yaml'));
    console.log(`📊 Total Application files: ${appFiles.length}`);
  }
  
  const catalogDir = outputDir + '/backstage-catalog';
  if (fs.existsSync(catalogDir)) {
    console.log('✅ Backstage catalog synthesis completed successfully');
    console.log(`📁 Catalog directory: ${catalogDir}`);
    
    // Show catalog file
    const catalogFiles = fs.readdirSync(catalogDir)
      .filter((file: string) => file.endsWith('.yaml'));
    if (catalogFiles.length > 0) {
      console.log(`📋 Catalog file: ${catalogFiles[0]}`);
      console.log('💡 To use: Register the catalog at https://github.com/PittampalliOrg/cdk8s-project/blob/app/dist/backstage-catalog/backstage-catalog.k8s.yaml');
    }
  }
} catch (error) {
  console.error('❌ Post-synthesis validation failed:', error);
  process.exit(1);
}
