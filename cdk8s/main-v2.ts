import { App, YamlOutputType } from 'cdk8s';
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { ArgoApplicationsChartV2 } from './charts/platform/argo-applications-chart-v2';
import { IdpBuilderChartFactory } from './lib/idpbuilder-chart-factory';
import { applicationConfigs } from './config/applications';

// Register all available charts with the factory
import { BootstrapSecretsChart } from './charts/secrets/bootstrap-secrets-chart';
import { ExternalSecretsWorkloadIdentityChart } from './charts/secrets/external-secrets-workload-identity-chart';
import { HeadlampChart } from './charts/platform/headlamp-chart';
import { HeadlampKeycloakSecretsChart } from './charts/secrets/headlamp-keycloak-secrets-chart';
import { KeycloakHeadlampClientChart } from './charts/platform/keycloak-headlamp-client-chart';
import { NamespaceChart } from './charts/platform/namespace-chart';
import { NextJsSecretsChart } from './charts/secrets/nextjs-secrets-chart';
import { PostgresChart } from './charts/apps/postgres-chart';
import { RedisChart } from './charts/apps/redis-chart';
import { KargoHelmChart } from './charts/pipelines/kargo-helm-chart';
import { KargoSecretsChart } from './charts/pipelines/kargo-secrets-chart';
import { KargoPipelinesProjectChart } from './charts/pipelines/kargo-pipelines-project-chart';
import { KargoPipelinesCredentialsChart } from './charts/pipelines/kargo-pipelines-credentials-chart';
import { KargoCACertificatesChart } from './charts/pipelines/kargo-ca-certificates-chart';
import { KargoNextjsPipelineChart } from './charts/pipelines/kargo-nextjs-pipeline-chart';
import { KargoBackstagePipelineChart } from './charts/pipelines/kargo-backstage-pipeline-chart';
import { KargoGiteaWebhookSetupChart } from './charts/pipelines/kargo-gitea-webhook-setup-chart';
import { KargoWebhookPatchChart } from './charts/pipelines/kargo-webhook-patch-chart';
import { DaggerInfraChart } from './charts/infra/dagger-infra-chart';
import { AiPlatformEngineeringAzureChart } from './charts/ai-platform-engineering-azure-chart';
import { VaultChart } from './charts/infra/vault/vault-composite-chart';
import { NextJsParameterizedChart } from './charts/apps/nextjs-parameterized-chart';
import { BackstageParameterizedChart } from './charts/apps/backstage-parameterized-chart';
import { BackstageDevApplicationChart } from './charts/apps/backstage-dev-application-chart';
import { BackstageStagingApplicationChart } from './charts/apps/backstage-staging-application-chart';
import { BackstageSecretsChart } from './charts/secrets/backstage-secrets-chart';
import { NextJsDevApplicationChart } from './charts/apps/nextjs-dev-application-chart';
import { NextJsStagingApplicationChart } from './charts/apps/nextjs-staging-application-chart';

