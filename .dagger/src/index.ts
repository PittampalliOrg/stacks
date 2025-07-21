/**
 * CDK8s Synthesis Module for Dagger
 * 
 * This module provides functions to synthesize CDK8s TypeScript code into Kubernetes YAML manifests.
 * It accepts environment variables as function parameters from GitHub Actions.
 * No local .env files are used - all configuration comes from the CI/CD environment.
 */
import { dag, Directory, File, object, func } from "@dagger.io/dagger"
import { getConfigFromFeatureFlags } from "./openfeature-provider"

@object()
export class Cluster {
  /**
   * Synthesize CDK8s manifests using environment file
   * 
   * @param source The source directory containing the CDK8s project
   * @param environment Target environment (dev, staging, prod)
   * @param envFile Environment file containing all configuration variables
   * @returns Directory containing synthesized YAML files
   */
  @func()
  async synthesizeWithEnvFile(
    source: Directory,
    environment: string,
    envFile: File
  ): Promise<Directory> {
    // Create environment-specific cache volumes
    const npmCache = dag.cacheVolume(`npm-cache-${environment}`)
    const tsCache = dag.cacheVolume(`ts-build-cache-${environment}`)

    // Start with Node.js base image
    let container = dag
      .container()
      .from("node:22-alpine")
      .withWorkdir("/app")
      // Mount caches first for better layer caching
      .withMountedCache("/root/.npm", npmCache)
      .withMountedCache("/app/.tsbuild", tsCache)
      // Mount the full source directory
      .withMountedDirectory("/app", source)
      // Mount env file
      .withMountedFile("/app/.env", envFile)
      // Set the environment name explicitly
      .withEnvVariable("ENVIRONMENT", environment)
      // Force development mode to install devDependencies
      .withEnvVariable("NODE_ENV", "development")
      // Bypass CI detection to ensure devDependencies are installed
      .withEnvVariable("CI", "false")

    // Install dependencies with optimized flags
    container = await container
      .withExec(["npm", "ci", "--prefer-offline", "--no-audit", "--no-fund"])
      .sync()

    // Source the env file and synthesize CDK8s using ts-node
    // Using sh -c to source the file and export all variables
    container = await container
      .withExec([
        "sh", "-c",
        "set -a && . /app/.env && set +a && npm run synth"
      ])
      .sync()

    // Return the dist directory containing synthesized files
    return container.directory("/app/dist")
  }

  /**
   * Synthesize CDK8s manifests using environment variables
   * 
   * @param source The source directory containing the CDK8s project
   * @param environment Target environment (dev, staging, prod)
   * @param azureClientId Azure AD application ID for workload identity
   * @param azureTenantId Azure tenant ID for authentication
   * @param azureKeyvaultName Azure Key Vault name for secrets
   * @param githubAppId GitHub App ID for authentication
   * @param githubInstallationId GitHub App installation ID
   * @param logLevel Application log level
   * @param nextjsBaseUrl Base URL for Next.js application
   * @param nodeEnv Runtime environment (development/production)
   * @param otelEndpoint OpenTelemetry collector endpoint
   * @param clusterType Cluster type (kind, aks, eks, gke)
   * @param ingressHost Ingress host domain for the application
   * @param enableTls Whether to enable TLS for ingress
   * @param tlsIssuer TLS certificate issuer name
   * @returns Directory containing synthesized YAML files
   */
  @func()
  async synthesize(
    source: Directory,
    environment: string,
    azureClientId: string,
    azureTenantId: string,
    azureKeyvaultName: string,
    githubAppId: string,
    githubInstallationId: string,
    logLevel: string,
    nextjsBaseUrl: string,
    nodeEnv: string,
    otelEndpoint: string,
    clusterType: string,
    ingressHost: string,
    enableTls: string,
    tlsIssuer: string
  ): Promise<Directory> {
    // Create environment-specific cache volumes
    const npmCache = dag.cacheVolume(`npm-cache-${environment}`)
    const tsCache = dag.cacheVolume(`ts-build-cache-${environment}`)

    // Start with Node.js base image
    let container = dag
      .container()
      .from("node:22-alpine")
      .withWorkdir("/app")
      // Mount caches first for better layer caching
      .withMountedCache("/root/.npm", npmCache)
      .withMountedCache("/app/.tsbuild", tsCache)
      // Mount the full source directory
      .withMountedDirectory("/app", source)
      // Force development mode to install devDependencies
      .withEnvVariable("NODE_ENV", "development")
      // Bypass CI detection to ensure devDependencies are installed
      .withEnvVariable("CI", "false")
      // Set all environment variables
      .withEnvVariable("ENVIRONMENT", environment)
      .withEnvVariable("AZURE_CLIENT_ID", azureClientId)
      .withEnvVariable("AZURE_TENANT_ID", azureTenantId)
      .withEnvVariable("AZURE_KEYVAULT_NAME", azureKeyvaultName)
      .withEnvVariable("GH_APP_ID", githubAppId)
      .withEnvVariable("GH_INSTALLATION_ID", githubInstallationId)
      .withEnvVariable("LOG_LEVEL", logLevel)
      .withEnvVariable("NEXTJS_BASE_URL", nextjsBaseUrl)
      .withEnvVariable("NODE_ENV", nodeEnv)
      .withEnvVariable("OTEL_ENDPOINT", otelEndpoint)
      .withEnvVariable("CLUSTER_TYPE", clusterType)
      .withEnvVariable("INGRESS_HOST", ingressHost)
      .withEnvVariable("ENABLE_TLS", enableTls)
      .withEnvVariable("TLS_ISSUER", tlsIssuer)

    // Install dependencies with optimized flags
    container = await container
      .withExec(["npm", "ci", "--prefer-offline", "--no-audit", "--no-fund"])
      .sync()

    // Synthesize CDK8s using ts-node
    container = await container
      .withExec(["npm", "run", "synth"])
      .sync()

    // Return the dist directory containing synthesized files
    return container.directory("/app/dist")
  }


