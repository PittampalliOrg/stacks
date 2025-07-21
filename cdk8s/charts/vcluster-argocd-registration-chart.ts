import { Construct } from 'constructs';
import { Chart, ChartProps } from 'cdk8s';
import * as k8s from '../imports/k8s';

export interface VClusterArgocdRegistrationProps extends ChartProps {
  vclusters: Array<{
    name: string;
    namespace: string;
  }>;
}

export class VClusterArgocdRegistrationChart extends Chart {
  constructor(scope: Construct, id: string, props: VClusterArgocdRegistrationProps) {
    super(scope, id, props);

    // Store jobs for dependency management
    const jobs: Map<string, k8s.KubeJob> = new Map();

    // For each vCluster, create a Job that registers it with ArgoCD
    props.vclusters.forEach(vcluster => {
      const jobName = `register-vcluster-${vcluster.name}`;
      
      // Create a Job that waits for vCluster to be ready and registers it
      const job = new k8s.KubeJob(this, `${vcluster.name}-registration-job`, {
        metadata: {
          name: jobName,
          namespace: 'argocd',
          labels: {
            'app.kubernetes.io/name': 'vcluster-registration',
            'app.kubernetes.io/instance': vcluster.name,
            'app.kubernetes.io/managed-by': 'cdk8s'
          },
          annotations: {
            'argocd.argoproj.io/sync-wave': '5',  // Run after vCluster is deployed
            'argocd.argoproj.io/hook': 'PostSync',  // Run after successful sync
            'argocd.argoproj.io/hook-delete-policy': 'HookSucceeded'  // Delete job after success
          }
        },
        spec: {
          ttlSecondsAfterFinished: 86400, // Clean up after 24 hours
          template: {
            metadata: {
              labels: {
                'app.kubernetes.io/name': 'vcluster-registration',
                'app.kubernetes.io/instance': vcluster.name
              }
            },
            spec: {
              restartPolicy: 'OnFailure',
              serviceAccountName: 'vcluster-registrar',
              containers: [{
                name: 'register',
                image: 'bitnami/kubectl:latest',
                command: ['/bin/bash'],
                args: ['-c', `
set -e
echo "Waiting for vCluster ${vcluster.name} to be ready..."

# Wait for vCluster secret to exist
for i in {1..60}; do
  if kubectl get secret vc-${vcluster.name} -n ${vcluster.namespace} >/dev/null 2>&1; then
    echo "vCluster secret found"
    break
  fi
  echo "Waiting for vCluster secret... ($i/60)"
  sleep 5
done

# Extract vCluster credentials
echo "Extracting vCluster credentials..."
CA_DATA=$(kubectl get secret vc-${vcluster.name} -n ${vcluster.namespace} -o jsonpath='{.data.certificate-authority}')
CERT_DATA=$(kubectl get secret vc-${vcluster.name} -n ${vcluster.namespace} -o jsonpath='{.data.client-certificate}')
KEY_DATA=$(kubectl get secret vc-${vcluster.name} -n ${vcluster.namespace} -o jsonpath='{.data.client-key}')

# Create ArgoCD cluster secret
echo "Creating ArgoCD cluster secret..."
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: vcluster-${vcluster.name}
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: cluster
type: Opaque
stringData:
  name: vcluster-${vcluster.name}
  server: https://${vcluster.name}.${vcluster.namespace}:443
  config: |
    {
      "tlsClientConfig": {
        "insecure": false,
        "caData": "$CA_DATA",
        "certData": "$CERT_DATA",
        "keyData": "$KEY_DATA"
      }
    }
EOF

echo "vCluster ${vcluster.name} registered with ArgoCD successfully!"
                `]
              }]
            }
          }
        }
      });
      
      // Store job reference for later use
      jobs.set(vcluster.name, job);
    });

    // Create ServiceAccount for the registration jobs
    new k8s.KubeServiceAccount(this, 'vcluster-registrar', {
      metadata: {
        name: 'vcluster-registrar',
        namespace: 'argocd'
      }
    });

    // Create Role for reading vCluster secrets and creating ArgoCD cluster secrets
    new k8s.KubeRole(this, 'vcluster-registrar-role', {
      metadata: {
        name: 'vcluster-registrar',
        namespace: 'argocd'
      },
      rules: [
        {
          apiGroups: [''],
          resources: ['secrets'],
          verbs: ['get', 'list', 'create', 'update', 'patch']
        }
      ]
    });

    // Create RoleBinding in argocd namespace
    new k8s.KubeRoleBinding(this, 'vcluster-registrar-binding-argocd', {
      metadata: {
        name: 'vcluster-registrar',
        namespace: 'argocd'
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: 'vcluster-registrar'
      },
      subjects: [{
        kind: 'ServiceAccount',
        name: 'vcluster-registrar',
        namespace: 'argocd'
      }]
    });

    // Create Role and RoleBinding in each vCluster namespace for reading secrets
    props.vclusters.forEach(vcluster => {
      // Create Role in vCluster namespace
      new k8s.KubeRole(this, `vcluster-secret-reader-${vcluster.name}`, {
        metadata: {
          name: 'vcluster-secret-reader',
          namespace: vcluster.namespace
        },
        rules: [
          {
            apiGroups: [''],
            resources: ['secrets'],
            verbs: ['get', 'list'],
            resourceNames: [`vc-${vcluster.name}`]
          }
        ]
      });

      // Create RoleBinding in vCluster namespace
      const roleBinding = new k8s.KubeRoleBinding(this, `vcluster-secret-reader-binding-${vcluster.name}`, {
        metadata: {
          name: 'vcluster-secret-reader',
          namespace: vcluster.namespace
        },
        roleRef: {
          apiGroup: 'rbac.authorization.k8s.io',
          kind: 'Role',
          name: 'vcluster-secret-reader'
        },
        subjects: [{
          kind: 'ServiceAccount',
          name: 'vcluster-registrar',
          namespace: 'argocd'
        }]
      });

      // Ensure RoleBinding is created before the Job
      const job = jobs.get(vcluster.name);
      if (job) {
        job.addDependency(roleBinding);
      }
    });
  }
}