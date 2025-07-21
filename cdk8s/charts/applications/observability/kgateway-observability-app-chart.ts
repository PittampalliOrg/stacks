import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';
import { ApiObject } from 'cdk8s';

export class KGatewayObservabilityAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // KGateway Observability - Patches deployments with OTEL config
    new ApiObject(this, 'kgateway-observability', {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: 'kgateway-observability',
        namespace: 'argocd',
        finalizers: ['resources-finalizer.argocd.argoproj.io'],
        annotations: {
          'argocd.argoproj.io/sync-wave': '45', // After kgateway is deployed
        },
      },
      spec: {
        project: 'platform',
        source: {
          repoURL: 'https://github.com/PittampalliOrg/cdk8s-project.git',
          targetRevision: process.env.ENVIRONMENT || 'dev',
          path: 'dist',
          directory: {
            include: '[0-9][0-9][0-9][0-9]-kgateway-observability.k8s.yaml',
          },
        },
        destination: {
          server: 'https://kubernetes.default.svc',
          namespace: 'kgateway-system',
        },
        syncPolicy: {
          automated: {
            prune: true,
            selfHeal: true,
          },
          retry: {
            limit: 5,
            backoff: {
              duration: '5s',
              factor: 2,
              maxDuration: '3m',
            },
          },
          syncOptions: [
            'CreateNamespace=true',
            'ServerSideApply=true',
          ],
        },
      },
    });

    // KGateway Alloy Observability - Configures Alloy to scrape kgateway metrics
    new ApiObject(this, 'kgateway-alloy-observability', {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: 'kgateway-alloy-observability', 
        namespace: 'argocd',
        finalizers: ['resources-finalizer.argocd.argoproj.io'],
        annotations: {
          'argocd.argoproj.io/sync-wave': '46', // After Alloy is deployed
        },
      },
      spec: {
        project: 'platform',
        source: {
          repoURL: 'https://github.com/PittampalliOrg/cdk8s-project.git',
          targetRevision: 'dev',
          path: 'dist',
          directory: {
            include: '[0-9][0-9][0-9][0-9]-kgateway-alloy-observability.k8s.yaml',
          },
        },
        destination: {
          server: 'https://kubernetes.default.svc',
          namespace: 'monitoring',
        },
        syncPolicy: {
          automated: {
            prune: true,
            selfHeal: true,
          },
          retry: {
            limit: 5,
            backoff: {
              duration: '5s',
              factor: 2,
              maxDuration: '3m',
            },
          },
          syncOptions: [
            'CreateNamespace=true',
            'ServerSideApply=true',
          ],
        },
      },
    });

    // KGateway Grafana Dashboards
    new ApiObject(this, 'kgateway-grafana-dashboards', {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: 'kgateway-grafana-dashboards',
        namespace: 'argocd',
        finalizers: ['resources-finalizer.argocd.argoproj.io'],
        annotations: {
          'argocd.argoproj.io/sync-wave': '47', // After Grafana is deployed
        },
      },
      spec: {
        project: 'platform',
        source: {
          repoURL: 'https://github.com/PittampalliOrg/cdk8s-project.git',
          targetRevision: 'dev',
          path: 'dist',
          directory: {
            include: '[0-9][0-9][0-9][0-9]-kgateway-grafana-dashboards.k8s.yaml',
          },
        },
        destination: {
          server: 'https://kubernetes.default.svc',
          namespace: 'monitoring',
        },
        syncPolicy: {
          automated: {
            prune: true,
            selfHeal: true,
          },
          retry: {
            limit: 5,
            backoff: {
              duration: '5s',
              factor: 2,
              maxDuration: '3m',
            },
          },
          syncOptions: [
            'CreateNamespace=true',
            'ServerSideApply=true',
          ],
        },
      },
    });
  }
}