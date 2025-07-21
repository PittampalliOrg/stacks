import * as kplus from 'cdk8s-plus-32';
import { Chart, Duration } from 'cdk8s';
import { WorkloadType, getNodeSchedulingConfig, getHighAvailabilityAntiAffinity } from './node-affinity-config';
import { AutoscalingConfig, createHPA, createKEDAScaledObject } from './autoscaling-config';

/**
 * Options for creating a deployment with CDK8s best practices
 */
export interface CreateDeploymentOptions {
  /** The chart to add the deployment to */
  chart: Chart;
  
  /** ID for the deployment */
  id: string;
  
  /** Kubernetes namespace */
  namespace: string;
  
  /** Type of workload for node scheduling */
  workloadType: WorkloadType;
  
  /** Number of replicas (will be overridden by autoscaling if enabled) */
  replicas?: number;
  
  /** Container specifications */
  containers: kplus.ContainerProps[];
  
  /** Service account to use */
  serviceAccount?: kplus.IServiceAccount;
  
  /** ArgoCD sync wave annotation */
  syncWave?: string;
  
  /** Volumes to mount */
  volumes?: kplus.Volume[];
  
  /** Pod restart policy */
  restartPolicy?: kplus.RestartPolicy;
  
  /** Pod security context */
  securityContext?: kplus.PodSecurityContextProps;
  
  /** Autoscaling configuration */
  autoscaling?: AutoscalingConfig;
  
  /** Whether this workload can tolerate spot instances */
  spotTolerant?: boolean;
  
  /** Enable high availability anti-affinity rules */
  enableHA?: boolean;
  
  /** Additional labels for the deployment */
  labels?: { [key: string]: string };
  
  /** Additional annotations for the deployment */
  annotations?: { [key: string]: string };
  
  /** Host aliases */
  hostAliases?: kplus.HostAlias[];
  
  /** Termination grace period in seconds */
  terminationGracePeriod?: Duration;
}

/**
 * Create a deployment with best practices applied
 */
export function createDeployment(options: CreateDeploymentOptions): kplus.Deployment {
  const {
    chart,
    id,
    namespace,
    workloadType,
    replicas = 1,
    containers,
    serviceAccount,
    syncWave,
    volumes = [],
    restartPolicy = kplus.RestartPolicy.ALWAYS,
    securityContext,
    autoscaling,
    spotTolerant = false,
    enableHA = false,
    labels = {},
    annotations = {},
    hostAliases = [],
    terminationGracePeriod
  } = options;
  
  // Get node scheduling configuration
  const nodeScheduling = getNodeSchedulingConfig(workloadType);
  
  // Add spot tolerance if specified and environment supports it
  const tolerations = [...(nodeScheduling.tolerations || [])];
  if (spotTolerant && workloadType === WorkloadType.BATCH) {
    const spotToleration = {
      key: 'kubernetes.azure.com/scalesetpriority',
      value: 'spot',
      effect: kplus.TaintEffect.NO_SCHEDULE
    };
    if (!tolerations.some(t => t.key === spotToleration.key)) {
      tolerations.push(spotToleration);
    }
  }
  
  // Combine affinity rules
  let affinity = { ...nodeScheduling.affinity };
  if (enableHA && containers.length > 0) {
    const appLabel = labels.app || labels['app.kubernetes.io/name'] || containers[0].name || id;
    const antiAffinity = getHighAvailabilityAntiAffinity(appLabel);
    affinity = {
      ...affinity,
      ...antiAffinity
    };
  }
  
  // Create metadata with sync wave if specified
  const metadata: any = {
    namespace,
    labels: {
      'app.kubernetes.io/managed-by': 'cdk8s',
      'app.kubernetes.io/name': id,
      ...labels
    },
    annotations: {
      ...annotations
    }
  };
  
  if (syncWave) {
    metadata.annotations['argocd.argoproj.io/sync-wave'] = syncWave;
  }
  
  // Create the deployment
  const deployment = new kplus.Deployment(chart, id, {
    metadata,
    replicas: autoscaling?.enableHPA || autoscaling?.enableKEDA ? undefined : replicas,
    serviceAccount,
    volumes,
    restartPolicy,
    securityContext,
    containers,
    hostAliases,
    terminationGracePeriod,
    ...(nodeScheduling.nodeSelector && { nodeSelector: nodeScheduling.nodeSelector }),
    ...(tolerations.length > 0 && { tolerations }),
    ...(Object.keys(affinity).length > 0 && { affinity })
  });
  
  // Image pull secrets would need to be added at pod spec level
  // Currently cdk8s-plus doesn't support this directly on Deployment
  
  // Add autoscaling if configured
  if (autoscaling) {
    // Create HPA if enabled
    if (autoscaling.enableHPA) {
      createHPA(deployment, autoscaling);
    }
    
    // Create KEDA ScaledObject if enabled
    if (autoscaling.enableKEDA) {
      createKEDAScaledObject(chart, deployment, autoscaling);
    }
  }
  
  return deployment;
}

/**
 * Options for exposing a deployment as a service
 */
export interface ExposeDeploymentOptions {
  /** Service name (defaults to deployment name) */
  name?: string;
  
  /** Service type */
  type?: kplus.ServiceType;
  
  /** Service ports */
  ports?: kplus.ServicePort[];
  
  /** Additional labels */
  labels?: { [key: string]: string };
  
  /** Additional annotations */
  annotations?: { [key: string]: string };
  
  /** Session affinity */
  sessionAffinity?: boolean;
  
  /** External traffic policy (for LoadBalancer/NodePort) */
  externalTrafficPolicy?: string;
}

/**
 * Expose a deployment as a service with defaults
 */
export function exposeDeployment(
  deployment: kplus.Deployment,
  options: ExposeDeploymentOptions = {}
): kplus.Service {
  const {
    name,
    type = kplus.ServiceType.CLUSTER_IP,
    ports
  } = options;
  
  // If ports not specified, try to infer from containers
  let servicePorts = ports;
  if (!servicePorts && deployment.containers.length > 0) {
    const containerPorts = deployment.containers[0].ports || [];
    servicePorts = containerPorts.map(p => ({
      port: p.number,
      targetPort: p.number,
      protocol: p.protocol
    }));
  }
  
  return deployment.exposeViaService({
    name: name || deployment.name,
    serviceType: type,
    ports: servicePorts
  });
}

/**
 * Create a standard ingress for a service
 */
export function createIngress(
  chart: Chart,
  service: kplus.Service,
  options: {
    host: string;
    path?: string;
    pathType?: kplus.HttpIngressPathType;
    tlsSecretName?: string;
    annotations?: { [key: string]: string };
  }
): kplus.Ingress {
  const { host, path = '/', pathType = kplus.HttpIngressPathType.PREFIX, tlsSecretName, annotations = {} } = options;
  
  const ingressAnnotations: { [key: string]: string } = {
    'kubernetes.io/ingress.class': 'nginx',
    ...annotations
  };
  
  // Add TLS redirect if TLS is enabled
  if (tlsSecretName) {
    ingressAnnotations['nginx.ingress.kubernetes.io/ssl-redirect'] = 'true';
  }
  
  return new kplus.Ingress(chart, `${service.name}-ingress`, {
    metadata: {
      namespace: service.metadata.namespace,
      annotations: ingressAnnotations
    },
    rules: [{
      host,
      backend: kplus.IngressBackend.fromService(service),
      path,
      pathType
    }],
    ...(tlsSecretName && {
      tls: [{
        hosts: [host],
        secret: kplus.Secret.fromSecretName(chart, `${service.name}-tls-ref`, tlsSecretName)
      }]
    })
  });
}