// Register all charts
IdpBuilderChartFactory.register('BootstrapSecretsChart', BootstrapSecretsChart);
IdpBuilderChartFactory.register('ExternalSecretsWorkloadIdentityChart', ExternalSecretsWorkloadIdentityChart);
IdpBuilderChartFactory.register('HeadlampChart', HeadlampChart);
IdpBuilderChartFactory.register('HeadlampKeycloakSecretsChart', HeadlampKeycloakSecretsChart);
IdpBuilderChartFactory.register('KeycloakHeadlampClientChart', KeycloakHeadlampClientChart);
IdpBuilderChartFactory.register('NamespaceChart', NamespaceChart);
IdpBuilderChartFactory.register('NextJsSecretsChart', NextJsSecretsChart);
IdpBuilderChartFactory.register('PostgresChart', PostgresChart);
IdpBuilderChartFactory.register('RedisChart', RedisChart);
IdpBuilderChartFactory.register('KargoHelmChart', KargoHelmChart);
IdpBuilderChartFactory.register('KargoSecretsChart', KargoSecretsChart);
IdpBuilderChartFactory.register('KargoPipelinesProjectChart', KargoPipelinesProjectChart);
IdpBuilderChartFactory.register('KargoPipelinesCredentialsChart', KargoPipelinesCredentialsChart);
IdpBuilderChartFactory.register('KargoCACertificatesChart', KargoCACertificatesChart);
IdpBuilderChartFactory.register('KargoNextjsPipelineChart', KargoNextjsPipelineChart);
IdpBuilderChartFactory.register('KargoBackstagePipelineChart', KargoBackstagePipelineChart);
IdpBuilderChartFactory.register('KargoGiteaWebhookSetupChart', KargoGiteaWebhookSetupChart);
IdpBuilderChartFactory.register('KargoWebhookPatchChart', KargoWebhookPatchChart);
IdpBuilderChartFactory.register('DaggerInfraChart', DaggerInfraChart);
IdpBuilderChartFactory.register('AiPlatformEngineeringAzureChart', AiPlatformEngineeringAzureChart);
IdpBuilderChartFactory.register('VaultChart', VaultChart);
IdpBuilderChartFactory.register('NextJsParameterizedChart', NextJsParameterizedChart);
IdpBuilderChartFactory.register('BackstageParameterizedChart', BackstageParameterizedChart);
IdpBuilderChartFactory.register('BackstageDevApplicationChart', BackstageDevApplicationChart);
IdpBuilderChartFactory.register('BackstageStagingApplicationChart', BackstageStagingApplicationChart);
IdpBuilderChartFactory.register('BackstageSecretsChart', BackstageSecretsChart);
IdpBuilderChartFactory.register('NextJsDevApplicationChart', NextJsDevApplicationChart);
IdpBuilderChartFactory.register('NextJsStagingApplicationChart', NextJsStagingApplicationChart);

const outputDir = 'dist';

/**
 * Synthesis configuration options
 */
interface SynthesisOptions {
  /**
   * Output directory for generated manifests
   */
  outputDir: string;
  
  /**
   * Whether to generate Helm charts instead of raw manifests
   */
  helmOutput?: boolean;
  
  /**
   * Environment (dev, staging, production)
   */
  environment?: string;
}

/**
 * Load environment variables from a simple KEY=VALUE file.
 * Ignores blank lines and lines starting with '#'.
 */
