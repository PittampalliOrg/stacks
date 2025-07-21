import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

export interface DnsValidationChartProps extends ChartProps {
  // Domains to validate
  testDomains?: string[];
  // Namespace to create the validation resources
  namespace?: string;
  // Sync wave for the validation
  syncWave?: string;
}

/**
 * Creates DNS validation resources that can be used as PreSync hooks
 * This ensures DNS is working before attempting Git operations
 */
export class DnsValidationChart extends Chart {
  constructor(scope: Construct, id: string, props: DnsValidationChartProps = {}) {
    super(scope, id, props);

    const testDomains = props.testDomains || ['github.com', 'api.github.com'];
    const namespace = props.namespace || 'argocd';
    const syncWave = props.syncWave || '-5';

    // Create ServiceAccount for DNS validation
    new k8s.KubeServiceAccount(this, 'dns-validator-sa', {
      metadata: {
        name: 'dns-validator',
        namespace: namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': syncWave
        }
      }
    });

    // Create Role for reading DNS ready status
    new k8s.KubeRole(this, 'dns-validator-role', {
      metadata: {
        name: 'dns-validator',
        namespace: 'kube-system',
        annotations: {
          'argocd.argoproj.io/sync-wave': syncWave
        }
      },
      rules: [
        {
          apiGroups: [''],
          resources: ['configmaps'],
          resourceNames: ['dns-ready'],
          verbs: ['get', 'list']
        }
      ]
    });

    // Create RoleBinding
    new k8s.KubeRoleBinding(this, 'dns-validator-binding', {
      metadata: {
        name: 'dns-validator',
        namespace: 'kube-system',
        annotations: {
          'argocd.argoproj.io/sync-wave': syncWave
        }
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: 'dns-validator'
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'dns-validator',
          namespace: namespace
        }
      ]
    });

    // Create DNS validation Job template
    this.createDnsValidationJob('presync', testDomains, namespace, syncWave);
  }

  private createDnsValidationJob(name: string, domains: string[], namespace: string, syncWave: string) {
    new k8s.KubeJob(this, `dns-validation-${name}`, {
      metadata: {
        name: `dns-validation-${name}`,
        namespace: namespace,
        annotations: {
          'argocd.argoproj.io/hook': 'PreSync',
          'argocd.argoproj.io/hook-delete-policy': 'HookSucceeded',
          'argocd.argoproj.io/sync-wave': syncWave
        }
      },
      spec: {
        ttlSecondsAfterFinished: 300,
        backoffLimit: 10,  // More retries for DNS
        template: {
          spec: {
            serviceAccountName: 'dns-validator',
            restartPolicy: 'OnFailure',
            containers: [
              {
                name: 'validator',
                image: 'bitnami/kubectl:1.28',
                command: ['/bin/bash'],
                args: [
                  '-c',
                  `#!/bin/bash
set -e

echo "DNS Validation PreSync Hook"
echo "==========================="

# First check if DNS ready flag is set
echo "Checking DNS ready status..."
for i in {1..30}; do
  DNS_READY=$(kubectl get configmap dns-ready -n kube-system -o jsonpath='{.data.ready}' 2>/dev/null || echo "false")
  if [ "$DNS_READY" = "true" ]; then
    echo "✓ DNS is marked as ready"
    break
  fi
  echo "Waiting for DNS to be ready... ($i/30)"
  sleep 10
done

# Test actual DNS resolution
echo ""
echo "Testing DNS resolution..."
FAILED=false
for domain in ${domains.join(' ')}; do
  echo -n "Testing $domain... "
  if nslookup "$domain" > /dev/null 2>&1; then
    echo "✓ OK"
  else
    echo "✗ FAILED"
    FAILED=true
  fi
done

if [ "$FAILED" = "true" ]; then
  echo ""
  echo "ERROR: DNS validation failed. Some domains could not be resolved."
  echo "This may prevent Git operations from succeeding."
  exit 1
fi

echo ""
echo "✓ All DNS validations passed"
`
                ]
              }
            ]
          }
        }
      }
    });
  }

  /**
   * Creates a reusable DNS validation job that can be included in any application
   */
  public static createValidationJob(scope: Construct, id: string, props: {
    namespace: string;
    domains?: string[];
    syncWave?: string;
  }): k8s.KubeJob {
    const domains = props.domains || ['github.com'];
    const syncWave = props.syncWave || '-1';

    return new k8s.KubeJob(scope, id, {
      metadata: {
        generateName: 'dns-check-',
        namespace: props.namespace,
        annotations: {
          'argocd.argoproj.io/hook': 'PreSync',
          'argocd.argoproj.io/hook-delete-policy': 'HookSucceeded',
          'argocd.argoproj.io/sync-wave': syncWave
        }
      },
      spec: {
        ttlSecondsAfterFinished: 60,
        backoffLimit: 3,
        template: {
          spec: {
            restartPolicy: 'Never',
            containers: [
              {
                name: 'dns-check',
                image: 'busybox:1.36',
                command: ['/bin/sh'],
                args: [
                  '-c',
                  `echo "Quick DNS check for ${domains.join(', ')}..."
for domain in ${domains.join(' ')}; do
  if ! nslookup "$domain" > /dev/null 2>&1; then
    echo "ERROR: Cannot resolve $domain"
    exit 1
  fi
done
echo "✓ DNS check passed"`
                ]
              }
            ]
          }
        }
      }
    });
  }
}