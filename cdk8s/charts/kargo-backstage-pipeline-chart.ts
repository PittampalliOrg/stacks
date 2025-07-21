import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { Warehouse, Stage, WarehouseSpecFreightCreationPolicy, WarehouseSpecSubscriptionsImageImageSelectionStrategy, StageSpecRequestedFreightOriginKind } from '../imports/kargo.akuity.io';

export interface KargoBackstagePipelineChartProps extends ChartProps {
  gitBranch?: string;
  githubRepo?: string;
}

/**
 * Kargo Pipeline Chart for Backstage Developer Portal
 * Independent pipeline for promoting Backstage container images
 */
export class KargoBackstagePipelineChart extends Chart {
  constructor(scope: Construct, id: string, props: KargoBackstagePipelineChartProps = {}) {
    super(scope, id, props);

    const gitBranch = props.gitBranch || 'app';
    const githubRepo = props.githubRepo || 'https://github.com/PittampalliOrg/cdk8s-project.git';

    // Note: Project is now managed by kargo-pipelines-project-chart.ts

    // 2. Dev Warehouse to monitor GitHub Container Registry for Backstage dev images
    new Warehouse(this, 'backstage-dev-warehouse', {
      metadata: {
        name: 'backstage-dev-warehouse',
        namespace: 'gitops-pipelines',
        labels: {
          'app.kubernetes.io/name': 'backstage-dev-warehouse',
          'app.kubernetes.io/part-of': 'gitops-pipelines',
          'app.kubernetes.io/component': 'warehouse'
        }
      },
      spec: {
        freightCreationPolicy: WarehouseSpecFreightCreationPolicy.AUTOMATIC,
        interval: '30s',
        subscriptions: [
          {
            image: {
              repoUrl: 'ghcr.io/pittampalliorg/backstage',
              discoveryLimit: 10,
              imageSelectionStrategy: WarehouseSpecSubscriptionsImageImageSelectionStrategy.NEWEST_BUILD,
              allowTags: '.*-dev', // Matches v123-dev, latest-dev, etc.
              strictSemvers: false
            }
          }
        ]
      }
    });

    // 3. Production Warehouse to monitor GitHub Container Registry for Backstage production images
    new Warehouse(this, 'backstage-prod-warehouse', {
      metadata: {
        name: 'backstage-prod-warehouse',
        namespace: 'gitops-pipelines',
        labels: {
          'app.kubernetes.io/name': 'backstage-prod-warehouse',
          'app.kubernetes.io/part-of': 'gitops-pipelines',
          'app.kubernetes.io/component': 'warehouse'
        }
      },
      spec: {
        freightCreationPolicy: WarehouseSpecFreightCreationPolicy.AUTOMATIC,
        interval: '30s',
        subscriptions: [
          {
            image: {
              repoUrl: 'ghcr.io/pittampalliorg/backstage',
              discoveryLimit: 10,
              imageSelectionStrategy: WarehouseSpecSubscriptionsImageImageSelectionStrategy.NEWEST_BUILD,
              allowTags: '.*-production', // Matches v123-production, latest-production, etc.
              strictSemvers: false
            }
          }
        ]
      }
    });

    // 4. Dev Stage - Auto-promotes from dev warehouse
    new Stage(this, 'dev-stage', {
      metadata: {
        name: 'backstage-dev',
        namespace: 'gitops-pipelines',
        labels: {
          'app.kubernetes.io/name': 'backstage-dev-stage',
          'app.kubernetes.io/part-of': 'gitops-pipelines',
          'app.kubernetes.io/component': 'stage'
        }
      },
      spec: {
        requestedFreight: [
          {
            origin: {
              kind: StageSpecRequestedFreightOriginKind.WAREHOUSE,
              name: 'backstage-dev-warehouse'
            },
            sources: {
              direct: true
            }
          }
        ],
        promotionTemplate: {
          spec: {
            steps: [
              // Clone cdk8s-project repo
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
              // Clone backstage repo
              {
                uses: 'git-clone',
                config: {
                  repoURL: 'https://github.com/PittampalliOrg/backstage.git',
                  checkout: [
                    {
                      branch: 'main',
                      path: './backstage-repo'
                    }
                  ]
                }
              },
              // Update images.json in cdk8s-project
              {
                uses: 'json-update',
                config: {
                  path: './repo/.env-files/images.json',
                  updates: [
                    {
                      key: 'dev.backstage',
                      value: 'ghcr.io/pittampalliorg/backstage:${{ imageFrom("ghcr.io/pittampalliorg/backstage").Tag }}'
                    }
                  ]
                }
              },
              // Update devspace.yaml in backstage repo
              {
                uses: 'yaml-update',
                config: {
                  path: './backstage-repo/backstage/devspace.yaml',
                  updates: [
                    {
                      key: 'dev.app.imageSelector',
                      value: 'ghcr.io/pittampalliorg/backstage:${{ imageFrom("ghcr.io/pittampalliorg/backstage").Tag }}'
                    }
                  ]
                }
              },
              // Commit to cdk8s-project
              {
                uses: 'git-commit',
                config: {
                  path: './repo',
                  message: 'chore(backstage-dev): promote image to ${{ imageFrom("ghcr.io/pittampalliorg/backstage").Tag }}'
                }
              },
              // Push to cdk8s-project
              {
                uses: 'git-push',
                config: {
                  path: './repo',
                  targetBranch: gitBranch
                }
              },
              // Commit to backstage repo
              {
                uses: 'git-commit',
                config: {
                  path: './backstage-repo',
                  message: 'chore(devspace): update imageSelector to ${{ imageFrom("ghcr.io/pittampalliorg/backstage").Tag }}'
                }
              },
              // Push to backstage repo
              {
                uses: 'git-push',
                config: {
                  path: './backstage-repo',
                  targetBranch: 'main'
                }
              }
            ]
          }
        }
      }
    });

    // 5. Production Stage - Auto-promotes from production warehouse
    new Stage(this, 'prod-stage', {
      metadata: {
        name: 'backstage-prod',
        namespace: 'gitops-pipelines',
        labels: {
          'app.kubernetes.io/name': 'backstage-prod-stage',
          'app.kubernetes.io/part-of': 'gitops-pipelines',
          'app.kubernetes.io/component': 'stage'
        }
      },
      spec: {
        requestedFreight: [
          {
            origin: {
              kind: StageSpecRequestedFreightOriginKind.WAREHOUSE,
              name: 'backstage-prod-warehouse'
            },
            sources: {
              direct: true
            }
          }
        ],
        promotionTemplate: {
          spec: {
            steps: [
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
                      value: 'ghcr.io/pittampalliorg/backstage:${{ imageFrom("ghcr.io/pittampalliorg/backstage").Tag }}'
                    }
                  ]
                }
              },
              {
                uses: 'git-commit',
                config: {
                  path: './repo',
                  message: 'chore(backstage-prod): promote image to ${{ imageFrom("ghcr.io/pittampalliorg/backstage").Tag }}'
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
        namespace: 'gitops-pipelines',
        labels: {
          'app.kubernetes.io/name': 'kargo-backstage-git',
          'app.kubernetes.io/part-of': 'gitops-pipelines',
          'app.kubernetes.io/component': 'serviceaccount'
        }
      }
    });

    // RoleBinding for the shared role in gitops-pipelines namespace
    new ApiObject(this, 'kargo-rolebinding', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: {
        name: 'kargo-backstage-git-promoter',
        namespace: 'gitops-pipelines'
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
          namespace: 'gitops-pipelines'
        }
      ]
    });

    // Note: ClusterRoleBinding is now managed by kargo-pipelines-project-chart.ts
  }
}