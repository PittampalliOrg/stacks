import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { Warehouse, Stage, WarehouseSpecFreightCreationPolicy, WarehouseSpecSubscriptionsImageImageSelectionStrategy, StageSpecRequestedFreightOriginKind } from '../imports/kargo.akuity.io';

export interface KargoClaudeCodeUiPipelineChartProps extends ChartProps {
  gitBranch?: string;
  acrRegistry?: string;
  githubRepo?: string;
}

/**
 * Kargo Pipeline Chart for Claude Code UI
 * Independent pipeline for promoting Claude Code UI container images
 */
export class KargoClaudeCodeUiPipelineChart extends Chart {
  constructor(scope: Construct, id: string, props: KargoClaudeCodeUiPipelineChartProps = {}) {
    super(scope, id, props);

    const gitBranch = props.gitBranch || 'app';
    const acrRegistry = props.acrRegistry || 'vpittamp.azurecr.io';
    const githubRepo = props.githubRepo || 'https://github.com/PittampalliOrg/cdk8s-project.git';
    const imageName = 'claudecodeui';

    // Note: Project is now managed by kargo-pipelines-project-chart.ts

    // Warehouse to monitor ACR for claudecodeui images
    new Warehouse(this, 'claudecodeui-warehouse', {
      metadata: {
        name: 'claudecodeui-warehouse',
        namespace: 'gitops-pipelines',
        labels: {
          'app.kubernetes.io/name': 'claudecodeui-warehouse',
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
              repoUrl: `${acrRegistry}/${imageName}`,
              semverConstraint: '>=0.0.0',
              discoveryLimit: 10,
              imageSelectionStrategy: WarehouseSpecSubscriptionsImageImageSelectionStrategy.SEM_VER,
              strictSemvers: true
            }
          }
        ]
      }
    });

    // 3. Dev Stage - Auto-promotes from warehouse
    new Stage(this, 'dev-stage', {
      metadata: {
        name: 'claudecodeui-dev',
        namespace: 'gitops-pipelines',
        labels: {
          'app.kubernetes.io/name': 'claudecodeui-dev-stage',
          'app.kubernetes.io/part-of': 'gitops-pipelines',
          'app.kubernetes.io/component': 'stage'
        }
      },
      spec: {
        requestedFreight: [
          {
            origin: {
              kind: StageSpecRequestedFreightOriginKind.WAREHOUSE,
              name: 'claudecodeui-warehouse'
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
                      key: 'dev.claudecodeui',
                      value: `${acrRegistry}/${imageName}:\${{ imageFrom("${acrRegistry}/${imageName}").Tag }}`
                    }
                  ]
                }
              },
              {
                uses: 'git-commit',
                config: {
                  path: './repo',
                  message: `chore(claudecodeui-dev): promote image to \${{ imageFrom("${acrRegistry}/${imageName}").Tag }}`
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
        name: 'claudecodeui-prod',
        namespace: 'gitops-pipelines',
        labels: {
          'app.kubernetes.io/name': 'claudecodeui-prod-stage',
          'app.kubernetes.io/part-of': 'gitops-pipelines',
          'app.kubernetes.io/component': 'stage'
        }
      },
      spec: {
        requestedFreight: [
          {
            origin: {
              kind: StageSpecRequestedFreightOriginKind.WAREHOUSE,
              name: 'claudecodeui-warehouse'
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
                      key: 'production.claudecodeui',
                      value: `${acrRegistry}/${imageName}:\${{ imageFrom("${acrRegistry}/${imageName}").Tag }}`
                    }
                  ]
                }
              },
              {
                uses: 'git-commit',
                config: {
                  path: './repo',
                  message: `chore(claudecodeui-prod): promote image to \${{ imageFrom("${acrRegistry}/${imageName}").Tag }}`
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
        name: 'kargo-claudecodeui-git',
        namespace: 'gitops-pipelines',
        labels: {
          'app.kubernetes.io/name': 'kargo-claudecodeui-git',
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
        name: 'kargo-claudecodeui-git-promoter',
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
          name: 'kargo-claudecodeui-git',
          namespace: 'gitops-pipelines'
        }
      ]
    });

    // Note: ClusterRoleBinding is now managed by kargo-pipelines-project-chart.ts
  }
}