function loadEnvFile(filePath: string): void {
  try {
    const abs = path.resolve(filePath);
    if (!fs.existsSync(abs)) return;
    const content = fs.readFileSync(abs, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx <= 0) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch (e) {
    console.warn('⚠ Could not load env file:', filePath, e);
  }
}

/**
 * Create the proper IDPBuilder package structure
 */
async function createPackageStructure(appName: string, outputDir: string): Promise<void> {
  const packageDir = path.join(outputDir, appName);
  const manifestsDir = path.join(packageDir, 'manifests');
  
  // Ensure directories exist
  if (!fs.existsSync(manifestsDir)) {
    fs.mkdirSync(manifestsDir, { recursive: true });
  }
}

/**
 * Synthesize a single application
 */
async function synthesizeApplication(appConfig: any, options: SynthesisOptions): Promise<void> {
  console.log(`Synthesizing application: ${appConfig.name}`);
  
  try {
    // Create package structure
    await createPackageStructure(appConfig.name, options.outputDir);
    
    // 1. Generate manifests for the application
    const manifestApp = new App({
      yamlOutputType: YamlOutputType.FILE_PER_RESOURCE,
      outdir: path.join(options.outputDir, appConfig.name, 'manifests'),
    });
    
    // Use factory to create chart with dependencies
    await IdpBuilderChartFactory.createChart(manifestApp, appConfig);
    manifestApp.synth();

    // With FILE_PER_RESOURCE, we'll have multiple YAML files in the manifests directory
    // IDPBuilder will handle these individual resource files
    console.log(`  ✓ Generated individual resource files for ${appConfig.name}`);

    // Ensure a kustomization.yaml exists so Argo CD can apply kustomize patches when needed
    try {
      const manifestsDir = path.join(options.outputDir, appConfig.name, 'manifests');
      const files = fs.readdirSync(manifestsDir)
        .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
        .sort();
      const kustomizationPath = path.join(manifestsDir, 'kustomization.yaml');
      const kustomization = [
        'apiVersion: kustomize.config.k8s.io/v1beta1',
        'kind: Kustomization',
        'resources:',
        ...files.map((f) => `  - ${f}`),
        ''
      ].join('\n');
      fs.writeFileSync(kustomizationPath, kustomization);
      console.log(`  ✓ Wrote kustomization.yaml for ${appConfig.name}`);
    } catch (e) {
      console.warn(`  ⚠ Could not write kustomization.yaml for ${appConfig.name}:`, e);
    }
    
    // Copy values.yaml if it exists in the source package
    const sourceValuesPath = path.join(__dirname, '..', 'ai-platform-engineering', appConfig.name, 'values.yaml');
    const destValuesPath = path.join(options.outputDir, appConfig.name, 'values.yaml');
    if (fs.existsSync(sourceValuesPath)) {
      fs.copyFileSync(sourceValuesPath, destValuesPath);
      console.log(`  ✓ Copied values.yaml for ${appConfig.name}`);
    }
    
    // 2. Generate ArgoCD Application manifest (or ApplicationSet for special cases)
    const argoOutDir = path.join(options.outputDir, '.argo', appConfig.name);
    fs.mkdirSync(argoOutDir, { recursive: true });
    const argoApp = new App({
      yamlOutputType: YamlOutputType.FILE_PER_APP,
      outdir: argoOutDir,
    });
    
    // Check if this is a parameterized application (NextJs or Backstage)
    // These now generate individual applications, not ApplicationSets
    if (appConfig.chart?.type === 'NextJsParameterizedChart' || appConfig.chart?.type === 'BackstageParameterizedChart') {
      const envName = appConfig.chart.props?.environmentName;
      if (!envName) {
        console.error(`Missing environmentName for ${appConfig.name}`);
        return;
      }
      
      // Generate the actual manifests for this specific environment
      const ChartClass = appConfig.chart.type === 'NextJsParameterizedChart' 
        ? NextJsParameterizedChart 
        : BackstageParameterizedChart;
      
      new ChartClass(manifestApp, appConfig.name, {
        environmentName: envName,
      });
      
      // Generate the ArgoCD Application that points to these manifests
      // Map the chart type and environment to the correct Application chart
      let ApplicationChartClass;
      if (appConfig.chart.type === 'NextJsParameterizedChart') {
        ApplicationChartClass = envName === 'dev' ? NextJsDevApplicationChart : NextJsStagingApplicationChart;
      } else {
        ApplicationChartClass = envName === 'dev' ? BackstageDevApplicationChart : BackstageStagingApplicationChart;
      }
      
      new ApplicationChartClass(argoApp, `${appConfig.name}-app`, {});
      
    } else if (appConfig.argocd?.sources && appConfig.argocd.sources.length > 0) {
      // Multi-source application
      new ArgoApplicationsChartV2(argoApp, appConfig.name, {
        applicationName: appConfig.name,
        applicationNamespace: appConfig.namespace,
        manifestPath: 'manifests',
        argoCdConfig: appConfig.argocd,
        environment: options.environment
      });
    } else {
      // Single source application using builder within a chart
      new ArgoApplicationsChartV2(argoApp, appConfig.name, {
        applicationName: appConfig.name,
        applicationNamespace: appConfig.namespace,
        manifestPath: 'manifests',
        argoCdConfig: appConfig.argocd,
        environment: options.environment
      });
    }
    
    argoApp.synth();
    // Move generated Application YAML to root output dir with canonical name
    const argoFiles = fs.readdirSync(argoOutDir);
    const argoAppFile = argoFiles.find(f => f === 'app.yaml' || f === 'app.k8s.yaml');
    if (argoAppFile) {
      fs.renameSync(
        path.join(argoOutDir, argoAppFile),
        path.join(options.outputDir, `${appConfig.name}.yaml`)
      );
    }
    
    console.log(`✓ Successfully synthesized: ${appConfig.name}`);
  } catch (error) {
    console.error(`✗ Failed to synthesize ${appConfig.name}:`, error);
    throw error;
  }
}

interface EnvConfig {
  name: string;
}

const envs: EnvConfig[] = [
  { name: 'dev' },
  { name: 'staging' },
];

/**
 * Write vcluster ArgoCD Applications
 */
function writeVclusterApplications(outdir?: string): void {
  const base = outdir ?? path.join(__dirname, '..', 'dist');
  
  // Ensure the output directory exists
  fs.mkdirSync(base, { recursive: true });
  
  for (const e of envs) {
    const ns = `${e.name}-vcluster`;
    const rel = `${e.name}-vcluster-helm`;
    const host = `${e.name}-vcluster.cnoe.localtest.me`;
    const svcShort = `${e.name}-vcluster-helm.${ns}`;
    const svcFqdn = `${svcShort}.svc`;

    // vcluster helm application
    const vclusterApp: any = {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: `${e.name}-vcluster-helm`,
        namespace: 'argocd',
        annotations: { 'argocd.argoproj.io/sync-wave': '10' },
        labels: { 
          'app.kubernetes.io/name': `vcluster-${e.name}`,
          'app.kubernetes.io/component': 'vcluster',
          'app.kubernetes.io/instance': e.name,
          'app.kubernetes.io/part-of': 'platform',
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io'],
      },
      spec: {
        project: 'default',
        destination: { server: 'https://kubernetes.default.svc', namespace: ns },
        source: {
          repoURL: 'https://charts.loft.sh',
          targetRevision: '0.26.0', // Keep newer version
          chart: 'vcluster',
          helm: {
            valuesObject: {
              sync: { 
                fromHost: { 
                  nodes: { enabled: true },
                  ingressClasses: { enabled: true },
                  secrets: {
                    enabled: true,
                    mappings: {
                      byName: {
                        'nextjs/*': 'nextjs/*',
                        'backstage/*': 'backstage/*',
                      },
                    },
                  },
                },
                toHost: {
                  serviceAccounts: { enabled: true },
                  ingresses: { enabled: false },
                }
              },
              controlPlane: {
                advanced: { virtualScheduler: { enabled: true } },
                proxy: { 
                  extraSANs: [host, svcShort, svcFqdn] 
                },
                statefulSet: { 
                  scheduling: { podManagementPolicy: 'OrderedReady' } 
                },
              },
              exportKubeConfig: { 
                server: `https://${svcShort}:443` 
              },
            },
          },
        },
        ignoreDifferences: [
          {
            group: 'apps',
            kind: 'StatefulSet',
            jsonPointers: ['/spec/volumeClaimTemplates']
          }
        ],
        syncPolicy: { 
          automated: {
            selfHeal: true,
            prune: true
          }, 
          syncOptions: [
            'CreateNamespace=true',
            'SkipDryRunOnMissingResource=true',
            'ServerSideApply=true',
            'RespectIgnoreDifferences=true'
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
      },
    };
    fs.writeFileSync(path.join(base, `${e.name}-vcluster-helm.yaml`), YAML.stringify(vclusterApp), 'utf8');
  }
}

/**
 * Write vcluster ingress manifests
 */
function writeVclusterIngressManifests(outdir?: string): void {
  const base = outdir ?? path.join(__dirname, '..', 'dist');
  const outBase = path.join(base, 'vcluster-ingress');
  
  for (const e of envs) {
    const ns = `${e.name}-vcluster`;
    const appName = `${e.name}-vcluster-helm`;
    const host = `${e.name}-vcluster.cnoe.localtest.me`;
    const dir = path.join(outBase, e.name);
    fs.mkdirSync(dir, { recursive: true });
    
    const ingressYaml = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vcluster-ingress
  namespace: ${ns}
  annotations:
    nginx.ingress.kubernetes.io/backend-protocol: HTTPS
    nginx.ingress.kubernetes.io/ssl-passthrough: "true"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - ${host}
  rules:
  - host: ${host}
    http:
      paths:
      - path: /
        pathType: ImplementationSpecific
        backend:
          service:
            name: ${appName}
            port:
              number: 443
`;
    fs.writeFileSync(path.join(dir, 'ingress.yaml'), ingressYaml, { encoding: 'utf8' });
    
    // Create ArgoCD application for ingress
    const ingressApp: any = {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: `${e.name}-vcluster-ingress`,
        namespace: 'argocd',
        annotations: { 'argocd.argoproj.io/sync-wave': '15' },
        labels: {
          'app.kubernetes.io/component': 'ingress',
          'app.kubernetes.io/part-of': 'vcluster',
          'app.kubernetes.io/name': `vcluster-${e.name}-ingress`,
          'app.kubernetes.io/instance': e.name,
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io'],
      },
      spec: {
        project: 'default',
        destination: { server: 'https://kubernetes.default.svc', namespace: ns },
        source: { 
          repoURL: `cnoe://vcluster-ingress/${e.name}`, 
          targetRevision: 'HEAD', 
          path: '.' 
        },
        syncPolicy: {
          automated: {
            selfHeal: true,
            prune: true
          },
          syncOptions: ['CreateNamespace=true'],
        },
      },
    };
    fs.writeFileSync(path.join(base, `${e.name}-vcluster-ingress.yaml`), YAML.stringify(ingressApp), 'utf8');
  }
}

