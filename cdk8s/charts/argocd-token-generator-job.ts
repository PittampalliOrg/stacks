import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

/**
 * ArgoCD Token Generator Job
 * 
 * This job generates an API token for the backstage service account in ArgoCD.
 * Note: This is an example implementation. In production, consider:
 * - Storing the token in a secure secret store
 * - Implementing proper error handling
 * - Adding token rotation logic
 */
export class ArgoCDTokenGeneratorJob extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const namespace = 'argocd';
    const backstageNamespace = 'backstage';

    // Create a Job to generate ArgoCD token for backstage account
    new k8s.KubeJob(this, 'argocd-token-generator', {
      metadata: {
        name: 'argocd-backstage-token-generator',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-5', // Run after ArgoCD is configured
          'argocd.argoproj.io/hook': 'PostSync',
          'argocd.argoproj.io/hook-delete-policy': 'HookSucceeded',
        }
      },
      spec: {
        ttlSecondsAfterFinished: 3600, // Clean up after 1 hour
        template: {
          spec: {
            serviceAccountName: 'argocd-server', // Use ArgoCD server SA for admin access
            restartPolicy: 'OnFailure',
            containers: [{
              name: 'token-generator',
              image: 'argoproj/argocd:v2.13.1', // Match your ArgoCD version
              command: ['/bin/bash', '-c'],
              args: [`
                # Wait for ArgoCD to be ready
                until argocd login localhost:8080 --core; do
                  echo "Waiting for ArgoCD to be ready..."
                  sleep 5
                done

                # Generate token for backstage account
                TOKEN=$(argocd account generate-token --account backstage --id backstage-api-token)

                # Create or update the secret in backstage namespace
                kubectl create secret generic argocd-backstage-token \
                  --from-literal=token="$TOKEN" \
                  --namespace=${backstageNamespace} \
                  --dry-run=client -o yaml | kubectl apply -f -

                echo "Token generated and stored in secret 'argocd-backstage-token'"
              `],
              env: [{
                name: 'ARGOCD_SERVER',
                value: 'localhost:8080'
              }]
            }]
          }
        }
      }
    });

    // Alternative: Create a placeholder secret that will be populated by the job
    new k8s.KubeSecret(this, 'argocd-backstage-token-placeholder', {
      metadata: {
        name: 'argocd-backstage-token',
        namespace: backstageNamespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-20', // Create before the job runs
          'argocd.argoproj.io/sync-options': 'SkipDryRunOnMissingResource=true',
        }
      },
      type: 'Opaque',
      stringData: {
        token: 'placeholder-will-be-replaced-by-job'
      }
    });
  }
}