import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../../imports/k8s';

export interface VaultInitJobChartProps extends ChartProps {
  namespace?: string;
}

export class VaultInitJobChart extends Chart {
  constructor(scope: Construct, id: string, props: VaultInitJobChartProps = {}) {
    super(scope, id, props);

    const namespace = props.namespace || 'vault';

    // Service Account
    const serviceAccount = new k8s.KubeServiceAccount(this, 'vault-init-sa', {
      metadata: {
        name: 'vault-init',
        namespace: namespace,
      },
    });

    // Role
    new k8s.KubeRole(this, 'vault-init-role', {
      metadata: {
        name: 'vault-init',
        namespace: namespace,
      },
      rules: [
        {
          apiGroups: [''],
          resources: ['secrets'],
          verbs: ['create', 'get', 'patch', 'update'],
        },
        {
          apiGroups: [''],
          resources: ['pods'],
          verbs: ['delete', 'get', 'list', 'watch'],
        },
        {
          apiGroups: [''],
          resources: ['persistentvolumeclaims'],
          verbs: ['get', 'list', 'delete'],
        },
      ],
    });

    // RoleBinding
    new k8s.KubeRoleBinding(this, 'vault-init-rolebinding', {
      metadata: {
        name: 'vault-init',
        namespace: namespace,
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: 'vault-init',
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'vault-init',
          namespace: namespace,
        },
      ],
    });