/**
 * Write enrollment manifests for vcluster registration
 */
function writeEnrollmentManifests(outdir?: string): void {
  const base = outdir ?? path.join(__dirname, '..', 'dist');
  const outBase = path.join(base, 'enroll');
  
  for (const e of envs) {
    const dir = path.join(outBase, e.name);
    fs.mkdirSync(dir, { recursive: true });
    const ns = `${e.name}-vcluster`;
    const rel = `${e.name}-vcluster-helm`;
    
    const jobYaml = `apiVersion: v1
kind: ServiceAccount
metadata:
  name: enroll-vcluster-${e.name}
  namespace: argocd
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: enroll-vcluster-read-secrets-${e.name}
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get","list","watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: enroll-vcluster-read-secrets-binding-${e.name}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: enroll-vcluster-read-secrets-${e.name}
subjects:
- kind: ServiceAccount
  name: enroll-vcluster-${e.name}
  namespace: argocd
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: enroll-vcluster-write-${e.name}
  namespace: argocd
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["create","update","patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: enroll-vcluster-write-binding-${e.name}
  namespace: argocd
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: enroll-vcluster-write-${e.name}
subjects:
- kind: ServiceAccount
  name: enroll-vcluster-${e.name}
  namespace: argocd
---
apiVersion: batch/v1
kind: Job
metadata:
  name: enroll-vcluster-${e.name}
  namespace: argocd
spec:
  template:
    metadata:
      name: enroll-vcluster-${e.name}
    spec:
      serviceAccountName: enroll-vcluster-${e.name}
      restartPolicy: OnFailure
      containers:
      - name: enroll
        image: bitnami/kubectl:latest
        command:
        - /bin/bash
        - -c
        - |
          set -e
          echo "Waiting for vcluster secret..."
          until kubectl get secret vc-${rel} -n ${ns} 2>/dev/null; do
            echo "Waiting for secret vc-${rel} in namespace ${ns}..."
            sleep 5
          done
          
          echo "Extracting vcluster kubeconfig..."
          kubectl get secret vc-${rel} -n ${ns} -o jsonpath='{.data.config}' | base64 -d > /tmp/vc.yaml
          
          SERVER="https://${rel}.${ns}.svc:443"
          CA_DATA=$(kubectl get secret vc-${rel} -n ${ns} -o jsonpath='{.data.certificate-authority}')
          CLIENT_CERT=$(kubectl get secret vc-${rel} -n ${ns} -o jsonpath='{.data.client-certificate}')
          CLIENT_KEY=$(kubectl get secret vc-${rel} -n ${ns} -o jsonpath='{.data.client-key}')
          
          echo "Creating ArgoCD cluster secret..."
          
          # Create the config JSON properly
          CONFIG_JSON="{\\\"tlsClientConfig\\\":{\\\"caData\\\":\\\"$CA_DATA\\\",\\\"certData\\\":\\\"$CLIENT_CERT\\\",\\\"keyData\\\":\\\"$CLIENT_KEY\\\"}}"
          
          cat <<EOF | kubectl apply -f -
          apiVersion: v1
          kind: Secret
          metadata:
            name: ${e.name}-vcluster
            namespace: argocd
            labels:
              argocd.argoproj.io/secret-type: cluster
          type: Opaque
          data:
            name: $(echo -n "${e.name}-vcluster" | base64 -w0)
            server: $(echo -n "$SERVER" | base64 -w0)
            config: $(echo -n "$CONFIG_JSON" | base64 -w0)
          EOF
          
          echo "vCluster ${e.name} enrolled successfully"
`;
    fs.writeFileSync(path.join(dir, 'enroll-job.yaml'), jobYaml, { encoding: 'utf8' });
    
    // Create enrollment application
    const enrollApp: any = {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Application',
      metadata: {
        name: `${e.name}-enroll`,
        namespace: 'argocd',
        annotations: { 'argocd.argoproj.io/sync-wave': '20' },
        labels: { 
          'app.kubernetes.io/component': 'registration',
          'app.kubernetes.io/part-of': 'vcluster-registration',
          'app.kubernetes.io/name': `vcluster-${e.name}-enroll`,
        },
        finalizers: ['resources-finalizer.argocd.argoproj.io'],
      },
      spec: {
        project: 'default',
        destination: { server: 'https://kubernetes.default.svc', namespace: 'argocd' },
        source: { 
          repoURL: `cnoe://enroll/${e.name}`, 
          targetRevision: 'HEAD', 
          path: '.' 
        },
        ignoreDifferences: [
          {
            group: 'batch',
            kind: 'Job',
            jqPathExpressions: [
              '.spec.podReplacementPolicy',
              '.status.terminating'
            ]
          }
        ],
        syncPolicy: {
          automated: {
            selfHeal: true,
            prune: true
          },
          syncOptions: [
            'CreateNamespace=false',
            'RespectIgnoreDifferences=true'
          ],
        },
      },
    };
    fs.writeFileSync(path.join(base, `${e.name}-enroll.yaml`), YAML.stringify(enrollApp), 'utf8');
  }
}

