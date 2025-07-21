import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { ApiObject } from 'cdk8s';
import * as k8s from '../imports/k8s';

export class GrafanaSetupChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    // ExternalSecret to pull Grafana API token from Azure KeyVault
    // Note: grafana-api-token ExternalSecret for monitoring namespace is created in all-secrets-chart.ts

    // Also create one in mcp-servers namespace for the MCP server
    new ApiObject(this, 'grafana-api-token-mcp-external-secret', {
      apiVersion: 'external-secrets.io/v1',
      kind: 'ExternalSecret',
      metadata: {
        name: 'grafana-api-token',
        namespace: 'mcp-servers',
        annotations: {
          'argocd.argoproj.io/sync-wave': '10',
        },
      },
      spec: {
        secretStoreRef: {
          name: 'azure-keyvault-store',
          kind: 'ClusterSecretStore',
        },
        refreshInterval: '1h',
        target: {
          name: 'grafana-api-token',
          creationPolicy: 'Owner',
        },
        dataFrom: [
          {
            find: {
              name: {
                regexp: '^GRAFANA-API-KEY$',
              },
            },
          },
        ],
      },
    });

    // Token generation job resources
    const namespace = 'monitoring';
    
    // Create ServiceAccount for token generation
    const serviceAccount = new k8s.KubeServiceAccount(this, 'grafana-token-sa', {
      metadata: {
        name: 'grafana-token-generator',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '15',
        },
      },
    });

    // Grant permissions to create/update secrets in monitoring namespace
    const role = new k8s.KubeRole(this, 'grafana-token-role-monitoring', {
      metadata: {
        name: 'grafana-token-generator-monitoring',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '15',
        },
      },
      rules: [{
        apiGroups: [''],
        resources: ['secrets'],
        verbs: ['get', 'list', 'create', 'update', 'patch'],
      }],
    });

    // Bind role to service account
    new k8s.KubeRoleBinding(this, 'grafana-token-rb-monitoring', {
      metadata: {
        name: 'grafana-token-generator-monitoring',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '15',
        },
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: role.name,
      },
      subjects: [{
        kind: 'ServiceAccount',
        name: serviceAccount.name,
        namespace,
      }],
    });

    // Create Role in mcp-servers namespace for cross-namespace secret creation
    const mcpRole = new k8s.KubeRole(this, 'grafana-token-role-mcp-servers', {
      metadata: {
        name: 'grafana-token-generator-mcp',
        namespace: 'mcp-servers',
        annotations: {
          'argocd.argoproj.io/sync-wave': '15',
        },
      },
      rules: [{
        apiGroups: [''],
        resources: ['secrets'],
        verbs: ['get', 'list', 'create', 'update', 'patch'],
      }],
    });

    // Bind mcp-servers role to service account
    new k8s.KubeRoleBinding(this, 'grafana-token-rb-mcp-servers', {
      metadata: {
        name: 'grafana-token-generator-mcp',
        namespace: 'mcp-servers',
        annotations: {
          'argocd.argoproj.io/sync-wave': '15',
        },
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: mcpRole.name,
      },
      subjects: [{
        kind: 'ServiceAccount',
        name: serviceAccount.name,
        namespace,
      }],
    });

    // Create Role in nextjs namespace for cross-namespace secret creation
    const nextjsRole = new k8s.KubeRole(this, 'grafana-token-role-nextjs', {
      metadata: {
        name: 'grafana-token-generator-nextjs',
        namespace: 'nextjs',
        annotations: {
          'argocd.argoproj.io/sync-wave': '15',
        },
      },
      rules: [{
        apiGroups: [''],
        resources: ['secrets'],
        verbs: ['get', 'list', 'create', 'update', 'patch'],
      }],
    });

    // Bind nextjs role to service account
    new k8s.KubeRoleBinding(this, 'grafana-token-rb-nextjs', {
      metadata: {
        name: 'grafana-token-generator-nextjs',
        namespace: 'nextjs',
        annotations: {
          'argocd.argoproj.io/sync-wave': '15',
        },
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: nextjsRole.name,
      },
      subjects: [{
        kind: 'ServiceAccount',
        name: serviceAccount.name,
        namespace,
      }],
    });

    // Create ConfigMap with token generation script
    const scriptConfig = new k8s.KubeConfigMap(this, 'grafana-token-script', {
      metadata: {
        name: 'grafana-token-script',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '15',
        },
      },
      data: {
        'generate-token.sh': generateGrafanaTokenScript(),
      },
    });

    // Create Job as PostSync hook
    new k8s.KubeJob(this, 'grafana-token-job', {
      metadata: {
        name: 'grafana-token-generator',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '20',
          'argocd.argoproj.io/hook': 'PostSync',
          'argocd.argoproj.io/hook-delete-policy': 'BeforeHookCreation',
        },
      },
      spec: {
        ttlSecondsAfterFinished: 3600, // 1 hour
        backoffLimit: 3,
        template: {
          metadata: {
            labels: {
              'app': 'grafana-token-generator',
            },
          },
          spec: {
            serviceAccountName: serviceAccount.name,
            restartPolicy: 'Never',
            securityContext: {
              runAsUser: 1000,
              runAsGroup: 1000,
              fsGroup: 1000,
              runAsNonRoot: true,
            },
            containers: [{
              name: 'token-generator',
              image: 'alpine/k8s:1.28.3',
              command: ['/bin/sh'],
              args: ['/scripts/generate-token.sh'],
              resources: {
                requests: {
                  cpu: k8s.Quantity.fromString('100m'),
                  memory: k8s.Quantity.fromString('128Mi'),
                },
                limits: {
                  cpu: k8s.Quantity.fromString('500m'),
                  memory: k8s.Quantity.fromString('256Mi'),
                },
              },
              volumeMounts: [
                {
                  name: 'script',
                  mountPath: '/scripts',
                  readOnly: true,
                },
                {
                  name: 'tmp',
                  mountPath: '/tmp',
                },
              ],
              securityContext: {
                allowPrivilegeEscalation: false,
                readOnlyRootFilesystem: false,
                runAsNonRoot: true,
                runAsUser: 1000,
              },
            }],
            volumes: [
              {
                name: 'script',
                configMap: {
                  name: scriptConfig.name,
                  defaultMode: 0o755,
                },
              },
              {
                name: 'tmp',
                emptyDir: {
                  sizeLimit: k8s.Quantity.fromString('100Mi'),
                },
              },
            ],
          },
        },
      },
    });

    // ConfigMap with comprehensive token instructions
    new k8s.KubeConfigMap(this, 'grafana-token-instructions', {
      metadata: {
        name: 'grafana-token-instructions',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '15',
        },
      },
      data: {
        'README.md': GRAFANA_TOKEN_README,
      },
    });
  }
}

