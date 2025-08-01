import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../../imports/k8s';

export interface VaultUnsealerChartProps extends ChartProps {
  namespace?: string;
}

export class VaultUnsealerChart extends Chart {
  constructor(scope: Construct, id: string, props: VaultUnsealerChartProps = {}) {
    super(scope, id, props);

    const namespace = props.namespace || 'vault';

    new k8s.KubeDeployment(this, 'vault-unsealer', {
      metadata: {
        name: 'vault-unsealer',
        namespace: namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '2',
        },
        labels: {
          app: 'vault-unsealer',
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: 'vault-unsealer',
          },
        },
        template: {
          metadata: {
            labels: {
              app: 'vault-unsealer',
            },
          },
          spec: {
            serviceAccountName: 'vault-init',
            restartPolicy: 'Always',
            containers: [
              {
                name: 'vault-unsealer',
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

set -e -o pipefail

# Install required tools
echo "Installing required tools..."
apt-get update -qq
apt-get install -y -qq curl jq

# Install kubectl
echo "Installing kubectl..."
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
mv kubectl /usr/local/bin/

echo "Vault unsealer started. Monitoring Vault status..."

# Function to check and unseal vault
check_and_unseal() {
  local http_code=$(curl -s -o /dev/null -w '%{http_code}' http://vault:8200/v1/sys/health 2>/dev/null || echo "000")
  
  case $http_code in
    200|429)
      echo "$(date): Vault is unsealed and ready (HTTP $http_code)"
      return 0
      ;;
    503)
      echo "$(date): Vault is sealed (HTTP $http_code), attempting to unseal..."
      
      # Check if unseal key exists
      if kubectl get secret vault-unseal-key -n vault >/dev/null 2>&1; then
        UNSEAL_KEY=$(kubectl get secret vault-unseal-key -n vault -o jsonpath='{.data.key}' | base64 -d)
        
        # Attempt to unseal
        UNSEAL_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" \\
          -d "{\\"key\\":\\"$UNSEAL_KEY\\"}" \\
          http://vault:8200/v1/sys/unseal 2>/dev/null)
        
        if echo "$UNSEAL_RESPONSE" | jq -r '.sealed' 2>/dev/null | grep -q "false"; then
          echo "$(date): Successfully unsealed Vault!"
          return 0
        else
          echo "$(date): Failed to unseal Vault. Response: $UNSEAL_RESPONSE"
          return 1
        fi
      else
        echo "$(date): No unseal key found in vault-unseal-key secret"
        return 1
      fi
      ;;
    501)
      echo "$(date): Vault is not initialized (HTTP $http_code)"
      return 1
      ;;
    000)
      echo "$(date): Vault is not reachable"
      return 1
      ;;
    *)
      echo "$(date): Vault returned unexpected status (HTTP $http_code)"
      return 1
      ;;
  esac
}

# Main monitoring loop
while true; do
  if ! check_and_unseal; then
    echo "$(date): Vault check failed, will retry in 30 seconds..."
  fi
  sleep 30
done`,
                ],
                resources: {
                  requests: {
                    memory: k8s.Quantity.fromString('64Mi'),
                    cpu: k8s.Quantity.fromString('50m'),
                  },
                  limits: {
                    memory: k8s.Quantity.fromString('128Mi'),
                    cpu: k8s.Quantity.fromString('100m'),
                  },
                },
                livenessProbe: {
                  exec: {
                    command: [
                      '/bin/bash',
                      '-c',
                      'curl -s http://vault:8200/v1/sys/health >/dev/null',
                    ],
                  },
                  initialDelaySeconds: 60,
                  periodSeconds: 60,
                  timeoutSeconds: 10,
                  failureThreshold: 3,
                },
                readinessProbe: {
                  exec: {
                    command: [
                      '/bin/bash',
                      '-c',
                      'curl -s http://vault:8200/v1/sys/health >/dev/null',
                    ],
                  },
                  initialDelaySeconds: 30,
                  periodSeconds: 30,
                  timeoutSeconds: 5,
                  failureThreshold: 2,
                },
              },
            ],
          },
        },
      },
    });
  }
}