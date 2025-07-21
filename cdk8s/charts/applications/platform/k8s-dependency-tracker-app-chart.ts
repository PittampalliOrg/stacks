import { Construct } from 'constructs';
import { ArgoCdApplicationChart } from '../../../lib/argocd-application-chart';
import { Application } from '../../../imports/argoproj.io';

/**
 * Creates an ArgoCD Application for Kubernetes Dependency Tracker
 * This application provides a backend API for tracking Kubernetes resource dependencies
 * through owner references, used by the Backstage Kubernetes Resources plugin
 * 
 * Now using direct Kubernetes manifests instead of Helm due to OCI registry access issues
 */
export class K8sDependencyTrackerAppChart extends ArgoCdApplicationChart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // Kubernetes Dependency Tracker Application
    new Application(this, 'k8s-dependency-tracker', {
      metadata: {
        name: 'k8s-dependency-tracker',
        namespace: 'argocd',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'app.kubernetes.io/name': 'k8s-dependency-tracker',
          'app.kubernetes.io/part-of': 'backstage-integration'
        },
        annotations: {
          'argocd.argoproj.io/sync-wave': '20', // After platform prerequisites
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io']
      },
      spec: {
        project: 'platform',
        source: {
          repoUrl: 'https://github.com/PittampalliOrg/cdk8s-project.git',
          targetRevision: 'HEAD',
          path: 'dist/k8s-dependency-tracker-deployment'
        },
        destination: {
          name: 'in-cluster',
          namespace: 'k8s-dependency-tracker'
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
        revisionHistoryLimit: 3
      }
    });
  }
}