// Function to generate the token creation script
function generateGrafanaTokenScript(): string {
  const lines = [
    '#!/bin/sh',
    'set -e',
    '',
    'echo "Starting Grafana API token generation..."',
    '',
    '# Configuration',
    'GRAFANA_URL="http://grafana.monitoring.svc.cluster.local"',
    'GRAFANA_USER="admin"',
    'GRAFANA_PASSWORD="admin"',
    'SERVICE_ACCOUNT_NAME="mcp-server"',
    'TOKEN_NAME_PREFIX="MCP Server Token"',
    'MAX_RETRIES=30',
    'RETRY_INTERVAL=10',
    '',
    '# kubectl and curl are pre-installed in alpine/k8s image',
    '',
    '# Wait for Grafana to be ready',
    'echo "Waiting for Grafana to be ready..."',
    'for i in $(seq 1 $MAX_RETRIES); do',
    '  if curl -s -o /dev/null -w "%{http_code}" "$GRAFANA_URL/api/health" | grep -q "200"; then',
    '    echo "Grafana is ready!"',
    '    break',
    '  fi',
    '  echo "Attempt $i/$MAX_RETRIES: Grafana not ready yet, waiting $RETRY_INTERVAL seconds..."',
    '  sleep $RETRY_INTERVAL',
    '  if [ $i -eq $MAX_RETRIES ]; then',
    '    echo "Error: Grafana did not become ready within $(($MAX_RETRIES * $RETRY_INTERVAL)) seconds"',
    '    exit 1',
    '  fi',
    'done',
    '',
    '# Check if token already exists and is valid',
    'if kubectl get secret grafana-api-token -n monitoring >/dev/null 2>&1; then',
    '  echo "Checking existing token..."',
    '  EXISTING_TOKEN=$(kubectl get secret grafana-api-token -n monitoring -o jsonpath=\'{.data.token}\' | base64 -d)',
    '  if [ -n "$EXISTING_TOKEN" ]; then',
    '    if curl -s -H "Authorization: Bearer $EXISTING_TOKEN" "$GRAFANA_URL/api/org" | grep -q "id"; then',
    '      echo "Existing token is valid, no need to regenerate"',
    '      # Ensure it exists in all namespaces',
    '      kubectl get secret grafana-api-token -n mcp-servers >/dev/null 2>&1 || \\',
    '        kubectl create secret generic grafana-api-token \\',
    '          --from-literal=token="$EXISTING_TOKEN" \\',
    '          --from-literal=GRAFANA_API_TOKEN="$EXISTING_TOKEN" \\',
    '          --namespace=mcp-servers',
    '      kubectl get secret grafana-api-token -n nextjs >/dev/null 2>&1 || \\',
    '        kubectl create secret generic grafana-api-token \\',
    '          --from-literal=token="$EXISTING_TOKEN" \\',
    '          --from-literal=GRAFANA_API_KEY="$EXISTING_TOKEN" \\',
    '          --namespace=nextjs',
    '      exit 0',
    '    else',
    '      echo "Existing token is invalid, will create a new one"',
    '    fi',
    '  fi',
    'fi',
    '',
    '# Try to get password from secret if it exists',
    'if kubectl get secret kv-vault -n nextjs >/dev/null 2>&1; then',
    '  echo "Checking for Grafana admin password in KeyVault secret..."',
    '  KV_PASSWORD=$(kubectl get secret kv-vault -n nextjs -o jsonpath=\'{.data.GRAFANA-ADMIN-PASSWORD}\' 2>/dev/null | base64 -d || echo "")',
    '  if [ -n "$KV_PASSWORD" ]; then',
    '    GRAFANA_PASSWORD="$KV_PASSWORD"',
    '    echo "Using Grafana admin password from KeyVault"',
    '  fi',
    'fi',
    '',
    '# Check if service account exists',
    'echo "Checking for existing service account..."',
    'SA_LIST=$(curl -s "$GRAFANA_USER:$GRAFANA_PASSWORD@${GRAFANA_URL#http://}/api/serviceaccounts/search")',
    'SA_ID=$(echo "$SA_LIST" | grep -o \'"id":[0-9]*\' | grep -o \'[0-9]*\' | head -n 1 || echo "")',
    '',
    '# Check if we found the right service account',
    'if [ -n "$SA_ID" ]; then',
    '  SA_NAME=$(echo "$SA_LIST" | grep -B1 -A1 "\\"id\\":$SA_ID" | grep -o "\\"name\\":\\"[^\\"]*\\"" | cut -d\'"\' -f4)',
    '  if [ "$SA_NAME" != "$SERVICE_ACCOUNT_NAME" ]; then',
    '    echo "Found service account with ID $SA_ID but wrong name: $SA_NAME"',
    '    SA_ID=""',
    '  else',
    '    echo "Found existing service account: $SERVICE_ACCOUNT_NAME (ID: $SA_ID)"',
    '  fi',
    'fi',
    '',
    'if [ -z "$SA_ID" ]; then',
    '  echo "Creating service account \'$SERVICE_ACCOUNT_NAME\'..."',
    '  SA_RESPONSE=$(curl -s -X POST \\',
    '    -H "Content-Type: application/json" \\',
    '    -d "{\\"name\\":\\"$SERVICE_ACCOUNT_NAME\\",\\"role\\":\\"Admin\\",\\"isDisabled\\":false}" \\',
    '    "$GRAFANA_USER:$GRAFANA_PASSWORD@${GRAFANA_URL#http://}/api/serviceaccounts")',
    '  ',
    '  SA_ID=$(echo "$SA_RESPONSE" | grep -o \'"id":[0-9]*\' | grep -o \'[0-9]*\' || echo "")',
    '  ',
    '  if [ -z "$SA_ID" ]; then',
    '    echo "Failed to create service account. Response:"',
    '    echo "$SA_RESPONSE"',
    '    ',
    '    # Check if it\'s an authentication error',
    '    if echo "$SA_RESPONSE" | grep -q "401\\|Unauthorized"; then',
    '      echo "Authentication failed. The default admin password may have been changed."',
    '      echo "Please update the Grafana admin password in Azure KeyVault as \'GRAFANA-ADMIN-PASSWORD\'"',
    '    fi',
    '    exit 1',
    '  fi',
    '  echo "Service account created with ID: $SA_ID"',
    'fi',
    '',
    '# Generate unique token name with underscore instead of space',
    'TOKEN_NAME="${TOKEN_NAME_PREFIX}_$(date +%Y%m%d-%H%M%S)"',
    '',
    'echo "Creating token: $TOKEN_NAME"',
    'TOKEN_RESPONSE=$(curl -s -X POST \\',
    '  -H "Content-Type: application/json" \\',
    '  -d "{\\"name\\":\\"$TOKEN_NAME\\"}" \\',
    '  "$GRAFANA_USER:$GRAFANA_PASSWORD@${GRAFANA_URL#http://}/api/serviceaccounts/$SA_ID/tokens")',
    '',
    'TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o \'"key":"[^"]*"\' | cut -d\'"\' -f4 || echo "")',
    '',
    'if [ -z "$TOKEN" ]; then',
    '  echo "Failed to create token. Response:"',
    '  echo "$TOKEN_RESPONSE"',
    '  exit 1',
    'fi',
    '',
    'echo "Token created successfully!"',
    '',
    '# Store in Kubernetes secrets',
    'echo "Creating/updating Kubernetes secrets..."',
    'kubectl create secret generic grafana-api-token \\',
    '  --from-literal=token="$TOKEN" \\',
    '  --from-literal=GRAFANA_API_TOKEN="$TOKEN" \\',
    '  --namespace=monitoring \\',
    '  --dry-run=client -o yaml | kubectl apply -f -',
    '',
    'kubectl create secret generic grafana-api-token \\',
    '  --from-literal=token="$TOKEN" \\',
    '  --from-literal=GRAFANA_API_TOKEN="$TOKEN" \\',
    '  --namespace=mcp-servers \\',
    '  --dry-run=client -o yaml | kubectl apply -f -',
    '',
    'kubectl create secret generic grafana-api-token \\',
    '  --from-literal=token="$TOKEN" \\',
    '  --from-literal=GRAFANA_API_KEY="$TOKEN" \\',
    '  --namespace=nextjs \\',
    '  --dry-run=client -o yaml | kubectl apply -f -',
    '',
    'echo ""',
    'echo "✅ Grafana API token generation completed!"',
    'echo ""',
    'echo "Service Account: $SERVICE_ACCOUNT_NAME (ID: $SA_ID)"',
    'echo "Token Name: $TOKEN_NAME"',
    'echo ""',
    'echo "Token is stored in Kubernetes secrets (monitoring, mcp-servers, and nextjs namespaces)"',
  ];
  
  return lines.join('\n');
}

