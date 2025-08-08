import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { Warehouse, Stage, WarehouseSpecFreightCreationPolicy, WarehouseSpecSubscriptionsImageImageSelectionStrategy, StageSpecRequestedFreightOriginKind } from '../imports/kargo.akuity.io';

export interface KargoBackstagePipelineChartProps extends ChartProps {
  gitBranch?: string;
  githubRepo?: string;
}

/**
 * Kargo Pipeline Chart for Backstage Application
 * Independent pipeline for promoting Backstage container images
 */
export class KargoBackstagePipelineChart extends Chart {
  constructor(scope: Construct, id: string, props: KargoBackstagePipelineChartProps = {}) {
    super(scope, id, props);

    const gitBranch = props.gitBranch || 'main';
    const githubRepo = props.githubRepo || 'https://github.com/PittampalliOrg/stacks.git';

    // Note: Project is now managed by kargo-pipelines-project-chart.ts

    // 2. Warehouse to monitor local Gitea registry for new Backstage images
    new Warehouse(this, 'backstage-warehouse', {
      metadata: {
        name: 'backstage-warehouse',
        namespace: 'kargo-pipelines',
        labels: {
          'app.kubernetes.io/name': 'backstage-warehouse',
          'app.kubernetes.io/part-of': 'kargo-pipelines',
          'app.kubernetes.io/component': 'warehouse'
        }
      },
      spec: {
        freightCreationPolicy: WarehouseSpecFreightCreationPolicy.AUTOMATIC,
        interval: '30s',
        subscriptions: [
          {
            image: {
              repoUrl: 'gitea.cnoe.localtest.me:8443/giteaadmin/backstage-cnoe',
              discoveryLimit: 10,
              imageSelectionStrategy: WarehouseSpecSubscriptionsImageImageSelectionStrategy.LEXICAL,
              allowTags: '^v\\d+.*',  // Tags starting with 'v' followed by digits (e.g., v124-dev)
              strictSemvers: false,  // Not applicable for LEXICAL strategy
              insecureSkipTlsVerify: true  // For dev environment with self-signed certificates
            }
          }
        ]
      }
    });

    // 3. Dev Stage - Auto-promotes from warehouse
    new Stage(this, 'dev-stage', {
      metadata: {
        name: 'backstage-dev',
        namespace: 'kargo-pipelines',
        labels: {
          'app.kubernetes.io/name': 'backstage-dev-stage',
          'app.kubernetes.io/part-of': 'kargo-pipelines',
          'app.kubernetes.io/component': 'stage'
        }
      },
      spec: {
        requestedFreight: [
          {
            origin: {
              kind: StageSpecRequestedFreightOriginKind.WAREHOUSE,
              name: 'backstage-warehouse'
            },
            sources: {
              direct: true
            }
          }
        ],
        promotionTemplate: {
          spec: {
            steps: [
              // GitHub promotion steps - commented out for testing Gitea approach
              {
                uses: 'git-clone',
                config: {
                  repoURL: githubRepo,
                  checkout: [
                    {
                      branch: gitBranch,
                      path: './repo'
                    }
                  ]
                }
              },
              {
                uses: 'json-update',
                config: {
                  path: './repo/.env-files/images.json',
                  updates: [
                    {
                      key: 'dev.backstage',
                      value: 'gitea.cnoe.localtest.me:8443/giteaadmin/backstage-cnoe:${{ imageFrom("gitea.cnoe.localtest.me:8443/giteaadmin/backstage-cnoe").Tag }}'
                    }
                  ]
                }
              },
              {
                uses: 'git-commit',
                config: {
                  path: './repo',
                  message: 'chore(backstage-dev): promote image to ${{ imageFrom("gitea.cnoe.localtest.me:8443/giteaadmin/backstage-cnoe").Tag }} in images.json'
                }
              },
              {
                uses: 'git-push',
                config: {
                  path: './repo',
                  targetBranch: gitBranch
                }
              },
              
              // Gitea manifest repository update steps
              {
                uses: 'git-clone',
                config: {
                  repoURL: 'https://gitea.cnoe.localtest.me:8443/giteaAdmin/idpbuilder-localdev-backstage-manifests.git',
                  checkout: [
                    {
                      branch: 'main',
                      path: './gitea-manifests'
                    }
                  ],
                  insecureSkipTLSVerify: true  // For dev environment with self-signed certificates
                }
              },
              // Now with FILE_PER_RESOURCE, we can target the specific Deployment file
              {
                uses: 'yaml-update', 
                config: {
                  path: './gitea-manifests/Deployment.backstage.k8s.yaml',
                  updates: [
                    {
                      key: 'spec.template.spec.containers.0.image',
                      value: 'gitea.cnoe.localtest.me:8443/giteaadmin/backstage-cnoe:${{ imageFrom("gitea.cnoe.localtest.me:8443/giteaadmin/backstage-cnoe").Tag }}'
                    }
                  ]
                }
              },
              {
                uses: 'git-commit',
                config: {
                  path: './gitea-manifests',
                  message: 'chore(backstage-dev): update backstage image to ${{ imageFrom("gitea.cnoe.localtest.me:8443/giteaadmin/backstage-cnoe").Tag }}'
                }
              },
              {
                uses: 'git-push',
                config: {
                  path: './gitea-manifests',
                  targetBranch: 'main'
                }
              },
              // Force Argo CD to sync the Backstage application immediately after promotion
              {
                uses: 'argocd-update',
                config: {
                  apps: [
                    {
                      name: 'backstage',
                      namespace: 'argocd'
                      // Optionally, you can specify health checks by defining sources
                      // when the Application points at a Git repo. Since our dev app
                      // uses a local CNOE source, we use a simple sync trigger here.
                    }
                  ]
                }
              }
            ]
          }
        }
      }
    });

    // 4. Production Stage - Manual promotion directly from warehouse
    new Stage(this, 'prod-stage', {
      metadata: {
        name: 'backstage-prod',
        namespace: 'kargo-pipelines',
        labels: {
          'app.kubernetes.io/name': 'backstage-prod-stage',
          'app.kubernetes.io/part-of': 'kargo-pipelines',
          'app.kubernetes.io/component': 'stage'
        }
      },
      spec: {
        requestedFreight: [
          {
            origin: {
              kind: StageSpecRequestedFreightOriginKind.WAREHOUSE,
              name: 'backstage-warehouse'
            },
            sources: {
              direct: true  // Direct from warehouse for parallel promotion
            }
          }
        ],
        promotionTemplate: {
          spec: {
            steps: [
              // For production, we'll keep GitHub update (but still commented for now)
              {
                uses: 'git-clone',
                config: {
                  repoURL: githubRepo,
                  checkout: [
                    {
                      branch: gitBranch,
                      path: './repo'
                    }
                  ]
                }
              },
              {
                uses: 'json-update',
                config: {
                  path: './repo/.env-files/images.json',
                  updates: [
                    {
                      key: 'production.backstage',
                      value: 'gitea.cnoe.localtest.me:8443/giteaadmin/backstage-cnoe:${{ imageFrom("gitea.cnoe.localtest.me:8443/giteaadmin/backstage-cnoe").Tag }}'
                    }
                  ]
                }
              },
              {
                uses: 'git-commit',
                config: {
                  path: './repo',
                  message: 'chore(backstage-prod): promote image to ${{ imageFrom("gitea.cnoe.localtest.me:8443/giteaadmin/backstage-cnoe").Tag }} in images.json'
                }
              },
              {
                uses: 'git-push',
                config: {
                  path: './repo',
                  targetBranch: gitBranch
                }
              },
              
              // For now, production doesn't update Gitea manifests (dev environment only)
              // This could be enabled later for production manifest updates
              {
                uses: 'git-clone',
                config: {
                  repoURL: githubRepo,
                  checkout: [
                    {
                      branch: gitBranch,
                      path: './repo'
                    }
                  ]
                }
              },
              {
                uses: 'json-update',
                config: {
                  path: './repo/.env-files/images.json',
                  updates: [
                    {
                      key: 'production.backstage',
                      value: 'gitea.cnoe.localtest.me:8443/giteaadmin/backstage-cnoe:${{ imageFrom("gitea.cnoe.localtest.me:8443/giteaadmin/backstage-cnoe").Tag }}'
                    }
                  ]
                }
              },
              {
                uses: 'git-commit',
                config: {
                  path: './repo',
                  message: 'chore(backstage-prod): promote image to ${{ imageFrom("gitea.cnoe.localtest.me:8443/giteaadmin/backstage-cnoe").Tag }} in images.json'
                }
              },
              {
                uses: 'git-push',
                config: {
                  path: './repo',
                  targetBranch: gitBranch
                }
              }
            ]
          }
        }
      }
    });

    // 6. Service Account for Kargo operations
    new ApiObject(this, 'kargo-git-sa', {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: {
        name: 'kargo-backstage-git',
        namespace: 'kargo-pipelines',
        labels: {
          'app.kubernetes.io/name': 'kargo-backstage-git',
          'app.kubernetes.io/part-of': 'kargo-pipelines',
          'app.kubernetes.io/component': 'serviceaccount'
        }
      }
    });

    // RoleBinding for the shared role in kargo-pipelines namespace
    new ApiObject(this, 'kargo-rolebinding', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: {
        name: 'kargo-backstage-git-promoter',
        namespace: 'kargo-pipelines'
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: 'kargo-git-promoter'  // Use shared role from project
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'kargo-backstage-git',
          namespace: 'kargo-pipelines'
        }
      ]
    });

    // Note: ClusterRoleBinding is now managed by kargo-pipelines-project-chart.ts
  }
}