    // Job
    new k8s.KubeJob(this, 'vault-init-job', {
      metadata: {
        name: 'vault-init',
        namespace: namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '0',
          'argocd.argoproj.io/hook-delete-policy': 'HookSucceeded',
        },
      },
      spec: {
        template: {
          spec: {
            serviceAccountName: 'vault-init',
            restartPolicy: 'OnFailure',
            containers: [
              {
                name: 'vault-init',
                image: 'docker.io/library/ubuntu:22.04',
                env: [
                  {
                    name: 'VAULT_ADDR',
                    value: 'http://vault:8200',
                  },
                  {
                    name: 'VAULT_SKIP_VERIFY',
                    value: 'true',
                  },
                ],
                command: ['/bin/bash', '-c'],
                args: [
                  `#! /bin/bash

set -ex -o pipefail

# Install required tools FIRST
echo "Installing required tools..."
apt-get update -qq || { echo "ERROR: apt-get update failed"; exit 1; }
apt-get install -y -qq curl netcat-openbsd software-properties-common wget jq libcap2-bin || { echo "ERROR: package installation failed"; exit 1; }

# Install Vault CLI
echo "Installing Vault CLI..."
wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor > /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" > /etc/apt/sources.list.d/hashicorp.list
apt-get update
apt-get install vault -y
setcap cap_ipc_lock= /usr/bin/vault

# Install kubectl
echo "Installing kubectl..."
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" || { echo "ERROR: kubectl download failed"; exit 1; }
chmod +x kubectl
mv kubectl /usr/local/bin/

echo "Tools installed successfully. Checking connectivity..."

echo "Waiting for Vault to be ready for initialization or unsealing..."
ATTEMPTS=0
MAX_ATTEMPTS=24 # 24 * 10s = 120s = 4 minutes
while true; do
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://vault:8200/v1/sys/health)
  # 501 = not initialized (ready for init), 503 = sealed (ready for unseal), 200 = ready
  if [ "$HTTP_CODE" = "501" ] || [ "$HTTP_CODE" = "503" ] || [ "$HTTP_CODE" = "200" ]; then
    echo "Vault is ready (HTTP $HTTP_CODE)"
    break
  fi
  
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -gt "$MAX_ATTEMPTS" ]; then
    echo "Error: Timed out waiting for Vault to become ready. Last HTTP code: $HTTP_CODE"
    exit 1
  fi
  echo "Vault not ready yet (HTTP $HTTP_CODE, attempt $ATTEMPTS/$MAX_ATTEMPTS). Retrying in 10 seconds..."
  sleep 10
done

echo "Checking Vault initialization status..."

# Check vault status via API
STATUS=$(curl -s http://vault:8200/v1/sys/health || echo '{"initialized":false,"sealed":true}')
INITIALIZED=$(echo $STATUS | grep -o '"initialized":[^,}]*' | cut -d: -f2 | tr -d '"')
SEALED=$(echo $STATUS | grep -o '"sealed":[^,}]*' | cut -d: -f2 | tr -d '"')

echo "Vault status: initialized=$INITIALIZED, sealed=$SEALED"

# If vault is unsealed, we're done
if [ "$SEALED" = "false" ]; then
  echo "Vault is already unsealed and ready"
  exit 0
fi

# If vault is initialized but sealed, try to unseal
if [ "$INITIALIZED" = "true" ]; then
  echo "Vault is initialized but sealed. Checking for existing unseal key..."
  
  if kubectl get secret vault-unseal-key -n vault >/dev/null 2>&1; then
    echo "Found existing unseal key, unsealing vault..."
    UNSEAL_KEY=$(kubectl get secret vault-unseal-key -n vault -o jsonpath='{.data.key}' | base64 -d)
    
    # Unseal via API
    UNSEAL_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "{\\"key\\":\\"$UNSEAL_KEY\\"}" http://vault:8200/v1/sys/unseal 2>/dev/null)
    if echo $UNSEAL_RESPONSE | grep -q '"sealed":false'; then
      echo "Vault unsealed successfully!"
      exit 0
    else
      echo "Failed to unseal vault with stored key"
      exit 1
    fi
  else
    echo "No unseal key found. Vault was initialized externally."
    echo "For development environment, clearing vault data to allow re-initialization..."
    
    # Find and delete the PVC associated with the vault-0 pod
    PVC_NAME=$(kubectl get pod vault-0 -n vault -o jsonpath='{.spec.volumes[?(@.persistentVolumeClaim)].persistentVolumeClaim.claimName}' 2>/dev/null)

    if [ -n "$PVC_NAME" ]; then
      echo "Found PVC '$PVC_NAME', deleting it to clear Vault state..."
      kubectl delete pvc "$PVC_NAME" -n vault
    else
      echo "No PVC found attached to pod vault-0. Skipping PVC deletion."
    fi

    # Now, force-delete the pod to trigger a restart with a fresh volume
    echo "Deleting pod vault-0 to reset its state..."
    kubectl delete pod vault-0 -n vault --force --grace-period=0
    
    # Wait for the pod to be recreated
    echo "Waiting for vault pod to be recreated..."
    sleep 10
    kubectl wait --for=jsonpath='{.status.phase}'=Running pod/vault-0 -n vault --timeout=120s
    
    # Wait for vault service to be available again
    echo "Waiting for vault service to be available after restart..."
    sleep 5
    until nc -z vault 8200 2>/dev/null; do
      echo "Waiting for vault service..."
      sleep 5
    done
    
    echo "Vault restarted. Checking if it's now uninitialized..."
    # Re-check vault status after restart
    STATUS=$(curl -s http://vault:8200/v1/sys/health 2>/dev/null || echo '{"initialized":false,"sealed":true}')
    INITIALIZED=$(echo $STATUS | grep -o '"initialized":[^,}]*' | cut -d: -f2 | tr -d '"')
    
    if [ "$INITIALIZED" = "false" ]; then
      echo "Vault is now uninitialized. Proceeding with initialization..."
    else
      echo "Vault is still initialized after restart. Manual intervention required."
      exit 1
    fi
  fi
fi

# Vault is not initialized, initialize it
echo "Vault is not initialized. Initializing now..."
set +x # Disable logging for the next command
INIT_RESPONSE=$(vault operator init -format=json -key-shares=1 -key-threshold=1)
set -x # Re-enable logging

if [ -z "$INIT_RESPONSE" ]; then
  echo "Failed to initialize vault. The init command returned no output."
  exit 1
fi

# Extract keys from response using jq, with logging disabled
set +x
UNSEAL_KEY=$(echo "$INIT_RESPONSE" | jq -r .unseal_keys_b64[0])
ROOT_TOKEN=$(echo "$INIT_RESPONSE" | jq -r .root_token)
set -x

if [ -z "$UNSEAL_KEY" ] || [ "$UNSEAL_KEY" = "null" ]; then
  echo "Failed to extract unseal key from init response."
  exit 1
fi

echo "Unsealing Vault..."
set +x # Disable logging for the unseal command
vault operator unseal "$UNSEAL_KEY"
UNSEAL_EXIT_CODE=$?
set -x # Re-enable logging

if [ $UNSEAL_EXIT_CODE -ne 0 ]; then
  echo "Failed to unseal vault. Manual intervention required."
  exit 1
fi
echo "Vault unsealed successfully!"

echo "Storing credentials in Kubernetes secrets..."
# The following commands are safe because the secret is piped, not part of the command args
echo -n "$UNSEAL_KEY" | kubectl create secret generic vault-unseal-key \\
  --from-file=key=/dev/stdin \\
  --namespace=vault \\
  --dry-run=client -o yaml | kubectl apply -f -

echo -n "$ROOT_TOKEN" | kubectl create secret generic vault-root-token \\
  --from-file=token=/dev/stdin \\
  --namespace=vault \\
  --dry-run=client -o yaml | kubectl apply -f -

echo "Vault initialization completed successfully!"`,
                ],
              },
            ],
          },
        },
      },
    });
  }
}