import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

export interface CriticalInfraChartProps extends ChartProps {
  // DNS servers to use for forwarding
  dnsServers?: string[];
  // Enable DNS patch job
  enableDnsPatch?: boolean;
}

export class CriticalInfraChart extends Chart {
  constructor(scope: Construct, id: string, props: CriticalInfraChartProps = {}) {
    super(scope, id, props);

    const dnsServers = props.dnsServers || ['8.8.8.8', '8.8.4.4'];
    const enableDnsPatch = props.enableDnsPatch ?? true;

    // Create a ServiceAccount for DNS configuration
    const dnsConfigSa = new k8s.KubeServiceAccount(this, 'dns-config-sa', {
      metadata: {
        name: 'dns-config-sa',
        namespace: 'kube-system',
        annotations: {
          'argocd.argoproj.io/sync-wave': '-11'
        }
      }
    });

    // Create Role for DNS configuration
    new k8s.KubeRole(this, 'dns-config-role', {
      metadata: {
        name: 'dns-config-role',
        namespace: 'kube-system',
        annotations: {
          'argocd.argoproj.io/sync-wave': '-11'
        }
      },
      rules: [
        {
          apiGroups: [''],
          resources: ['configmaps'],
          resourceNames: ['coredns'],
          verbs: ['get', 'update', 'patch']
        },
        {
          apiGroups: ['apps'],
          resources: ['deployments'],
          resourceNames: ['coredns'],
          verbs: ['get', 'patch']
        },
        {
          apiGroups: [''],
          resources: ['pods'],
          verbs: ['get', 'list']
        }
      ]
    });

    // Create RoleBinding
    new k8s.KubeRoleBinding(this, 'dns-config-rolebinding', {
      metadata: {
        name: 'dns-config-rolebinding',
        namespace: 'kube-system',
        annotations: {
          'argocd.argoproj.io/sync-wave': '-11'
        }
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: 'dns-config-role'
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'dns-config-sa',
          namespace: 'kube-system'
        }
      ]
    });

