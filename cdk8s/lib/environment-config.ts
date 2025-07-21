/**
 * Environment-specific configuration for CDK8s charts
 * This allows charts to behave differently based on the deployment target
 */

export interface EnvironmentConfig {
  /** The environment name (e.g., 'dev', 'staging', 'production') */
  environment: 'dev' | 'staging' | 'production';
  
  /** The cluster type (e.g., 'kind', 'aks', 'eks', 'gke') */
  clusterType: 'kind' | 'aks' | 'eks' | 'gke';
  
  /** Ingress configuration */
  ingress: {
    /** The ingress class to use */
    className: string;
    
    /** The host domain for the ingress */
    host: string;
    
    /** Whether to enable TLS */
    enableTLS: boolean;
    
    /** TLS certificate issuer (e.g., 'letsencrypt-prod') */
    tlsIssuer?: string;
    
    /** Additional annotations for the ingress */
    annotations?: Record<string, string>;
  };
  
  /** Service configuration */
  service?: {
    /** Service type */
    type: 'ClusterIP' | 'LoadBalancer' | 'NodePort';
    
    /** Annotations for the service (e.g., for cloud load balancers) */
    annotations?: Record<string, string>;
  };
  
  /** Resource scaling */
  resources?: {
    /** Number of replicas */
    replicas: number;
    
    /** CPU and memory requests/limits */
    requests?: {
      cpu: string;
      memory: string;
    };
    limits?: {
      cpu: string;
      memory: string;
    };
  };
}

/**
 * Get environment configuration from environment variables
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const environment = (process.env.ENVIRONMENT || 'dev') as EnvironmentConfig['environment'];
  const clusterType = (process.env.CLUSTER_TYPE || 'kind') as EnvironmentConfig['clusterType'];
  
  // Default configurations per environment
  const configs: Record<string, EnvironmentConfig> = {
    dev: {
      environment: 'dev',
      clusterType: 'kind',
      ingress: {
        className: 'nginx',
        host: process.env.INGRESS_HOST || 'chat.localtest.me',
        enableTLS: false,
      },
      resources: {
        replicas: 1,
        requests: {
          cpu: '100m',
          memory: '256Mi',
        },
        limits: {
          cpu: '500m',
          memory: '512Mi',
        },
      },
    },
    staging: {
      environment: 'staging',
      clusterType: 'aks',
      ingress: {
        className: 'nginx',
        host: process.env.INGRESS_HOST || 'chat-staging.example.com',
        enableTLS: true,
        tlsIssuer: 'letsencrypt-staging',
        annotations: {
          'cert-manager.io/cluster-issuer': 'letsencrypt-staging',
          'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
        },
      },
      service: {
        type: 'ClusterIP',
      },
      resources: {
        replicas: 2,
        requests: {
          cpu: '200m',
          memory: '512Mi',
        },
        limits: {
          cpu: '1000m',
          memory: '1Gi',
        },
      },
    },
    production: {
      environment: 'production',
      clusterType: 'aks',
      ingress: {
        className: 'nginx',
        host: process.env.INGRESS_HOST || 'chat.example.com',
        enableTLS: true,
        tlsIssuer: 'letsencrypt-prod',
        annotations: {
          'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
          'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
          'nginx.ingress.kubernetes.io/force-ssl-redirect': 'true',
          'nginx.ingress.kubernetes.io/proxy-body-size': '10m',
        },
      },
      service: {
        type: 'ClusterIP',
        annotations: {
          'service.beta.kubernetes.io/azure-load-balancer-internal': 'false',
        },
      },
      resources: {
        replicas: 3,
        requests: {
          cpu: '500m',
          memory: '1Gi',
        },
        limits: {
          cpu: '2000m',
          memory: '2Gi',
        },
      },
    },
  };
  
  // Get base config for environment
  const baseConfig = configs[environment] || configs.dev;
  
  // Override with environment variables if provided
  if (process.env.INGRESS_HOST) {
    baseConfig.ingress.host = process.env.INGRESS_HOST;
  }
  if (process.env.INGRESS_CLASS) {
    baseConfig.ingress.className = process.env.INGRESS_CLASS;
  }
  if (process.env.ENABLE_TLS !== undefined) {
    baseConfig.ingress.enableTLS = process.env.ENABLE_TLS === 'true';
  }
  if (process.env.TLS_ISSUER) {
    baseConfig.ingress.tlsIssuer = process.env.TLS_ISSUER;
  }
  if (process.env.REPLICAS) {
    baseConfig.resources = baseConfig.resources || { replicas: 1 };
    baseConfig.resources.replicas = parseInt(process.env.REPLICAS, 10);
  }
  
  return baseConfig;
}