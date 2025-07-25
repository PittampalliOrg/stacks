import { z } from "zod";
 
const env = z.object({
    APP_ID: z.string().optional(),
    AZURE_TENANT_ID: z.string().optional(),
    AZURE_SUBSCRIPTION_ID: z.string().optional(),
    AZURE_STORAGE_ACCOUNT: z.string().optional(),
    RESOURCE_GROUP: z.string().optional(),
    SERVICE_ACCOUNT_ISSUER: z.string().optional(),
    ACR_NAME: z.string().optional(),
    ACR_RG: z.string().optional(),
    AZURE_KEYVAULT_NAME: z.string().optional(),
    CLUSTER_NAME: z.string().optional(),
    AZURE_CLIENT_ID: z.string().optional(),
    GH_APP_ID: z.string().optional(),
    GH_INSTALLATION_ID: z.string().optional(),
    GITHUB_ORG: z.string().optional(),
    GITHUB_REPO: z.string().optional(),
    GITHUB_TOKEN: z.string().optional(),
    ENVIRONMENT: z.string().optional(),
    CLUSTER_TYPE: z.string().optional(),
    NODE_ENV: z.string().optional(),
    ENABLE_TLS: z.string().optional(),
    TLS_ISSUER: z.string().optional(),
    INGRESS_HOST: z.string().optional(),
    NEXTJS_BASE_URL: z.string().optional(),
    ACME_EMAIL: z.string().optional(),
    AUTH_ENVIRONMENT: z.string().optional(),
    K8S_CLUSTER_NAME: z.string().optional(),
    ARGOCD_API_URL: z.string().optional(),
    BACKSTAGE_BASE_URL: z.string().optional(),
    BACKEND_BASE_URL: z.string().optional(),
    POSTGRES_HOST: z.string().optional(),
    POSTGRES_PORT: z.string().optional(),
    POSTGRES_USER: z.string().optional(),
    POSTGRES_DATABASE: z.string().optional(),
    POSTGRES_SSL_MODE: z.string().optional(),
    POSTGRES_CHANNEL_BINDING: z.string().optional(),
    OTEL_ENDPOINT: z.string().optional(),
    LOG_LEVEL: z.string().optional(),
});
 
env.parse(process.env);
 
declare global {
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof env> {}
  }
}
 