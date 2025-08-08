import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../../imports/k8s';
import * as images from '../../../.env-files/images.json';

/**
 * Chart that creates a bootstrap Job to ensure backstage image exists in Gitea
 * This solves the chicken-and-egg problem on initial cluster creation
 */
export class BackstageBootstrapChart extends Chart {
  constructor(scope: Construct, id: string, props?: ChartProps) {
    super(scope, id, props);

    // Get the image references for both dev and production
    const devImage = images.dev.backstage;
    const prodImage = images.production.backstage;

    // Parse the Gitea image reference
    const giteaRegistry = 'gitea.cnoe.localtest.me:8443';
    const giteaRepo = 'giteaadmin/backstage-cnoe';
    
    // Create a ConfigMap with the bootstrap script
    new k8s.KubeConfigMap(this, 'backstage-bootstrap-script', {
      metadata: {
        name: 'backstage-bootstrap-script',
        namespace: 'backstage',
        annotations: {
          'argocd.argoproj.io/sync-wave': '-30' // Run before secrets (-10) and deployment (20)
        }
      },
      data: {
        'bootstrap.sh': `#!/bin/bash
set -e

echo "Starting Backstage image bootstrap process..."

# Configuration
GITEA_REGISTRY="${giteaRegistry}"
GITEA_REPO="${giteaRepo}"
GHCR_IMAGE="${prodImage}"
TARGET_IMAGE="${devImage}"

# Extract tag from target image
TARGET_TAG=$(echo "$TARGET_IMAGE" | cut -d: -f2)
if [ -z "$TARGET_TAG" ] || [ "$TARGET_TAG" = "$TARGET_IMAGE" ]; then
  TARGET_TAG="latest"
fi

echo "Checking if image exists: $TARGET_IMAGE"

# Try to pull from Gitea first (anonymous pull for public images)
# No login needed for pulling public images
if docker pull "$TARGET_IMAGE" 2>/dev/null; then
  echo "Image already exists in Gitea registry: $TARGET_IMAGE"
  exit 0
fi

echo "Image not found in Gitea, bootstrapping from GHCR..."

# Login to GHCR for pulling source image
echo "Logging into GHCR..."
echo "$GHCR_PASSWORD" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin

# Pull from GHCR
echo "Pulling image from GHCR: $GHCR_IMAGE"
docker pull "$GHCR_IMAGE"

# Tag for Gitea
echo "Tagging image for Gitea: $TARGET_IMAGE"
docker tag "$GHCR_IMAGE" "$TARGET_IMAGE"

# Also tag as latest for convenience
LATEST_IMAGE="$GITEA_REGISTRY/$GITEA_REPO:latest"
docker tag "$GHCR_IMAGE" "$LATEST_IMAGE"

# Login to Gitea only for pushing (write operation requires auth)
echo "Logging into Gitea for push..."
echo "$GITEA_PASSWORD" | docker login "$GITEA_REGISTRY" -u "$GITEA_USERNAME" --password-stdin

# Push to Gitea
echo "Pushing image to Gitea: $TARGET_IMAGE"
docker push "$TARGET_IMAGE"
docker push "$LATEST_IMAGE"

echo "Bootstrap complete! Image is now available in Gitea registry."
`
      }
    });

    // Create the bootstrap Job
    new k8s.KubeJob(this, 'backstage-bootstrap-job', {
      metadata: {
        name: 'backstage-bootstrap',
        namespace: 'backstage',
        annotations: {
          'argocd.argoproj.io/hook': 'PreSync',
          'argocd.argoproj.io/hook-delete-policy': 'HookSucceeded',
          'argocd.argoproj.io/sync-wave': '-25' // After script ConfigMap but before secrets
        }
      },
      spec: {
        ttlSecondsAfterFinished: 300, // Clean up after 5 minutes
        backoffLimit: 3,
        template: {
          metadata: {
            name: 'backstage-bootstrap'
          },
          spec: {
            restartPolicy: 'OnFailure',
            // Use host's Docker daemon via DinD
            containers: [
              {
                name: 'bootstrap',
                image: 'docker:24.0.7-dind',
                command: ['/bin/sh'],
                args: ['/scripts/bootstrap.sh'],
                env: [
                  {
                    name: 'DOCKER_HOST',
                    value: 'tcp://localhost:2375'
                  },
                  {
                    name: 'GHCR_USERNAME',
                    valueFrom: {
                      secretKeyRef: {
                        name: 'ghcr-bootstrap-creds',
                        key: 'username'
                      }
                    }
                  },
                  {
                    name: 'GHCR_PASSWORD',
                    valueFrom: {
                      secretKeyRef: {
                        name: 'ghcr-bootstrap-creds',
                        key: 'password'
                      }
                    }
                  },
                  {
                    name: 'GITEA_USERNAME',
                    valueFrom: {
                      secretKeyRef: {
                        name: 'gitea-bootstrap-push-creds',
                        key: 'username'
                      }
                    }
                  },
                  {
                    name: 'GITEA_PASSWORD',
                    valueFrom: {
                      secretKeyRef: {
                        name: 'gitea-bootstrap-push-creds',
                        key: 'password'
                      }
                    }
                  }
                ],
                volumeMounts: [
                  {
                    name: 'scripts',
                    mountPath: '/scripts'
                  },
                  {
                    name: 'docker-sock',
                    mountPath: '/var/run/docker.sock'
                  }
                ],
                securityContext: {
                  privileged: true // Required for Docker operations
                }
              }
            ],
            volumes: [
              {
                name: 'scripts',
                configMap: {
                  name: 'backstage-bootstrap-script',
                  defaultMode: 0o755
                }
              },
              {
                name: 'docker-sock',
                hostPath: {
                  path: '/var/run/docker.sock',
                  type: 'Socket'
                }
              }
            ],
            // Add service account with necessary permissions
            serviceAccountName: 'backstage'
          }
        }
      }
    });

    // Create a simple Secret for GHCR bootstrap credentials
    // This uses a simpler approach than ExternalSecret for bootstrap reliability
    new k8s.KubeSecret(this, 'ghcr-bootstrap-creds', {
      metadata: {
        name: 'ghcr-bootstrap-creds',
        namespace: 'backstage',
        annotations: {
          'argocd.argoproj.io/sync-wave': '-35' // Create before bootstrap job
        }
      },
      stringData: {
        username: 'pittampalliorg',
        password: '${GITHUB_PAT}' // This should be replaced via sealed-secrets or external-secrets
      }
    });

    // Create minimal Gitea credentials just for push operations during bootstrap
    // Pull operations don't need auth for public images
    new k8s.KubeSecret(this, 'gitea-bootstrap-push-creds', {
      metadata: {
        name: 'gitea-bootstrap-push-creds',
        namespace: 'backstage',
        annotations: {
          'argocd.argoproj.io/sync-wave': '-35', // Create before bootstrap job
          'argocd.argoproj.io/hook': 'PreSync', // Only during initial sync
          'argocd.argoproj.io/hook-delete-policy': 'HookSucceeded' // Clean up after success
        }
      },
      stringData: {
        username: 'giteaAdmin',
        password: "52Txd;'r1g1tWI+h'u>kt8[.oGyTW,>Gesi!<&4r" // IDPBuilder default - only for push
      }
    });
  }
}