/**
 * Main synthesis function with improved structure
 */
async function main() {
  const options: SynthesisOptions = {
    outputDir,
    environment: process.env.ENVIRONMENT || 'dev',
    helmOutput: process.env.HELM_OUTPUT === 'true'
  };
  // Load environment configuration for secrets and stores
  // Prefer wi.env for dev; allow overriding via ENV_FILE
  const envFile = process.env.ENV_FILE || (options.environment === 'dev' ? '../.env-files/wi.env' : '../.env-files/production.env');
  loadEnvFile(path.join(__dirname, envFile));
  
  // Clean output directory
  if (fs.existsSync(options.outputDir)) {
    fs.rmSync(options.outputDir, { recursive: true });
  }
  fs.mkdirSync(options.outputDir, { recursive: true });
  
  // Simple concurrency pool for synthesis
  const concurrency = parseInt(process.env.SYNTH_CONCURRENCY || '4', 10);
  const queue = [...applicationConfigs];
  const workers: Promise<void>[] = [];
  async function worker() {
    while (queue.length > 0) {
      const cfg = queue.shift();
      if (!cfg) break;
      await synthesizeApplication(cfg, options);
    }
  }
  for (let i = 0; i < Math.max(1, concurrency); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  
  // Generate vcluster applications and manifests
  console.log('\nGenerating vcluster applications...');
  writeVclusterApplications(options.outputDir);
  writeVclusterIngressManifests(options.outputDir);
  writeEnrollmentManifests(options.outputDir);
  
  console.log('\nSynthesis complete!');
  console.log(`Output directory: ${options.outputDir}/`);
  console.log('\nIDPBuilder package structure:');
  console.log('- Each application has its own directory with app.yaml and manifests/');
  console.log('- Directory structure matches cnoe:// URL requirements');
  console.log('\nYou can now run: idpbuilder create -p cdk8s/dist/');
}

// Run the main function
main().catch(error => {
  console.error('Synthesis failed:', error);
  process.exit(1);
});
