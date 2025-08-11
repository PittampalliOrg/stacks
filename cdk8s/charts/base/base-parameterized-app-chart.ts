import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../../imports/k8s';
import * as imagesJson from '../../../.env-files/images.json';

/**
 * Draft base chart for parameterized applications that vary by environment.
 * Not referenced by existing charts yet. Encapsulates common concerns:
 * - image selection from .env-files/images.json
 * - env-specific defaults (replicas/resources)
 * - conditional health probes (dev vs non-dev)
 */

export type EnvironmentName = 'dev' | 'staging' | 'production';

export interface BaseParameterizedAppProps extends ChartProps {
  environmentName: EnvironmentName;
  appKey: 'nextjs' | 'backstage' | string; // key into images.json
  replicas?: number;
  resources?: k8s.ResourceRequirements;
  imageOverride?: string;
  enableProbesInDev?: boolean; // default false
}

export abstract class BaseParameterizedAppChart extends Chart {
  protected readonly env: EnvironmentName;
  protected readonly props: BaseParameterizedAppProps;

  constructor(scope: Construct, id: string, props: BaseParameterizedAppProps) {
    super(scope, id, props);
    this.env = props.environmentName;
    this.props = props;
  }

  /**
   * Resolve the container image for this environment.
   */
  protected resolveImage(): string {
    const all = imagesJson as any;
    const envImages = all[this.env] ?? {};
    const devImages = all['dev'] ?? {};
    const resolved = this.props.imageOverride ?? envImages[this.props.appKey] ?? devImages[this.props.appKey];
    return resolved || 'scratch:latest';
  }

  /**
   * Compute replicas when not specified.
   */
  protected resolveReplicas(): number {
    if (typeof this.props.replicas === 'number') return this.props.replicas;
    return this.env === 'production' ? 3 : 1;
  }

  /**
   * Provide resource defaults per environment if not given.
   */
  protected resolveResources(): k8s.ResourceRequirements {
    if (this.props.resources) return this.props.resources;
    if (this.env === 'production') {
      return {
        limits: { cpu: k8s.Quantity.fromString('2'), memory: k8s.Quantity.fromString('4Gi') },
        requests: { cpu: k8s.Quantity.fromString('1'), memory: k8s.Quantity.fromString('2Gi') },
      };
    }
    return {
      limits: { cpu: k8s.Quantity.fromString('500m'), memory: k8s.Quantity.fromString('1Gi') },
      requests: { cpu: k8s.Quantity.fromString('100m'), memory: k8s.Quantity.fromString('256Mi') },
    };
  }

  /**
   * Optionally add liveness/readiness probes for non-dev envs by default.
   */
  protected probesForPort(port: number): Partial<k8s.Container> {
    const enableProbes = this.env !== 'dev' || this.props.enableProbesInDev === true;
    if (!enableProbes) return {};
    return {
      livenessProbe: {
        httpGet: { path: '/healthcheck', port: k8s.IntOrString.fromNumber(port) },
        initialDelaySeconds: 60,
        periodSeconds: 10,
      },
      readinessProbe: {
        httpGet: { path: '/healthcheck', port: k8s.IntOrString.fromNumber(port) },
        initialDelaySeconds: 30,
        periodSeconds: 10,
      },
    };
  }
}
