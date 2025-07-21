import * as kplus from 'cdk8s-plus-32';
import { ApiObject, Chart, Duration } from 'cdk8s';

/**
 * Configuration for autoscaling a deployment
 */
export interface AutoscalingConfig {
  /** Enable Horizontal Pod Autoscaler */
  enableHPA?: boolean;
  
  /** Enable KEDA for event-driven scaling */
  enableKEDA?: boolean;
  
  /** Minimum number of replicas */
  minReplicas?: number;
  
  /** Maximum number of replicas */
  maxReplicas?: number;
  
  /** Target CPU utilization percentage for HPA */
  targetCPUPercent?: number;
  
  /** Target memory utilization percentage for HPA */
  targetMemoryPercent?: number;
  
  /** KEDA triggers for event-driven scaling */
  kedaTriggers?: KedaTrigger[];
  
  /** Scale down behavior configuration */
  scaleDown?: ScaleDownConfig;
}

/**
 * KEDA trigger configuration
 */
export interface KedaTrigger {
  /** Type of the scaler (e.g., prometheus, azure-queue, redis) */
  type: string;
  
  /** Metadata for the scaler */
  metadata: Record<string, string>;
  
  /** Authentication reference (optional) */
  authenticationRef?: {
    name: string;
  };
}

/**
 * Scale down behavior configuration
 */
export interface ScaleDownConfig {
  /** Stabilization window in seconds */
  stabilizationWindowSeconds?: number;
  
  /** Policies for scaling down */
  policies?: Array<{
    type: 'Percent' | 'Pods';
    value: number;
    periodSeconds: number;
  }>;
}

/**
 * Create a Horizontal Pod Autoscaler for a deployment
 */
export function createHPA(
  deployment: kplus.Deployment,
  config: AutoscalingConfig
): kplus.HorizontalPodAutoscaler | undefined {
  if (!config.enableHPA) return;
  
  const metrics: kplus.Metric[] = [];
  
  // Add CPU metric if specified
  if (config.targetCPUPercent) {
    metrics.push(kplus.Metric.resourceCpu(
      kplus.MetricTarget.averageUtilization(config.targetCPUPercent)
    ));
  }
  
  // Add memory metric if specified
  if (config.targetMemoryPercent) {
    metrics.push(kplus.Metric.resourceMemory(
      kplus.MetricTarget.averageUtilization(config.targetMemoryPercent)
    ));
  }
  
  // Create HPA only if we have metrics
  if (metrics.length === 0) {
    console.warn(`HPA enabled but no metrics specified for deployment ${deployment.name}`);
    return;
  }
  
  return new kplus.HorizontalPodAutoscaler(deployment, 'hpa', {
    target: deployment,
    minReplicas: config.minReplicas || 1,
    maxReplicas: config.maxReplicas || 10,
    metrics: metrics,
    scaleDown: config.scaleDown ? {
      stabilizationWindow: Duration.seconds(config.scaleDown.stabilizationWindowSeconds || 300),
      policies: config.scaleDown.policies?.map(p => ({
        replicas: p.type === 'Percent' ? kplus.Replicas.percent(p.value) : kplus.Replicas.absolute(p.value),
        duration: Duration.seconds(p.periodSeconds)
      }))
    } : undefined
  });
}

/**
 * Create a KEDA ScaledObject for event-driven scaling
 */
export function createKEDAScaledObject(
  chart: Chart,
  deployment: kplus.Deployment,
  config: AutoscalingConfig
): ApiObject | undefined {
  if (!config.enableKEDA || !config.kedaTriggers || config.kedaTriggers.length === 0) {
    return;
  }
  
  return new ApiObject(chart, `${deployment.name}-scaledobject`, {
    apiVersion: 'keda.sh/v1alpha1',
    kind: 'ScaledObject',
    metadata: {
      name: `${deployment.name}-scaledobject`,
      namespace: deployment.metadata.namespace,
      labels: {
        'app.kubernetes.io/name': deployment.name,
        'app.kubernetes.io/managed-by': 'cdk8s'
      }
    },
    spec: {
      scaleTargetRef: {
        name: deployment.name,
        kind: 'Deployment',
        apiVersion: 'apps/v1'
      },
      minReplicaCount: config.minReplicas || 0,
      maxReplicaCount: config.maxReplicas || 100,
      pollingInterval: 30,
      cooldownPeriod: 300,
      triggers: config.kedaTriggers.map(trigger => ({
        type: trigger.type,
        metadata: trigger.metadata,
        ...(trigger.authenticationRef && {
          authenticationRef: trigger.authenticationRef
        })
      }))
    }
  });
}

