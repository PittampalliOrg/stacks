import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

export interface DNSHealthChartProps extends ChartProps {
  // Domains to test for DNS resolution
  testDomains?: string[];
  // Namespace to run the health check
  namespace?: string;
}

export class DNSHealthChart extends Chart {
  constructor(scope: Construct, id: string, props: DNSHealthChartProps = {}) {
    super(scope, id, props);

    const namespace = props.namespace || 'argocd';
    const testDomains = props.testDomains || [
      'github.com',
      'charts.loft.sh',
      'vault.azure.net',
      'api.github.com',
      '8.8.8.8'  // Test direct IP as well
    ];

    // DNS Health Check Job - runs as PreSync hook
    new k8s.KubeJob(this, 'dns-health-check', {
      metadata: {
        name: 'dns-health-check',
        namespace: namespace,
        labels: {
          'app.kubernetes.io/name': 'dns-health-check',
          'app.kubernetes.io/managed-by': 'cdk8s'
        },
        annotations: {
          'argocd.argoproj.io/hook': 'PreSync',
          'argocd.argoproj.io/sync-wave': '-5',
          'argocd.argoproj.io/hook-delete-policy': 'HookSucceeded'
        }
      },
      spec: {
        backoffLimit: 3,
        ttlSecondsAfterFinished: 300,  // Clean up after 5 minutes
        template: {
          metadata: {
            labels: {
              'app.kubernetes.io/name': 'dns-health-check'
            }
          },
          spec: {
            restartPolicy: 'OnFailure',
            containers: [{
              name: 'dns-check',
              image: 'busybox:1.36',
              command: ['sh', '-c'],
              args: [`
set -e
echo "Starting DNS health check..."
echo "Testing DNS resolution for critical domains..."
echo ""

failed=0
for domain in ${testDomains.join(' ')}; do
  echo -n "Testing $domain... "
  if nslookup $domain >/dev/null 2>&1; then
    echo "✓ OK"
  else
    echo "✗ FAILED"
    failed=$((failed + 1))
  fi
done

echo ""
if [ $failed -gt 0 ]; then
  echo "DNS health check FAILED: $failed domains could not be resolved"
  echo "This may cause issues with:"
  echo "- Pulling Helm charts"
  echo "- Accessing GitHub repositories"
  echo "- Connecting to Azure services"
  exit 1
else
  echo "DNS health check PASSED: All domains resolved successfully"
fi
              `]
            }]
          }
        }
      }
    });

    // DNS Resolution ConfigMap for debugging
    new k8s.KubeConfigMap(this, 'dns-test-commands', {
      metadata: {
        name: 'dns-test-commands',
        namespace: namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-5'
        }
      },
      data: {
        'test-dns.sh': `#!/bin/bash
# DNS debugging commands
echo "=== DNS Configuration ==="
cat /etc/resolv.conf

echo -e "\n=== Testing External Domains ==="
for domain in ${testDomains.join(' ')}; do
  echo -e "\nTesting $domain:"
  nslookup $domain || echo "Failed to resolve $domain"
done

echo -e "\n=== Testing Kubernetes DNS ==="
nslookup kubernetes.default.svc.cluster.local
`,
        'fix-dns.sh': `#!/bin/bash
# Emergency DNS fix commands
echo "If DNS is failing, run these commands:"
echo ""
echo "1. Check CoreDNS pods:"
echo "   kubectl get pods -n kube-system -l k8s-app=kube-dns"
echo ""
echo "2. Restart CoreDNS:"
echo "   kubectl rollout restart deployment coredns -n kube-system"
echo ""
echo "3. Check CoreDNS logs:"
echo "   kubectl logs -n kube-system -l k8s-app=kube-dns --tail=50"
echo ""
echo "4. Apply DNS fix manually:"
echo "   kubectl apply -f dist/0000-critical-infra.k8s.yaml"
`
      }
    });
  }
}