const GRAFANA_TOKEN_README = `# Grafana API Token Management

This directory contains resources for automated Grafana API token generation and management.

## Automated Token Generation

The grafana-token-generator job runs automatically as a PostSync hook after Grafana is deployed.

### How it works:

1. **Waits for Grafana** to be ready (up to 5 minutes)
2. **Checks for existing token** and validates it
3. **Creates service account** if it doesn't exist
4. **Generates new token** if needed
5. **Stores token** in Kubernetes secrets (monitoring, mcp-servers, and nextjs namespaces)

### Configuration:

- Service Account Name: mcp-server
- Role: Admin
- Token Expiration: No expiration (default)
- Namespaces: monitoring, mcp-servers, nextjs

## Manual Token Creation

If the automatic method fails or you need to create a token manually:

### Option 1: Using make command (from devcontainer)

\`\`\`bash
make grafana-token
\`\`\`

### Option 2: Manual creation via UI

1. Port-forward to Grafana:
   \`\`\`bash
   kubectl port-forward -n monitoring svc/grafana 3000:80
   \`\`\`

2. Access Grafana UI at http://localhost:3000 (admin/admin)

3. Go to Administration > Service accounts

4. Create a new service account named "mcp-server" with Admin role

5. Create a token for the service account

6. Store the token in Kubernetes:
   \`\`\`bash
   kubectl create secret generic grafana-api-token \\
     --from-literal=token="YOUR_TOKEN_HERE" \\
     --from-literal=GRAFANA_API_TOKEN="YOUR_TOKEN_HERE" \\
     --namespace=monitoring
   
   kubectl create secret generic grafana-api-token \\
     --from-literal=token="YOUR_TOKEN_HERE" \\
     --from-literal=GRAFANA_API_TOKEN="YOUR_TOKEN_HERE" \\
     --namespace=mcp-servers
   
   kubectl create secret generic grafana-api-token \\
     --from-literal=token="YOUR_TOKEN_HERE" \\
     --from-literal=GRAFANA_API_KEY="YOUR_TOKEN_HERE" \\
     --namespace=nextjs
   \`\`\`

## Regenerating Token

To force regeneration of the token:

\`\`\`bash
# Delete the existing job
kubectl delete job grafana-token-generator -n monitoring

# The job will be recreated on next ArgoCD sync
argocd app sync grafana-dashboards
\`\`\`

## Storing Grafana Admin Password

If you change the Grafana admin password, store it in Azure KeyVault:

\`\`\`bash
az keyvault secret set \\
  --vault-name "YOUR_KEYVAULT_NAME" \\
  --name "GRAFANA-ADMIN-PASSWORD" \\
  --value "YOUR_NEW_PASSWORD"
\`\`\`

The Job will automatically use this password instead of the default.

## Troubleshooting

### Check Job logs:
\`\`\`bash
kubectl logs -n monitoring job/grafana-token-generator
\`\`\`

### Check if token secrets exist:
\`\`\`bash
kubectl get secret grafana-api-token -n monitoring
kubectl get secret grafana-api-token -n mcp-servers
kubectl get secret grafana-api-token -n nextjs
\`\`\`

### Validate token:
\`\`\`bash
TOKEN=$(kubectl get secret grafana-api-token -n monitoring -o jsonpath='{.data.token}' | base64 -d)
curl -H "Authorization: Bearer \$TOKEN" http://grafana.monitoring.svc.cluster.local/api/org
\`\`\`

## External Secrets Integration

The mcp-servers namespace has an ExternalSecret that syncs from Azure KeyVault:
- Key in KeyVault: GRAFANA-API-KEY
- Updates every 1 hour
- Creates secret: grafana-api-token in mcp-servers namespace
`;