  /**
   * Update environment variable and synthesize
   * Used by Kargo for image promotions
   * 
   * @param source The source directory
   * @param envName Environment variable name (e.g., NEXTJS_IMAGE)
   * @param envValue New value for the environment variable
   * @param environment Target environment (dev, staging, prod)
   * @param azureClientId Azure AD application ID for workload identity
   * @param azureTenantId Azure tenant ID for authentication
   * @param azureKeyvaultName Azure Key Vault name for secrets
   * @param githubAppId GitHub App ID for authentication
   * @param githubInstallationId GitHub App installation ID
   * @param logLevel Application log level
   * @param nextjsBaseUrl Base URL for Next.js application
   * @param nodeEnv Runtime environment (development/production)
   * @param otelEndpoint OpenTelemetry collector endpoint
   * @param clusterType Cluster type (kind, aks, eks, gke)
   * @param ingressHost Ingress host domain for the application
   * @param enableTls Whether to enable TLS for ingress
   * @param tlsIssuer TLS certificate issuer name
   * @returns Directory containing updated source with synthesized files
   */
  @func()
  async updateAndSynthesize(
    source: Directory,
    envName: string,
    envValue: string,
    environment: string,
    azureClientId: string,
    azureTenantId: string,
    azureKeyvaultName: string,
    githubAppId: string,
    githubInstallationId: string,
    logLevel: string,
    nextjsBaseUrl: string,
    nodeEnv: string,
    otelEndpoint: string,
    clusterType: string,
    ingressHost: string,
    enableTls: string,
    tlsIssuer: string
  ): Promise<Directory> {
    // Override the specific environment variable for Kargo updates
    const envValues: Record<string, string> = {
      AZURE_CLIENT_ID: azureClientId,
      AZURE_TENANT_ID: azureTenantId,
      AZURE_KEYVAULT_NAME: azureKeyvaultName,
      GH_APP_ID: githubAppId,
      GH_INSTALLATION_ID: githubInstallationId,
      LOG_LEVEL: logLevel,
      NEXTJS_BASE_URL: nextjsBaseUrl,
      NODE_ENV: nodeEnv,
      OTEL_ENDPOINT: otelEndpoint,
      CLUSTER_TYPE: clusterType,
      INGRESS_HOST: ingressHost,
      ENABLE_TLS: enableTls,
      TLS_ISSUER: tlsIssuer
    }
    
    // Override the specific variable
    if (envName in envValues) {
      envValues[envName] = envValue
    }
    
    // Run synthesis with the updated environment
    const distDir = await this.synthesize(
      source,
      environment,
      envValues.AZURE_CLIENT_ID,
      envValues.AZURE_TENANT_ID,
      envValues.AZURE_KEYVAULT_NAME,
      envValues.GH_APP_ID,
      envValues.GH_INSTALLATION_ID,
      envValues.LOG_LEVEL,
      envValues.NEXTJS_BASE_URL,
      envValues.NODE_ENV,
      envValues.OTEL_ENDPOINT,
      envValues.CLUSTER_TYPE,
      envValues.INGRESS_HOST,
      envValues.ENABLE_TLS,
      envValues.TLS_ISSUER
    )
    
    // Copy synthesized files back to source
    return source.withDirectory("dist", distDir)
  }

  /**
   * Synthesize CDK8s manifests using configuration from OpenFeature
   * 
   * This function reads configuration from OpenFeature feature flags
   * or falls back to environment variables. It's designed to work with
   * the OpenFeature operator in Kubernetes.
   * 
   * @param source The source directory containing the CDK8s project
   * @param namespace The Kubernetes namespace for OpenFeature ConfigMap (default: "default")
   * @returns Directory containing synthesized YAML files
   */
  @func()
  async synthesizeWithFeatureFlags(
    source: Directory,
    namespace: string = "default"
  ): Promise<Directory> {
    // Get configuration from OpenFeature
    const config = await getConfigFromFeatureFlags(namespace)
    
    // Use the existing synthesize function with values from feature flags
    return this.synthesize(
      source,
      config.environment,
      config.azureClientId,
      config.azureTenantId,
      config.azureKeyvaultName,
      config.githubAppId,
      config.githubInstallationId,
      config.logLevel,
      config.nextjsBaseUrl,
      config.nodeEnv,
      config.otelEndpoint,
      config.clusterType,
      config.ingressHost,
      config.enableTls,
      config.tlsIssuer
    )
  }

}

