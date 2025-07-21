import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../lib/argocd-application-chart';

/**
 * Infrastructure Apps Chart
 * 
 * This chart manages core infrastructure applications like NGINX ingress controller
 * that need to be deployed before platform applications.
 */
export class InfrastructureAppsChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    // Determine cluster type and environment from environment variables
    const clusterType = process.env.CLUSTER_TYPE || 'kind';
    const environment = process.env.ENVIRONMENT || 'dev';
    const isKind = clusterType === 'kind';
    const isAKS = clusterType === 'aks';
    const isProduction = environment === 'production';

    // NGINX Ingress Controller
    this.createHelmApplication('ingress-nginx', {
      namespace: 'ingress-nginx',
      resourcePath: 'ingress-nginx', // Not used for Helm charts but required by interface
      syncWave: '-95', // Deploy very early
      project: 'default',
      
      // Helm-specific configuration
      chart: 'ingress-nginx',
      helmRepoURL: 'https://kubernetes.github.io/ingress-nginx',
      helmVersion: '4.10.0', // Latest stable version
      
      // Environment-specific Helm values
      helmValues: {
        controller: {
          kind: 'Deployment',
          replicaCount: isProduction ? 2 : 1,
          
          // Service configuration - the key difference between environments
          service: {
            type: isKind ? 'NodePort' : 'LoadBalancer',
            
            // NodePort configuration for KIND
            ...(isKind && {
              nodePorts: {
                http: 30080,
                https: 30443
              }
            }),
            
            // LoadBalancer configuration for AKS
            ...(isAKS && {
              externalTrafficPolicy: 'Local',
              annotations: {
                'service.beta.kubernetes.io/azure-load-balancer-health-probe-request-path': '/healthz'
              }
            }),
          },
          
          // Resource limits
          resources: {
            limits: {
              cpu: isProduction ? '1000m' : '500m',
              memory: isProduction ? '1Gi' : '512Mi'
            },
            requests: {
              cpu: isProduction ? '500m' : '100m',
              memory: isProduction ? '512Mi' : '128Mi'
            }
          },
          
          // Metrics for monitoring
          metrics: {
            enabled: true,
            serviceMonitor: {
              enabled: false // Enable if Prometheus is installed
            }
          },
          
          // Production-specific autoscaling
          ...(isProduction && {
            autoscaling: {
              enabled: true,
              minReplicas: 2,
              maxReplicas: 10,
              targetCPUUtilizationPercentage: 70,
              targetMemoryUtilizationPercentage: 80
            }
          }),
          
          // Default IngressClass
          ingressClassResource: {
            default: true,
            name: 'nginx'
          },
          
          // Disable admission webhooks to avoid deployment issues
          // These webhooks can cause stuck jobs, especially in AKS environments
          admissionWebhooks: {
            enabled: false
          },
          
          // Pod disruption budget for high availability
          ...(isProduction && {
            podDisruptionBudget: {
              enabled: true,
              minAvailable: 1
            }
          }),
        }
      },
      
      // Additional sync options for infrastructure components
      syncOptions: [
        'CreateNamespace=true',
        'ServerSideApply=true',
        'Replace=true', // Force replace for CRDs
      ],
      
      labels: {
        'app.kubernetes.io/component': 'ingress-controller',
        'app.kubernetes.io/part-of': 'infrastructure',
      },
    });

    // PostgreSQL for Backstage
    this.createHelmApplication('postgres-postgresql', {
      namespace: 'backstage',
      resourcePath: 'postgres-postgresql', // Not used for Helm charts but required by interface
      syncWave: '-50', // Deploy after ingress but before platform apps
      project: 'default',
      
      // Helm-specific configuration
      chart: 'postgresql',
      helmRepoURL: 'https://charts.bitnami.com/bitnami',
      helmVersion: '13.2.24', // Latest stable version
      
      // Helm values for PostgreSQL
      helmValues: {
        global: {
          postgresql: {
            auth: {
              database: 'backstage',
              username: 'backstage',
              password: 'ziewbjWM1t',  // Explicitly set the password to match existing instance
              existingSecret: ''         // Disable using existing secret to ensure password is set
            }
          }
        },
        
        primary: {
          persistence: {
            enabled: true,
            size: '8Gi'
          },
          
          resources: {
            limits: {
              memory: '256Mi',
              cpu: '250m'
            },
            requests: {
              memory: '128Mi',
              cpu: '100m'
            }
          }
        },
        
        // Disable replication for simplicity
        architecture: 'standalone',
        
        // Service configuration
        service: {
          type: 'ClusterIP',
          port: 5432
        },
        
        // Metrics for monitoring (optional)
        metrics: {
          enabled: false
        }
      },
      
      // Sync options
      syncOptions: [
        'CreateNamespace=true',
        'ServerSideApply=true'
      ],
      
      labels: {
        'app.kubernetes.io/component': 'database',
        'app.kubernetes.io/part-of': 'backstage',
      },
    });

    // Future infrastructure apps can be added here
    // Examples: 
    // - External DNS (for automatic DNS management)
    // - Cert Manager (already exists separately)
    // - Metrics Server
    // - Cluster Autoscaler (for AKS)
  }
}