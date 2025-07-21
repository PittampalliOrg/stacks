import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

/**
 * ArgoCD Token Rotation CronJob
 * 
 * This CronJob periodically rotates the API token for the backstage service account.
 * The token is stored in a Kubernetes secret and optionally pushed to Azure Key Vault.
 */
export class ArgoCDTokenRotationCronJob extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    const namespace = 'argocd';
    const backstageNamespace = 'backstage';

    // Create a ServiceAccount for the token rotation job
    const serviceAccount = new k8s.KubeServiceAccount(this, 'token-rotator-sa', {
      metadata: {
        name: 'argocd-token-rotator',
        namespace
      }
    });

    // Create Role for accessing secrets
    const role = new k8s.KubeRole(this, 'token-rotator-role', {
      metadata: {
        name: 'argocd-token-rotator',
        namespace: backstageNamespace
      },
      rules: [{
        apiGroups: [''],
        resources: ['secrets'],
        verbs: ['get', 'create', 'update', 'patch']
      }]
    });

    // Create RoleBinding
    new k8s.KubeRoleBinding(this, 'token-rotator-binding', {
      metadata: {
        name: 'argocd-token-rotator',
        namespace: backstageNamespace
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: role.name
      },
      subjects: [{
        kind: 'ServiceAccount',
        name: serviceAccount.name,
        namespace
      }]
    });

    // Create CronJob for token rotation
    new k8s.KubeCronJob(this, 'token-rotation-cronjob', {
      metadata: {
        name: 'argocd-backstage-token-rotation',
        namespace,
        labels: {
          'app.kubernetes.io/name': 'argocd-token-rotation',
          'app.kubernetes.io/part-of': 'argocd'
        }
      },
      spec: {
        schedule: '0 0 * * 0', // Weekly on Sunday at midnight
        successfulJobsHistoryLimit: 3,
        failedJobsHistoryLimit: 3,
        jobTemplate: {
          spec: {
            template: {
              spec: {
                serviceAccountName: serviceAccount.name,
                restartPolicy: 'OnFailure',
                containers: [{
                  name: 'token-rotator',
                  image: 'bitnami/kubectl:latest',
                  command: ['/bin/bash', '-c'],
                  args: [`
                    set -e

                    # Function to generate token using ArgoCD API
                    generate_token() {
                      # Get admin password from secret
                      ADMIN_PASSWORD=$(kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath='{.data.password}' | base64 -d)
                      
                      # Login and get session token
                      SESSION_TOKEN=$(curl -s -X POST "http://argocd-server.argocd.svc.cluster.local/api/v1/session" \\
                        -H "Content-Type: application/json" \\
                        -d "{\\"username\\":\\"admin\\",\\"password\\":\\"$ADMIN_PASSWORD\\"}" | jq -r '.token')
                      
                      # Generate token for backstage account
                      RESPONSE=$(curl -s -X POST "http://argocd-server.argocd.svc.cluster.local/api/v1/account/backstage/token" \\
                        -H "Authorization: Bearer $SESSION_TOKEN" \\
                        -H "Content-Type: application/json" \\
                        -d '{"id":"backstage-api-token-'$(date +%s)'","expiresIn":"8760h"}')
                      
                      echo $RESPONSE | jq -r '.token'
                    }

                    echo "Generating new ArgoCD token for backstage account..."
                    NEW_TOKEN=$(generate_token)

                    if [ -z "$NEW_TOKEN" ]; then
                      echo "Failed to generate token"
                      exit 1
                    fi

                    # Update the secret
                    kubectl create secret generic argocd-backstage-api-token \\
                      --from-literal=token="$NEW_TOKEN" \\
                      --namespace=${backstageNamespace} \\
                      --dry-run=client -o yaml | kubectl apply -f -

                    echo "Token rotation completed successfully"

                    # Optional: Push to Azure Key Vault if External Secrets Operator is configured
                    # This would require additional setup with Azure credentials
                  `],
                  env: [{
                    name: 'ARGOCD_SERVER',
                    value: 'argocd-server.argocd.svc.cluster.local'
                  }]
                }]
              }
            }
          }
        }
      }
    });

    // Create initial secret that will be managed by the CronJob
    new k8s.KubeSecret(this, 'initial-api-token-secret', {
      metadata: {
        name: 'argocd-backstage-api-token',
        namespace: backstageNamespace,
        annotations: {
          'argocd.argoproj.io/sync-options': 'SkipDryRunOnMissingResource=true',
        }
      },
      type: 'Opaque',
      data: {
        // Placeholder - will be replaced by CronJob
        token: Buffer.from('placeholder-token').toString('base64')
      }
    });
  }
}