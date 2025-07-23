import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';
import { Application } from '../../../imports/argoproj.io';

/**
 * Creates an ArgoCD Application for Kargo Helm chart installation
 * This application installs the Kargo GitOps promotion engine
 * 
 * Kargo is deployed to the platform project to allow cluster-wide RBAC resources
 * The Helm chart is from ghcr.io/akuity/kargo-charts (OCI registry)
 */
export class KargoHelmAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // Kargo Helm Application
    new Application(this, 'kargo-helm', {
      metadata: {
        name: 'kargo',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'app.kubernetes.io/name': 'kargo',
          'app.kubernetes.io/part-of': 'gitops-promotions'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '-50', // Before kargo-credentials and kargo-pipeline
          'app.kubernetes.io/last-updated': '2025-07-21T12:45:00Z', // Force env/dev branch update
          'app.kubernetes.io/update-reason': 'fix-api-server-base-url-env-var'
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'default',
        source: {
          repoUrl: 'ghcr.io/akuity/kargo-charts',
          chart: 'kargo',
          targetRevision: '1.6.0',
          helm: {
            releaseName: 'kargo',
            values: JSON.stringify({
              api: {
                host: `kargo-webhooks.${process.env.INGRESS_HOST || 'localtest.me'}`,
                adminAccount: {
                  passwordHash: '$2a$10$Zrhhie4vLz5ygtVSaif6o.qN36jgs6vjtMBdM6yrU1FOeiAAMMxOm', // admin
                  tokenSigningKey: 'YvUGEEoD430TBHCfzrxVifl4RD6PkO'
                },
                service: {
                  type: 'ClusterIP'
                },
                resources: {
                  requests: {
                    cpu: '100m',
                    memory: '128Mi'
                  },
                  limits: {
                    cpu: '500m',
                    memory: '256Mi'
                  }
                },
                // Add environment variable for API server base URL to fix webhook URL generation
                env: [
                  {
                    name: 'API_SERVER_BASE_URL',
                    value: `https://kargo-webhooks.${process.env.INGRESS_HOST || 'localtest.me'}`
                  }
                ]
              },
              controller: {
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
              webhooksServer: {
                resources: {
                  requests: {
                    cpu: '100m',
                    memory: '128Mi'
                  },
                  limits: {
                    cpu: '200m',
                    memory: '256Mi'
                  }
                }
              },
              garbageCollector: {
                resources: {
                  requests: {
                    cpu: '50m',
                    memory: '64Mi'
                  },
                  limits: {
                    cpu: '100m',
                    memory: '128Mi'
                  }
                }
              }
            }, null, 2)
          }
        },
        destination: {
          name: 'in-cluster',
          namespace: 'kargo'
        },
        syncPolicy: {
          automated: {
            prune: true,
            selfHeal: true,
            allowEmpty: false
          },
          syncOptions: [
            'CreateNamespace=true',
            'ServerSideApply=true',
            'ApplyOutOfSyncOnly=true'
          ],
          retry: {
            limit: 5,
            backoff: {
              duration: '10s',
              factor: 2,
              maxDuration: '3m'
            }
          }
        },
        revisionHistoryLimit: 3,
        ignoreDifferences: [{
          group: 'apps',
          kind: 'Deployment',
          jsonPointers: [
            '/spec/replicas',
            '/spec/template/metadata/labels',
            '/spec/template/metadata/annotations',
            '/spec/template/spec/containers/*/resources',
            '/spec/template/spec/containers/*/env',
            '/spec/template/spec/containers/*/envFrom',
            '/spec/template/spec/containers/*/volumeMounts',
            '/spec/template/spec/volumes',
            '/spec/selector/matchLabels',
            '/metadata/labels/app.kubernetes.io~1version',
            '/metadata/labels/helm.sh~1chart',
            '/spec/template/metadata/labels/app.kubernetes.io~1version',
            '/spec/template/metadata/labels/helm.sh~1chart'
          ]
        }, {
          group: 'batch',
          kind: 'CronJob',
          jsonPointers: [
            '/spec/jobTemplate/spec/template/metadata/labels',
            '/spec/jobTemplate/spec/template/spec/containers/*/resources'
          ]
        }, {
          group: '',
          kind: 'Service',
          jsonPointers: [
            '/spec/clusterIP',
            '/spec/clusterIPs',
            '/metadata/annotations'
          ]
        }, {
          group: '',
          kind: 'ServiceAccount',
          jsonPointers: [
            '/metadata/annotations',
            '/secrets'
          ]
        }, {
          group: 'admissionregistration.k8s.io',
          kind: 'ValidatingWebhookConfiguration',
          jsonPointers: [
            '/webhooks/*/clientConfig/caBundle'
          ]
        }, {
          group: 'admissionregistration.k8s.io',
          kind: 'MutatingWebhookConfiguration',
          jsonPointers: [
            '/webhooks/*/clientConfig/caBundle'
          ]
        }]
      }
    });
  }
}