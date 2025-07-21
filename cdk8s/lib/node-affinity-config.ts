import { TaintEffect } from 'cdk8s-plus-32';

/**
 * Types of workloads for node scheduling
 */
export enum WorkloadType {
  /** System components (ArgoCD, ingress, cert-manager) */
  SYSTEM = 'system',
  
  /** Application workloads */
  APPLICATION = 'application',
  
  /** Monitoring and observability workloads */
  MONITORING = 'monitoring',
  
  /** Batch and job workloads (can use spot instances) */
  BATCH = 'batch'
}

/**
 * Node scheduling configuration
 */
export interface NodeSchedulingConfig {
  /** Node selector labels */
  nodeSelector?: { [key: string]: string };
  
  /** Pod tolerations */
  tolerations?: Array<{
    key: string;
    value?: string;
    effect: TaintEffect;
    operator?: string;
  }>;
  
  /** Node affinity rules */
  affinity?: {
    nodeAffinity?: {
      requiredDuringSchedulingIgnoredDuringExecution?: {
        nodeSelectorTerms: Array<{
          matchExpressions?: Array<{
            key: string;
            operator: string;
            values?: string[];
          }>;
        }>;
      };
      preferredDuringSchedulingIgnoredDuringExecution?: Array<{
        weight: number;
        preference: {
          matchExpressions?: Array<{
            key: string;
            operator: string;
            values?: string[];
          }>;
        };
      }>;
    };
  };
}

/**
 * Get node scheduling configuration based on workload type and environment
 */
export function getNodeSchedulingConfig(workloadType: WorkloadType): NodeSchedulingConfig {
  const clusterType = process.env.CLUSTER_TYPE || 'kind';
  const environment = process.env.ENVIRONMENT || 'dev';
  
  // Only apply node affinity for AKS clusters
  if (clusterType !== 'aks') {
    return {};
  }
  
  switch (workloadType) {
    case WorkloadType.SYSTEM:
      // System components prefer system nodes
      return {
        nodeSelector: {
          'agentpool': 'system'
        },
        affinity: {
          nodeAffinity: {
            preferredDuringSchedulingIgnoredDuringExecution: [
              {
                weight: 100,
                preference: {
                  matchExpressions: [
                    {
                      key: 'node-role',
                      operator: 'In',
                      values: ['system']
                    }
                  ]
                }
              }
            ]
          }
        }
      };
      
    case WorkloadType.APPLICATION:
      // Application workloads go to app nodes
      return {
        nodeSelector: {
          'agentpool': 'apps'
        },
        affinity: {
          nodeAffinity: {
            requiredDuringSchedulingIgnoredDuringExecution: {
              nodeSelectorTerms: [
                {
                  matchExpressions: [
                    {
                      key: 'workload-type',
                      operator: 'In',
                      values: ['application']
                    }
                  ]
                }
              ]
            }
          }
        }
      };
      
    case WorkloadType.MONITORING:
      // Monitoring can go on any node but prefers app nodes
      return {
        affinity: {
          nodeAffinity: {
            preferredDuringSchedulingIgnoredDuringExecution: [
              {
                weight: 50,
                preference: {
                  matchExpressions: [
                    {
                      key: 'agentpool',
                      operator: 'In',
                      values: ['apps']
                    }
                  ]
                }
              }
            ]
          }
        }
      };
      
    case WorkloadType.BATCH:
      // Batch workloads can use spot instances
      if (environment !== 'dev') {
        return {
          tolerations: [
            {
              key: 'kubernetes.azure.com/scalesetpriority',
              value: 'spot',
              effect: TaintEffect.NO_SCHEDULE
            }
          ],
          nodeSelector: {
            'kubernetes.azure.com/scalesetpriority': 'spot'
          },
          affinity: {
            nodeAffinity: {
              preferredDuringSchedulingIgnoredDuringExecution: [
                {
                  weight: 100,
                  preference: {
                    matchExpressions: [
                      {
                        key: 'workload-type',
                        operator: 'In',
                        values: ['batch']
                      }
                    ]
                  }
                }
              ]
            }
          }
        };
      }
      // For dev, use regular app nodes
      return getNodeSchedulingConfig(WorkloadType.APPLICATION);
      
    default:
      return {};
  }
}

/**
 * Check if a workload can tolerate spot instances
 */
export function canUseSpotInstances(workloadType: WorkloadType): boolean {
  return workloadType === WorkloadType.BATCH;
}

/**
 * Get pod anti-affinity rules for high availability
 */
export function getHighAvailabilityAntiAffinity(appLabel: string): any {
  return {
    podAntiAffinity: {
      preferredDuringSchedulingIgnoredDuringExecution: [
        {
          weight: 100,
          podAffinityTerm: {
            labelSelector: {
              matchExpressions: [
                {
                  key: 'app',
                  operator: 'In',
                  values: [appLabel]
                }
              ]
            },
            topologyKey: 'kubernetes.io/hostname'
          }
        }
      ]
    }
  };
}