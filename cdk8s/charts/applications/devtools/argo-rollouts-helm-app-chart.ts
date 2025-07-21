import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';
import { ApiObject } from 'cdk8s';

/**
 * Creates an ArgoCD Application for Argo Rollouts Helm chart installation
 * This application installs Argo Rollouts for progressive delivery capabilities
 * 
 * Argo Rollouts provides:
 * - Blue-Green deployments
 * - Canary deployments with traffic management
 * - Progressive delivery with analysis
 * - Integration with service meshes and ingress controllers
 */
export class ArgoRolloutsHelmAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.createHelmApplication('argo-rollouts', {
      resourcePath: 'argo-rollouts',
      namespace: 'argo-rollouts',
      project: 'platform',
      syncWave: '-45',
      helmRepoURL: 'https://argoproj.github.io/argo-helm',
      chart: 'argo-rollouts',
      helmVersion: '2.39.6',
      helmReleaseName: 'argo-rollouts',
      helmValues: {
        installCRDs: true,
        clusterInstall: true,
        controller: {
          image: { pullPolicy: 'IfNotPresent' },
          metrics: {
            enabled: true,
            serviceMonitor: { enabled: false }
          },
          resources: {
            requests: { cpu: '100m', memory: '128Mi' },
            limits: { cpu: '500m', memory: '512Mi' }
          }
        },
        dashboard: {
          enabled: true,
          service: { type: 'ClusterIP' },
          resources: {
            requests: { cpu: '50m', memory: '64Mi' },
            limits: { cpu: '200m', memory: '256Mi' }
          }
        },
        notifications: { enabled: false }
      },
      syncOptions: [
        'ApplyOutOfSyncOnly=true'
      ],
      ignoreDifferences: [
        {
          group: 'apps',
          kind: 'Deployment',
          jsonPointers: [
            '/spec/replicas',
            '/spec/template/metadata/labels',
            '/spec/template/metadata/annotations',
            '/spec/template/spec/containers/*/resources',
            '/spec/template/spec/containers/*/env',
            '/spec/selector/matchLabels'
          ]
        },
        {
          group: '',
          kind: 'Service',
          jsonPointers: [
            '/spec/clusterIP',
            '/spec/clusterIPs',
            '/metadata/annotations'
          ]
        },
        {
          group: '',
          kind: 'ServiceAccount',
          jsonPointers: [
            '/metadata/annotations',
            '/secrets'
          ]
        },
        {
          group: 'apiextensions.k8s.io',
          kind: 'CustomResourceDefinition',
          jsonPointers: [
            '/spec/conversion/webhook/clientConfig/caBundle',
            '/status',
            '/metadata/annotations',
            '/spec/preserveUnknownFields'
          ]
        }
      ],
      labels: {
        'app.kubernetes.io/name': 'argo-rollouts',
        'app.kubernetes.io/part-of': 'progressive-delivery'
      }
    });
  }
}