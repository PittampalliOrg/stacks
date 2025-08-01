import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { Warehouse, Stage, WarehouseSpecFreightCreationPolicy, WarehouseSpecSubscriptionsImageImageSelectionStrategy, StageSpecRequestedFreightOriginKind } from '../imports/kargo.akuity.io';

export interface KargoNextjsPipelineChartProps extends ChartProps {
  gitBranch?: string;
  githubRepo?: string;
}

/**
 * Kargo Pipeline Chart for Next.js Chat Application
 * Independent pipeline for promoting Next.js container images
 */
export class KargoNextjsPipelineChart extends Chart {
  constructor(scope: Construct, id: string, props: KargoNextjsPipelineChartProps = {}) {
    super(scope, id, props);

    const gitBranch = props.gitBranch || 'main';
    const githubRepo = props.githubRepo || 'https://github.com/PittampalliOrg/stacks.git';

    // Note: Project is now managed by kargo-pipelines-project-chart.ts

    // 2. Warehouse to monitor GHCR for new Next.js images
    new Warehouse(this, 'nextjs-warehouse', {
      metadata: {
        name: 'nextjs-warehouse',
        namespace: 'kargo-pipelines',
        labels: {
          'app.kubernetes.io/name': 'nextjs-warehouse',
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
              repoUrl: 'ghcr.io/pittampalliorg/chat',
              discoveryLimit: 10,
              imageSelectionStrategy: WarehouseSpecSubscriptionsImageImageSelectionStrategy.NEWEST_BUILD,
              allowTags: '^\\d+$',  // Only numeric tags (GitHub run numbers)
              strictSemvers: false  // Not applicable for NEWEST_BUILD strategy
            }
          }
        ]
      }
    });

    // 3. Dev Stage - Auto-promotes from warehouse
    new Stage(this, 'dev-stage', {
      metadata: {
        name: 'nextjs-dev',
        namespace: 'kargo-pipelines',
        labels: {
          'app.kubernetes.io/name': 'nextjs-dev-stage',
          'app.kubernetes.io/part-of': 'kargo-pipelines',
          'app.kubernetes.io/component': 'stage'
        }
      },
      spec: {
        requestedFreight: [
          {
            origin: {
              kind: StageSpecRequestedFreightOriginKind.WAREHOUSE,
              name: 'nextjs-warehouse'
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
                      key: 'dev.nextjs',
                      value: 'ghcr.io/pittampalliorg/chat:${{ imageFrom("ghcr.io/pittampalliorg/chat").Tag }}'
                    }
                  ]
                }
              },
              {
                uses: 'git-commit',
                config: {
                  path: './repo',
                  message: 'chore(nextjs-dev): promote image to ${{ imageFrom("ghcr.io/pittampalliorg/chat").Tag }}'
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

    // 4. Production Stage - Manual promotion directly from warehouse
    new Stage(this, 'prod-stage', {
      metadata: {
        name: 'nextjs-prod',
        namespace: 'kargo-pipelines',
        labels: {
          'app.kubernetes.io/name': 'nextjs-prod-stage',
          'app.kubernetes.io/part-of': 'kargo-pipelines',
          'app.kubernetes.io/component': 'stage'
        }
      },
      spec: {
        requestedFreight: [
          {
            origin: {
              kind: StageSpecRequestedFreightOriginKind.WAREHOUSE,
              name: 'nextjs-warehouse'
            },
            sources: {
              direct: true  // Direct from warehouse for parallel promotion
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
                      key: 'production.nextjs',
                      value: 'ghcr.io/pittampalliorg/chat:${{ imageFrom("ghcr.io/pittampalliorg/chat").Tag }}'
                    }
                  ]
                }
              },
              {
                uses: 'git-commit',
                config: {
                  path: './repo',
                  message: 'chore(nextjs-prod): promote image to ${{ imageFrom("ghcr.io/pittampalliorg/chat").Tag }}'
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
        name: 'kargo-nextjs-git',
        namespace: 'kargo-pipelines',
        labels: {
          'app.kubernetes.io/name': 'kargo-nextjs-git',
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
        name: 'kargo-nextjs-git-promoter',
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
          name: 'kargo-nextjs-git',
          namespace: 'kargo-pipelines'
        }
      ]
    });

    // Note: ClusterRoleBinding is now managed by kargo-pipelines-project-chart.ts
  }
}