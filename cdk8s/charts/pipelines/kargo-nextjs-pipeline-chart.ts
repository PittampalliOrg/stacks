import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import { Warehouse, Stage, WarehouseSpecFreightCreationPolicy, WarehouseSpecSubscriptionsImageImageSelectionStrategy, StageSpecRequestedFreightOriginKind } from '../../imports/kargo.akuity.io';
import { createPipelineGitPromoter } from '../../lib/kargo-rbac';

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

    // 6. Service Account + RoleBinding for Kargo operations (shared role)
    createPipelineGitPromoter(this, 'kargo-nextjs-git', { appName: 'nextjs' });

    // Note: ClusterRoleBinding is now managed by kargo-pipelines-project-chart.ts
  }
}
