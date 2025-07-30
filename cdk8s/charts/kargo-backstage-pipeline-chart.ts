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

    // 2. Warehouse to monitor GHCR for new Backstage images
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
              repoUrl: 'ghcr.io/pittampalliorg/backstage-app',
              discoveryLimit: 10,
              imageSelectionStrategy: WarehouseSpecSubscriptionsImageImageSelectionStrategy.LEXICAL,
              allowTags: '^v\\d+.*',  // Tags starting with 'v' followed by digits (e.g., v124-dev)
              strictSemvers: false  // Not applicable for LEXICAL strategy
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
                      value: 'ghcr.io/pittampalliorg/backstage-app:${{ imageFrom("ghcr.io/pittampalliorg/backstage-app").Tag }}'
                    }
                  ]
                }
              },
              {
                uses: 'exec',
                config: {
                  command: '/bin/sh',
                  args: [
                    '-c',
                    'yq eval \'(select(.kind == "Deployment" and .metadata.name == "backstage") | .spec.template.spec.containers[0].image) = "ghcr.io/pittampalliorg/backstage-app:${{ imageFrom("ghcr.io/pittampalliorg/backstage-app").Tag }}"\' -i ./repo/ref-implementation/backstage/manifests/install.yaml'
                  ]
                }
              },
              {
                uses: 'git-commit',
                config: {
                  path: './repo',
                  message: 'chore(backstage-dev): promote image to ${{ imageFrom("ghcr.io/pittampalliorg/backstage-app").Tag }} in images.json and manifests'
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
                      value: 'ghcr.io/pittampalliorg/backstage-app:${{ imageFrom("ghcr.io/pittampalliorg/backstage-app").Tag }}'
                    }
                  ]
                }
              },
              {
                uses: 'exec',
                config: {
                  command: '/bin/sh',
                  args: [
                    '-c',
                    'yq eval \'(select(.kind == "Deployment" and .metadata.name == "backstage") | .spec.template.spec.containers[0].image) = "ghcr.io/pittampalliorg/backstage-app:${{ imageFrom("ghcr.io/pittampalliorg/backstage-app").Tag }}"\' -i ./repo/ref-implementation/backstage/manifests/install.yaml'
                  ]
                }
              },
              {
                uses: 'git-commit',
                config: {
                  path: './repo',
                  message: 'chore(backstage-prod): promote image to ${{ imageFrom("ghcr.io/pittampalliorg/backstage-app").Tag }} in images.json and manifests'
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