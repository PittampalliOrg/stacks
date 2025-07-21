import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';
import { ApiObject } from 'cdk8s';

/**
 * Creates ArgoCD Applications for Kagent Helm deployments
 * This deploys both the CRDs and the main Kagent application via Helm
 * 
 * Kagent provides AI-powered Kubernetes management capabilities
 * The Helm charts need to be deployed from the kagent repository
 */
export class KagentHelmAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Kagent CRDs - Must be deployed first
    this.createHelmApplication('kagent-crds', {
      chart: 'kagent-crds',
      helmRepoURL: 'ghcr.io/kagent-dev/kagent/helm',
      helmVersion: '0.4.1',
      helmReleaseName: 'kagent-crds',
      resourcePath: 'kagent-crds',
      namespace: 'kagent',
      project: 'ai-platform',
      syncWave: '75',
      labels: {
        'app.kubernetes.io/component': 'crds',
        'app.kubernetes.io/part-of': 'kagent',
        'app.kubernetes.io/name': 'kagent-crds',
        'app.kubernetes.io/managed-by': 'cdk8s'
      },
      syncOptions: [
        'CreateNamespace=true',
        'ServerSideApply=true',
        'Replace=true'
      ]
    });

    // Main Kagent application
    this.createHelmApplication('kagent', {
      chart: 'kagent',
      helmRepoURL: 'ghcr.io/kagent-dev/kagent/helm',
      helmVersion: '0.4.1',
      helmReleaseName: 'kagent',
      resourcePath: 'kagent',
      namespace: 'kagent',
      project: 'ai-platform',
      syncWave: '76',
      labels: {
        'app.kubernetes.io/component': 'ai-platform',
        'app.kubernetes.io/part-of': 'kagent',
        'app.kubernetes.io/name': 'kagent',
        'app.kubernetes.io/managed-by': 'cdk8s'
      },
      syncOptions: [
        'CreateNamespace=true',
        'ServerSideApply=true',
        'RespectIgnoreDifferences=true',
        'SkipDryRunOnMissingResource=true'
      ],
      helmValues: {
        defaultModelConfig: {
          create: false
        },
        providers: {
          default: 'openAI',
          openAI: {
            existingSecret: 'kagent-openai',
            existingSecretKey: 'OPENAI_API_KEY'
          }
        },
        ui: {
          enabled: true,
          service: {
            type: 'ClusterIP'
          }
        },
        resources: {
          requests: {
            cpu: '100m',
            memory: '128Mi'
          },
          limits: {
            cpu: '500m',
            memory: '512Mi'
          }
        }
      },
      ignoreDifferences: [
        {
          group: 'kagent.dev',
          kind: 'ModelConfig',
          name: 'default-model-config'
        },
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
        }
      ]
    });
  }
}