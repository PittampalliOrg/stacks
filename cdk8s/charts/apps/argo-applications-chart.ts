import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { Application } from '../../imports/argoproj.io';
import { ApplicationConfig } from '../../lib/idpbuilder-types';

export interface ArgoApplicationsChartProps extends ChartProps {
  /**
   * GitHub organization for production repositories
   */
  githubOrg?: string;
  
  /**
   * GitHub repository name for production
   */
  githubRepo?: string;
  
  /**
   * Environment (dev, staging, production)
   */
  environment?: string;

  /**
   * Application name
   */
  applicationName?: string;

  /**
   * Application namespace
   */
  applicationNamespace?: string;

  /**
   * Path to manifests (relative to package directory)
   */
  manifestPath?: string;

  /**
   * ArgoCD configuration from ApplicationConfig
   */
  argoCdConfig?: ApplicationConfig['argocd'];
}

export class ArgoApplicationsChart extends Chart {
  constructor(scope: Construct, id: string, props: ArgoApplicationsChartProps = {}) {
    super(scope, id, props);
    
    // Get application configuration
    const applicationName = props.applicationName || 'default-app';
    const applicationNamespace = props.applicationNamespace || 'default';
    const manifestPath = props.manifestPath || 'manifests';
    
    // Determine environment
    const environment = props.environment || process.env.ENVIRONMENT || 'dev';
    const isLocal = environment === 'dev';
    
    // GitHub configuration for non-local environments
    const githubOrg = props.githubOrg || process.env.GITHUB_ORG || 'myorg';
    const githubRepo = props.githubRepo || process.env.GITHUB_REPO || 'platform-charts';
    const githubUrl = `https://github.com/${githubOrg}/${githubRepo}.git`;
    
    // Merge labels from config with defaults
    const labels = {
      'app.kubernetes.io/managed-by': 'cdk8s',
      'app.kubernetes.io/environment': environment,
      'app.kubernetes.io/part-of': 'platform',
      'example': 'basic',  // Label for idpbuilder
      ...props.argoCdConfig?.labels
    };

    // Build annotations
    const annotations: Record<string, string> = {};
    if (props.argoCdConfig?.syncWave) {
      annotations['argocd.argoproj.io/sync-wave'] = props.argoCdConfig.syncWave;
    }

    // Create single ArgoCD application for this package
    new Application(this, 'application', {
      metadata: {
        name: applicationName,
        namespace: 'argocd',
        labels,
        ...(Object.keys(annotations).length > 0 && { annotations })
      },
      spec: {
        project: 'default',
        source: {
          repoUrl: isLocal ? `cnoe://${applicationName}/${manifestPath}` : githubUrl,
          path: isLocal ? '.' : `packages/${applicationName}/${manifestPath}`,
          targetRevision: 'HEAD'
        },
        destination: {
          server: 'https://kubernetes.default.svc',
          namespace: applicationNamespace
        },
        syncPolicy: props.argoCdConfig?.syncPolicy || {
          automated: {
            selfHeal: true,
            prune: true
          },
          syncOptions: ['CreateNamespace=true']
        },
        ...(props.argoCdConfig?.ignoreDifferences && {
          ignoreDifferences: props.argoCdConfig.ignoreDifferences
        })
      }
    });
  }
}