    // CoreDNS ConfigMap with resilient DNS configuration
    // This MUST be deployed before any resources that need external DNS resolution
    new k8s.KubeConfigMap(this, 'coredns', {
      metadata: {
        name: 'coredns',
        namespace: 'kube-system',
        annotations: {
          'argocd.argoproj.io/sync-wave': '-10',  // Earliest sync wave
          'argocd.argoproj.io/sync-options': 'Replace=true,PruneLast=true',
          'argocd.argoproj.io/compare-options': 'IgnoreExtraneous'
        },
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'app.kubernetes.io/part-of': 'critical-infra'
        }
      },
      data: {
        Corefile: `.:53 {
    errors
    health {
       lameduck 5s
    }
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {
       pods insecure
       fallthrough in-addr.arpa ip6.arpa
       ttl 30
    }
    prometheus :9153
    forward . ${dnsServers.join(' ')} {
       max_concurrent 1000
       prefer_udp
    }
    cache 30
    loop
    reload
    loadbalance
}`
      }
    });

    // Create a ConfigMap to signal DNS readiness
    new k8s.KubeConfigMap(this, 'dns-ready', {
      metadata: {
        name: 'dns-ready',
        namespace: 'kube-system',
        annotations: {
          'argocd.argoproj.io/sync-wave': '-8'
        }
      },
      data: {
        'ready': 'false',  // Will be updated by the patch job
        'dns-servers': dnsServers.join(',')
      }
    });

    if (enableDnsPatch) {
      // Job to ensure DNS is properly configured
      // This runs as a PostSync hook to patch CoreDNS after it's deployed
      new k8s.KubeJob(this, 'dns-patch-job', {
        metadata: {
          name: 'dns-patch-job',
          namespace: 'kube-system',
          annotations: {
            'argocd.argoproj.io/hook': 'PostSync',
            'argocd.argoproj.io/hook-delete-policy': 'HookSucceeded',
            'argocd.argoproj.io/sync-wave': '-9'
          }
        },
        spec: {
          ttlSecondsAfterFinished: 60,
          backoffLimit: 3,
          template: {
            spec: {
              serviceAccountName: dnsConfigSa.name,
              restartPolicy: 'OnFailure',
              containers: [
                {
                  name: 'dns-patcher',
                  image: 'bitnami/kubectl:1.31',
                  command: ['/bin/bash'],
                  args: [
                    '-c',
                    `
set -e
echo "Checking CoreDNS configuration..."

# Check if CoreDNS is using the correct configuration
CURRENT_CONFIG=$(kubectl get configmap coredns -n kube-system -o jsonpath='{.data.Corefile}')

if [[ "$CURRENT_CONFIG" == *"forward . ${dnsServers.join(' ')}"* ]]; then
  echo "CoreDNS is already configured correctly"
else
  echo "CoreDNS needs reconfiguration, restarting deployment..."
  kubectl rollout restart deployment coredns -n kube-system
  kubectl rollout status deployment coredns -n kube-system --timeout=60s
fi

# Test DNS resolution
echo "Testing DNS resolution..."
for i in {1..5}; do
  if nslookup github.com > /dev/null 2>&1; then
    echo "✓ DNS resolution is working"
    # Update the ready ConfigMap
    kubectl patch configmap dns-ready -n kube-system --patch '{"data":{"ready":"true"}}'
    exit 0
  fi
  echo "DNS test attempt $i failed, waiting..."
  sleep 2
done

echo "ERROR: DNS resolution test failed"
exit 1
`
                  ]
                }
              ]
            }
          }
        }
      });
    }

    // Local storage provisioner for Kind clusters
    // This ensures PVCs can be satisfied in local development
    new k8s.KubeStorageClass(this, 'local-path', {
      metadata: {
        name: 'local-path',
        annotations: {
          'storageclass.kubernetes.io/is-default-class': 'true',
          'argocd.argoproj.io/sync-wave': '-9'
        }
      },
      provisioner: 'rancher.io/local-path',
      reclaimPolicy: 'Delete',
      volumeBindingMode: 'WaitForFirstConsumer'
    });

    // Critical namespaces that other resources depend on
    const criticalNamespaces = ['argocd', 'external-secrets', 'kube-system'];
    
    criticalNamespaces.forEach(ns => {
      if (ns !== 'kube-system') { // kube-system already exists
        new k8s.KubeNamespace(this, `ns-${ns}`, {
          metadata: {
            name: ns,
            annotations: {
              'argocd.argoproj.io/sync-wave': '-9'
            },
            labels: {
              'app.kubernetes.io/managed-by': 'cdk8s',
              'app.kubernetes.io/part-of': 'critical-infra'
            }
          }
        });
      }
    });

    // DNS validation Job that runs as PreSync hook
    new k8s.KubeJob(this, 'dns-validation-job', {
      metadata: {
        name: 'dns-validation-pre',
        namespace: 'kube-system',
        annotations: {
          'argocd.argoproj.io/hook': 'PreSync',
          'argocd.argoproj.io/hook-delete-policy': 'HookSucceeded',
          'argocd.argoproj.io/sync-wave': '-8'
        }
      },
      spec: {
        ttlSecondsAfterFinished: 60,
        backoffLimit: 1,
        template: {
          spec: {
            restartPolicy: 'Never',
            containers: [
              {
                name: 'dns-validator',
                image: 'busybox:1.36',
                command: ['/bin/sh'],
                args: [
                  '-c',
                  `
echo "Pre-sync DNS validation..."
for domain in github.com api.github.com charts.loft.sh; do
  echo "Checking $domain..."
  nslookup $domain || echo "Warning: $domain resolution failed (this is expected on first run)"
done
echo "Pre-sync validation complete"
`
                ]
              }
            ]
          }
        }
      }
    });
  }
}