import { Chart, ChartProps, Helm, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { KubeNamespace, KubeSecret, KubeJob, KubeServiceAccount, KubeClusterRole, KubeClusterRoleBinding, Quantity } from '../imports/k8s';

export interface KargoHelmChartProps extends ChartProps {
  namespace?: string;
}

export class KargoHelmChart extends Chart {
  constructor(scope: Construct, id: string, props: KargoHelmChartProps = {}) {
    super(scope, id, props);

    const namespace = props.namespace || 'kargo';
    const baseHost = process.env.INGRESS_HOST || 'cnoe.localtest.me';
    const kargoHost = `kargo.${baseHost}`;

    // Create namespace
    new KubeNamespace(this, 'kargo-namespace', {
      metadata: {
        name: namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-20',
        },
        labels: {
          'app.kubernetes.io/name': 'kargo',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
      },
    });

    // Self-signed certificate valid for 10 years
    // Generated with:
    // openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    //   -keyout tls.key -out tls.crt \
    //   -subj "/CN=kargo-webhooks-server.kargo.svc" \
    //   -addext "subjectAltName=DNS:kargo-webhooks-server,DNS:kargo-webhooks-server.kargo,DNS:kargo-webhooks-server.kargo.svc,DNS:kargo-webhooks-server.kargo.svc.cluster.local"
    const tlsCert = 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUR5VENDQXJHZ0F3SUJBZ0lVR1pXU0xqYU5Cbkw1RHBuMFNhaVd5Q1F6aEJVd0RRWUpLb1pJaHZjTkFRRUwKQlFBd0tqRW9NQ1lHQTFVRUF3d2ZhMkZ5WjI4dGQyVmlhRzl2YTNNdGMyVnlkbVZ5TG10aGNtZHZMbk4yWXpBZQpGdzB5TlRBM01qZ3hOekl4TURGYUZ3MHpOVEEzTWpZeE56SXhNREZhTUNveEtEQW1CZ05WQkFNTUgydGhjbWR2CkxYZGxZbWh2YjJ0ekxYTmxjblpsY2k1cllYSm5ieTV6ZG1Nd2dnRWlNQTBHQ1NxR1NJYjNEUUVCQVFVQUE0SUIKRHdBd2dnRUtBb0lCQVFEbitkOVRqTkJBakdDOHN2alRBMWxIOExGRjAyYmw0ZjVIRCsyR2d2Qmk4WkRhcDd2Kwp4bm11cEpUVkhzdEk5L3Zmblc2eWdTU1lWWERpVUoxRUZQbUZiMTYyd2NzcW1idWNWN0N1N0JNUVlDVkFIbzZxCkZxem5TZ2lLU0VpUks2ZzYwdnV4SVF6Y21yaUpWNEhPQkFqSVhlWEJsZWZmL3VvMHNMaE9Jc3JVbFZzMnpCdmMKaHY3eDNoSXR6YWpFSldFTDBaa2l0ZjBsNDJDcmRvNHc2Nmd0eXJaNm93MEo4Ymh4UlZaekc5aTlLbWo2N0FDcgp5aFZnTWtGbmlhY2prUmVlUGF0ejBSM01ZVUk0YXBwRXlncXZ1eGpsQWNmSGJaRkxNVjJaVnlReW53VHl4SzdYClh6MVVuVjF6dVFiZUdUSENYNG5FWksxSzk2dmdOMndHWUMydkFnTUJBQUdqZ2VZd2dlTXdIUVlEVlIwT0JCWUUKRkg5bVpiS2I0RXA0b1gxVmozR1g1OGdNMjEwV01COEdBMVVkSXdRWU1CYUFGSDltWmJLYjRFcDRvWDFWajNHWAo1OGdNMjEwV01BOEdBMVVkRXdFQi93UUZNQU1CQWY4d2dZOEdBMVVkRVFTQmh6Q0JoSUlWYTJGeVoyOHRkMlZpCmFHOXZhM010YzJWeWRtVnlnaHRyWVhKbmJ5MTNaV0pvYjI5cmN5MXpaWEoyWlhJdWEyRnlaMitDSDJ0aGNtZHYKTFhkbFltaHZiMnR6TFhObGNuWmxjaTVyWVhKbmJ5NXpkbU9DTFd0aGNtZHZMWGRsWW1odmIydHpMWE5sY25abApjaTVyWVhKbmJ5NXpkbU11WTJ4MWMzUmxjaTVzYjJOaGJEQU5CZ2txaGtpRzl3MEJBUXNGQUFPQ0FRRUF6ZGJvClVRdVhyUEhUeFd3bVMzZXRRM09QQWFRcHhJb3JkdHhrSTdkVXhhNGJlaFI4ZWlidHJCUkdnaWtHZXZEL2NwWm8KeTJPUm5TQjRrMXBKWEhyUzdidUwzWHp4anRNN3FyQml5UzFGVzZMNFhkeHNnd3NhcGtVenF0VXFkZFIrZ3RuTgoycDh0TXJyZkZBQ1B0RjZwbEdsMTIwYkkxWkVYUGVDOGtqaEs3eGpyQm5wbDdRSUJIWkZjcjlWTmlXVHVMbVMxCmlqSW5Ib21rMWw4bDBuc1lKS0xRdUdpcjRwd1pRVWdTc0RCOUJjSllObjluYkw0emRhUzl5MHlEVFV1M3pVNWIKR0Q0Zi81U1FsaSt3TjhKTnZDL0pTUlhDV1pCMnpQQVdwcjV2ZXhJYy9iRHQ2MzA2d2E5SnU5czd6eTc1OWsrZwpacVExUU5KQVhuYUl2aTdCM2c9PQotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0tCg=='
    const tlsKey = 'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2d0lCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktrd2dnU2xBZ0VBQW9JQkFRRG4rZDlUak5CQWpHQzgKc3ZqVEExbEg4TEZGMDJibDRmNUhEKzJHZ3ZCaThaRGFwN3YreG5tdXBKVFZIc3RJOS92Zm5XNnlnU1NZVlhEaQpVSjFFRlBtRmIxNjJ3Y3NxbWJ1Y1Y3Q3U3Qk1RWUNWQUhvNnFGcXpuU2dpS1NFaVJLNmc2MHZ1eElRemNtcmlKClY0SE9CQWpJWGVYQmxlZmYvdW8wc0xoT0lzclVsVnMyekJ2Y2h2N3gzaEl0emFqRUpXRUwwWmtpdGYwbDQyQ3IKZG80dzY2Z3R5clo2b3cwSjhiaHhSVlp6RzlpOUttajY3QUNyeWhWZ01rRm5pYWNqa1JlZVBhdHowUjNNWVVJNAphcHBFeWdxdnV4amxBY2ZIYlpGTE1WMlpWeVF5bndUeXhLN1hYejFVblYxenVRYmVHVEhDWDRuRVpLMUs5NnZnCk4yd0dZQzJ2QWdNQkFBRUNnZ0VCQUtFVXZhTUNzTWxoc1ByWFBEa3FwaUJ5WG1haU9WMS81RlhzRlgvR0JLNXcKRjZuOXQybGU0TGdJeU9DRWxaeUJ0b0M4alZXZW40NjRKYjdCUTdNMjdWMWV6R0lUaDhSNUkvR1lZclBVY2hoNAo2dVR2VXhtQXpXZDkzUmhJd1RzdEdaQmZXUzdTU0dBWGYvUytzd0FmaFFtOVNnRjIycUNNSG8yZitSc294YmQrCi9HRFpxL3dYS1gvbmMxR1hTMWZCaGcwbnNWbG9ka1Z2SFhmZThXeWVlTXppbDdwZmJ1bG5pL3kzcm00cGc0a0UKVDNKZStmcjBTWGJ1b0MrUE12RzBNaGRVVzhFNkZ1S3QwYVl0NWMxb1VSdkQwZkFVdWtOOTJFbXhEakFmOHcvRwpocjlQOXF1T25yeU5LUFZHL0FydU9JVE1BL2JmTXNreGJwYWFiZDZJbldFQ2dZRUErZEdCNDVyZkJwTWtwTk9tCjJybkpyKzN4WXBDTG4ycm1ObzVXN21yeFV1UnRPanBHenoyZUFaZTRGNEJSQXFVN3pGL0ZteVJrc2FpRWtoWEIKaVRDTnhKSEZxM3RwM2p4aEh3cnpJV3h0NHJET2ZQQURLcThmRGtONmxYSVlIS2ZWVnZkSTJKdEhYNHp5eFBGSApVUDU5eDd6ZW1MSnRvOVZ3LzZ5dEJLajZrZDBDZ1lFQTdiZFhiR2UyQmxPRFlnRnB6eVg4TlNuRTh5Q3VGNG1YCkdveGtMZFA1Y3BaUzUvdThQNHh1YW03ZnNrSW4wMXRIc1ZaZkpMeHhJZ28ycmQzNFFaWXRMYTBqY2JxcjFSUzEKN08wbzYxWStnZThadHhnc0IvUVo0Y2xtVVNpVmt6QXdEQ1FWY1phS3lwRjd0Mjk1eC9RMHJOdEpySEpkeFFlYQoxZFEzNlJTdU12c0NnWUVBekxLQ3Y4RHk1aXhEWmx1VzZMbzdMTkRIYllBTEtBRXJ5YUF3VXdPRjRlb1NKaGdDClZXV2p4cUpPMGRMdWprQmVFMFNXWWwwYnRRYmtPZDloeWN2akhpSmoyZk14K0V0NU9UcDdwZk4yeHIwaE5QWmwKWWVCRWppZDBsbWY2b2VCVHl3S3N5ZS9TTjlVQ1I2VjhUajE1U3VUVGNFTWoyNDdWSEdxZENxaDdTSEVDZ1lFQQp2ZFZjQzBZSEpxWXFsV2xyaGZGZnAxVGo0d1NHQW1YdU5WVkg2eEVNYzJWNGI2bW9lMWM2RmVUVTN4WFZtQU9kCkRSRmNpWW16RHV2NUhuL1VjUXZzcUQxTHdOYkJ3amYzMEd6VDhKdSs3eVJ4OUxWbzlERUxPalFMY1dSbmpsTTkKQzNVRmF1QTlsZWI0VlZUQWU5Mlk4ekZyZERzZ2h1ZTd6bWJhLzFkMGhXRUNnWUFvMUp6eHF6b1VBWW5GTzVEeQpOZXNLd3FxL05qRHJ4ZFVkamkrRmE5WXd6aWNFY05TQ0JKWHY1Z0d2UkNGck9ldVVXcGQ4Wk0vMVZCWGc1aWJqCm1vN1drTVRwZ0luTHorNHdoTkJkVXB1QnlQWUVPdlZuMXFpS3hIWlJYZTJmMWFvUnhHb05pU2RmQUcwZXI2YXYKemZkYnNDRWRwRHNyWjN6QWJlSTZQT0lkcEE9PQotLS0tLUVORCBQUklWQVRFIEtFWS0tLS0tCg=='

    // Create the webhook server certificate secret
    new KubeSecret(this, 'kargo-webhooks-server-cert', {
      metadata: {
        name: 'kargo-webhooks-server-cert',
        namespace: namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '-15', // Deploy before Helm chart
        },
      },
      type: 'kubernetes.io/tls',
      data: {
        'tls.crt': tlsCert,
        'tls.key': tlsKey,
      },
    });

    // Deploy Kargo using Helm chart directly
    const kargoHelm = new Helm(this, 'kargo', {
      chart: 'oci://ghcr.io/akuity/kargo-charts/kargo',
      version: '1.6.1',
      namespace: namespace,
      releaseName: 'kargo',
      values: {
        api: {
          // IMPORTANT: Set the host to avoid conflict with other services
          host: kargoHost,
          // Admin account configuration - hardcoded for now, should use External Secrets
          adminAccount: {
            passwordHash: '$2a$10$Zrhhie4vLz5ygtVSaif6o.qN36jgs6vjtMBdM6yrU1FOeiAAMMxOm',
            tokenSigningKey: 'YvUGEEoD430TBHCfzrxVifl4RD6PkO',
            tokenTTL: '24h',
          },
          // Service configuration
          service: {
            type: 'ClusterIP',
            port: 8080,
          },
          // Enable gRPC web support for UI
          grpcWeb: true,
          // Logging
          logLevel: 'INFO',
          // TLS configuration - disable TLS and rely on ingress
          tls: {
            enabled: false,
          },
          // Ingress configuration
          ingress: {
            enabled: true,
            className: 'nginx',
            annotations: {
              'nginx.ingress.kubernetes.io/backend-protocol': 'HTTP',
              'nginx.ingress.kubernetes.io/grpc-backend': 'true',
            },
            tls: {
              enabled: false, // nginx already handles TLS termination
            },
          },
          // Resources
          resources: {
            requests: {
              cpu: '100m',
              memory: '128Mi',
            },
            limits: {
              cpu: '500m',
              memory: '256Mi',
            },
          },
        },
        // Controller configuration
        controller: {
          logLevel: 'INFO',
          resources: {
            requests: {
              cpu: '100m',
              memory: '128Mi',
            },
            limits: {
              cpu: '500m',
              memory: '512Mi',
            },
          },
          // Mount CA certificates for self-signed certificate trust
          volumes: [
            {
              name: 'ca-certificates',
              configMap: {
                name: 'gitea-ca-cert',
                items: [
                  {
                    key: 'ca.crt',
                    path: 'gitea-ca.crt'
                  }
                ]
              }
            }
          ],
          volumeMounts: [
            {
              name: 'ca-certificates',
              mountPath: '/etc/ssl/certs/gitea-ca.crt',
              subPath: 'gitea-ca.crt',
              readOnly: true
            }
          ],
          env: [
            {
              name: 'SSL_CERT_FILE',
              value: '/etc/ssl/certs/gitea-ca.crt'
            },
            {
              name: 'SSL_CERT_DIR',
              value: '/etc/ssl/certs'
            }
          ],
        },
        // Webhooks configuration - enable with custom certificates
        webhooksServer: {
          enabled: true,
          tls: {
            selfSignedCert: false,  // We provide our own certificate
          },
        },
        webhooks: {
          register: true,  // Enable webhook registration now that we have certificates
          logLevel: 'INFO',
          resources: {
            requests: {
              cpu: '100m',
              memory: '128Mi',
            },
            limits: {
              cpu: '200m',
              memory: '256Mi',
            },
          },
        },
        // Management controller configuration
        management: {
          logLevel: 'INFO',
          resources: {
            requests: {
              cpu: '50m',
              memory: '64Mi',
            },
            limits: {
              cpu: '100m',
              memory: '128Mi',
            },
          },
        },
        // Garbage collector configuration
        garbageCollector: {
          resources: {
            requests: {
              cpu: '50m',
              memory: '64Mi',
            },
            limits: {
              cpu: '100m',
              memory: '128Mi',
            },
          },
        },
        // External webhooks configuration
        externalWebhooksServer: {
          enabled: true,
          tls: {
            enabled: false,
          },
        },
        // Disable AWS-specific features for local development
        awsLoadBalancerController: {
          enabled: false,
        },
        // RBAC configuration
        rbac: {
          installClusterRoles: true,
          installClusterRoleBindings: true,
        },
        // Disable cert-manager certificate generation (not needed when TLS is disabled)
        certificates: {
          enabled: false,
        },
        // Additional annotations for all resources
        global: {
          annotations: {
            'app.kubernetes.io/managed-by': 'cdk8s',
          },
        },
      },
    });

    // Filter out cert-manager resources
    // Since we can't modify Helm chart's included resources directly,
    // we'll need to handle this at the manifest level.
    // The cert-manager annotations will remain but should be ignored
    // when cert-manager is not present.

    // Create service account for webhook patching
    new KubeServiceAccount(this, 'patch-webhook-sa', {
      metadata: {
        name: 'kargo-patch-webhook',
        namespace: namespace,
        annotations: {
          'argocd.argoproj.io/hook': 'PostSync',
          'argocd.argoproj.io/hook-delete-policy': 'HookSucceeded',
        },
      },
    });

    // Create cluster role for webhook patching
    new KubeClusterRole(this, 'patch-webhook-role', {
      metadata: {
        name: 'kargo-patch-webhook',
        annotations: {
          'argocd.argoproj.io/hook': 'PostSync',
          'argocd.argoproj.io/hook-delete-policy': 'HookSucceeded',
        },
      },
      rules: [
        {
          apiGroups: ['admissionregistration.k8s.io'],
          resources: ['validatingwebhookconfigurations', 'mutatingwebhookconfigurations'],
          verbs: ['get', 'list', 'patch', 'update'],
        },
        {
          apiGroups: [''],
          resources: ['secrets'],
          verbs: ['get'],
        },
      ],
    });

    // Create cluster role binding
    new KubeClusterRoleBinding(this, 'patch-webhook-binding', {
      metadata: {
        name: 'kargo-patch-webhook',
        annotations: {
          'argocd.argoproj.io/hook': 'PostSync',
          'argocd.argoproj.io/hook-delete-policy': 'HookSucceeded',
        },
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: 'kargo-patch-webhook',
      },
      subjects: [{
        kind: 'ServiceAccount',
        name: 'kargo-patch-webhook',
        namespace: namespace,
      }],
    });

    // Create PostSync hook job to patch webhooks
    new KubeJob(this, 'patch-webhook-ca', {
      metadata: {
        name: 'kargo-patch-webhook-ca',
        namespace: namespace,
        annotations: {
          'argocd.argoproj.io/hook': 'PostSync',
          'argocd.argoproj.io/hook-delete-policy': 'BeforeHookCreation',
        },
      },
      spec: {
        template: {
          metadata: {
            labels: {
              'app.kubernetes.io/name': 'kargo-patch-webhook',
              'app.kubernetes.io/component': 'job',
            },
          },
          spec: {
            serviceAccountName: 'kargo-patch-webhook',
            restartPolicy: 'OnFailure',
            containers: [{
              name: 'patch',
              image: 'bitnami/kubectl:latest',
              command: ['/bin/bash'],
              resources: {
                requests: {
                  cpu: Quantity.fromString('50m'),
                  memory: Quantity.fromString('64Mi'),
                },
                limits: {
                  cpu: Quantity.fromString('100m'),
                  memory: Quantity.fromString('128Mi'),
                },
              },
              args: [
                '-c',
                `
                set -e
                echo "Patching webhook configurations with CA bundle..."
                
                # Extract the CA certificate
                CA_CERT=$(kubectl get secret kargo-webhooks-server-cert -n ${namespace} -o jsonpath='{.data.tls\\.crt}')
                
                if [ -z "$CA_CERT" ]; then
                  echo "ERROR: Failed to extract CA certificate from secret"
                  exit 1
                fi
                
                # Wait for webhook configurations to exist
                echo "Waiting for webhook configurations..."
                for i in {1..60}; do
                  if kubectl get validatingwebhookconfiguration kargo >/dev/null 2>&1 && \\
                     kubectl get mutatingwebhookconfiguration kargo >/dev/null 2>&1; then
                    echo "Webhook configurations found!"
                    break
                  fi
                  echo "Waiting for webhook configurations... attempt $i/60"
                  sleep 5
                done
                
                # Patch validating webhook configuration
                echo "Patching validating webhook configuration..."
                # Get the number of webhooks
                WEBHOOK_COUNT=$(kubectl get validatingwebhookconfiguration kargo -o json | jq '.webhooks | length')
                echo "Found $WEBHOOK_COUNT validating webhooks"
                
                # Create patch for all webhooks
                PATCHES=""
                for i in $(seq 0 $((WEBHOOK_COUNT-1))); do
                  if [ -n "$PATCHES" ]; then
                    PATCHES="$PATCHES,"
                  fi
                  PATCHES="$PATCHES{\\"op\\": \\"add\\", \\"path\\": \\"/webhooks/$i/clientConfig/caBundle\\", \\"value\\": \\"$CA_CERT\\"}"
                done
                
                kubectl patch validatingwebhookconfiguration kargo --type='json' -p="[$PATCHES]"
                
                # Patch mutating webhook configuration
                echo "Patching mutating webhook configuration..."
                # Get the number of webhooks
                WEBHOOK_COUNT=$(kubectl get mutatingwebhookconfiguration kargo -o json | jq '.webhooks | length')
                echo "Found $WEBHOOK_COUNT mutating webhooks"
                
                # Create patch for all webhooks
                PATCHES=""
                for i in $(seq 0 $((WEBHOOK_COUNT-1))); do
                  if [ -n "$PATCHES" ]; then
                    PATCHES="$PATCHES,"
                  fi
                  PATCHES="$PATCHES{\\"op\\": \\"add\\", \\"path\\": \\"/webhooks/$i/clientConfig/caBundle\\", \\"value\\": \\"$CA_CERT\\"}"
                done
                
                kubectl patch mutatingwebhookconfiguration kargo --type='json' -p="[$PATCHES]"
                
                echo "Webhook configurations patched successfully"
                `
              ],
            }],
          },
        },
        backoffLimit: 3,
        activeDeadlineSeconds: 600, // 10 minutes timeout
      },
    });
  }
}