/**
 * Common KEDA trigger templates
 */
export const KedaTriggers = {
  /**
   * Create a Prometheus trigger
   */
  prometheus: (query: string, threshold: string, serverAddress = 'http://prometheus:9090'): KedaTrigger => ({
    type: 'prometheus',
    metadata: {
      serverAddress,
      metricName: 'custom_metric',
      query,
      threshold
    }
  }),
  
  /**
   * Create an Azure Service Bus trigger
   */
  azureServiceBus: (queueName: string, queueLength = '5', namespace?: string): KedaTrigger => ({
    type: 'azure-servicebus',
    metadata: {
      queueName,
      queueLength,
      ...(namespace && { namespace })
    }
  }),
  
  /**
   * Create a Redis trigger
   */
  redis: (listName: string, listLength = '10', address = 'redis:6379'): KedaTrigger => ({
    type: 'redis',
    metadata: {
      address,
      listName,
      listLength
    }
  }),
  
  /**
   * Create a Cron trigger for scheduled scaling
   */
  cron: (timezone: string, start: string, end: string, desiredReplicas: string): KedaTrigger => ({
    type: 'cron',
    metadata: {
      timezone,
      start,
      end,
      desiredReplicas
    }
  }),
  
  /**
   * Create a CPU trigger (alternative to HPA)
   */
  cpu: (targetUtilization = '80'): KedaTrigger => ({
    type: 'cpu',
    metadata: {
      type: 'Utilization',
      value: targetUtilization
    }
  }),
  
  /**
   * Create a Memory trigger
   */
  memory: (targetUtilization = '80'): KedaTrigger => ({
    type: 'memory',
    metadata: {
      type: 'Utilization',
      value: targetUtilization
    }
  })
};

/**
 * Preset autoscaling configurations
 */
export const AutoscalingPresets = {
  /**
   * Web application preset - scales based on CPU
   */
  webApp: (): AutoscalingConfig => ({
    enableHPA: true,
    minReplicas: 2,
    maxReplicas: 10,
    targetCPUPercent: 70,
    scaleDown: {
      stabilizationWindowSeconds: 300,
      policies: [
        { type: 'Percent', value: 10, periodSeconds: 60 },
        { type: 'Pods', value: 2, periodSeconds: 60 }
      ]
    }
  }),
  
  /**
   * API service preset - scales based on CPU and memory
   */
  apiService: (): AutoscalingConfig => ({
    enableHPA: true,
    minReplicas: 3,
    maxReplicas: 20,
    targetCPUPercent: 60,
    targetMemoryPercent: 70,
    scaleDown: {
      stabilizationWindowSeconds: 300
    }
  }),
  
  /**
   * Background worker preset - scales to zero with KEDA
   */
  backgroundWorker: (trigger: KedaTrigger): AutoscalingConfig => ({
    enableKEDA: true,
    minReplicas: 0,
    maxReplicas: 10,
    kedaTriggers: [trigger]
  }),
  
  /**
   * Batch job preset - scales based on queue length
   */
  batchJob: (queueTrigger: KedaTrigger): AutoscalingConfig => ({
    enableKEDA: true,
    minReplicas: 0,
    maxReplicas: 50,
    kedaTriggers: [queueTrigger]
  }),
  
  /**
   * Business hours preset - scales based on time
   */
  businessHours: (timezone = 'America/New_York'): AutoscalingConfig => ({
    enableKEDA: true,
    minReplicas: 1,
    maxReplicas: 10,
    kedaTriggers: [
      KedaTriggers.cron(timezone, '0 8 * * 1-5', '0 18 * * 1-5', '5'),
      KedaTriggers.cpu('70')
    ]
  })
};