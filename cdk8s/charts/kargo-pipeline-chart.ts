import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { Project, Stage, Warehouse, WarehouseSpecFreightCreationPolicy, WarehouseSpecSubscriptionsImageImageSelectionStrategy, StageSpecRequestedFreightOriginKind } from '../imports/kargo.akuity.io';

export interface KargoPipelineChartProps extends ChartProps {
  gitBranch?: string;
  acrRegistry?: string;
  githubRepo?: string;
}

/**
 * @deprecated This chart is deprecated. Use the individual pipeline charts instead:
 * - KargoNextjsPipelineChart
 * - KargoBackstagePipelineChart
 * - KargoFlagdUiPipelineChart
 * - KargoClaudeCodeUiPipelineChart
 * 
 * Kargo Pipeline Chart for Next.js Application
 * Manages the promotion of container images across dev, staging, and prod environments
 */
export class KargoPipelineChart extends Chart {
  constructor(scope: Construct, id: string, props: KargoPipelineChartProps = {}) {
    super(scope, id, props);

    const gitBranch = props.gitBranch || 'app';
    const acrRegistry = props.acrRegistry || 'vpittamp.azurecr.io';
    const githubRepo = props.githubRepo || 'https://github.com/PittampalliOrg/cdk8s-project.git';
    const flagdImageName = 'flagd-ui';
    const claudecodeuiImageName = 'claudecodeui';

    // 1. Kargo Project for Next.js
    new Project(this, 'nextjs-project', {
      metadata: {
        name: 'nextjs',
      },
      spec: {}
    });

    // 2. Warehouse to monitor GHCR for new Next.js images
    new Warehouse(this, 'nextjs-warehouse', {
      metadata: {
        name: 'nextjs-images',
        namespace: 'nextjs',
        labels: {
          'app.kubernetes.io/name': 'nextjs-warehouse',
          'app.kubernetes.io/part-of': 'nextjs-pipeline'
        }
      },
      spec: {
        freightCreationPolicy: WarehouseSpecFreightCreationPolicy.AUTOMATIC,
        interval: '30s', // Check for new images every 30 seconds
        subscriptions: [
          {
            image: {
              repoUrl: 'ghcr.io/pittampalliorg/chat',
              semverConstraint: '>=0.0.0', // Accept any version
              discoveryLimit: 10, // Keep last 10 versions
              imageSelectionStrategy: WarehouseSpecSubscriptionsImageImageSelectionStrategy.SEM_VER,
              strictSemvers: true
            }
          }
        ]
      }
    });

    // 2b. Warehouse to monitor GitHub Container Registry for Backstage images
    new Warehouse(this, 'backstage-warehouse', {
      metadata: {
        name: 'backstage-images',
        namespace: 'nextjs',
        labels: {
          'app.kubernetes.io/name': 'backstage-warehouse',
          'app.kubernetes.io/part-of': 'nextjs-pipeline'
        }
      },
      spec: {
        freightCreationPolicy: WarehouseSpecFreightCreationPolicy.AUTOMATIC,
        interval: '30s', // Check for new images every 30 seconds
        subscriptions: [
          {
            image: {
              repoUrl: 'ghcr.io/pittampalliorg/backstage',
              semverConstraint: '>=0.0.0', // Accept any version
              discoveryLimit: 10, // Keep last 10 versions
              imageSelectionStrategy: WarehouseSpecSubscriptionsImageImageSelectionStrategy.NEWEST_BUILD, // Use newest build for SHA-based tags
              allowTags: 'master-*', // Only track master branch builds
              strictSemvers: false
            }
          }
        ]
      }
    });

    // 2c. Warehouse to monitor ACR for flagd-ui images
    new Warehouse(this, 'flagd-ui-warehouse', {
      metadata: {
        name: 'flagd-ui-images',
        namespace: 'nextjs',
        labels: {
          'app.kubernetes.io/name': 'flagd-ui-warehouse',
          'app.kubernetes.io/part-of': 'nextjs-pipeline'
        }
      },
      spec: {
        freightCreationPolicy: WarehouseSpecFreightCreationPolicy.AUTOMATIC,
        interval: '30s', // Check for new images every 30 seconds
        subscriptions: [
          {
            image: {
              repoUrl: `${acrRegistry}/${flagdImageName}`,
              semverConstraint: '>=0.0.0', // Accept any version
              discoveryLimit: 10, // Keep last 10 versions
              imageSelectionStrategy: WarehouseSpecSubscriptionsImageImageSelectionStrategy.SEM_VER,
              strictSemvers: true
            }
          }
        ]
      }
    });

    // 2d. Warehouse to monitor ACR for claudecodeui images
    new Warehouse(this, 'claudecodeui-warehouse', {
      metadata: {
        name: 'claudecodeui-images',
        namespace: 'nextjs',
        labels: {
          'app.kubernetes.io/name': 'claudecodeui-warehouse',
          'app.kubernetes.io/part-of': 'nextjs-pipeline'
        }
      },
      spec: {
        freightCreationPolicy: WarehouseSpecFreightCreationPolicy.AUTOMATIC,
        interval: '30s', // Check for new images every 30 seconds
        subscriptions: [
          {
            image: {
              repoUrl: `${acrRegistry}/${claudecodeuiImageName}`,
              semverConstraint: '>=0.0.0', // Accept any version
              discoveryLimit: 10, // Keep last 10 versions
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
        name: 'dev',
        namespace: 'nextjs',
        labels: {
          'app.kubernetes.io/name': 'dev-stage',
          'app.kubernetes.io/part-of': 'nextjs-pipeline'
        }
      },
      spec: {
        requestedFreight: [
          {
            origin: {
              kind: StageSpecRequestedFreightOriginKind.WAREHOUSE,
              name: 'nextjs-images'
            },
            sources: {
              direct: true
            }
          },
          {
            origin: {
              kind: StageSpecRequestedFreightOriginKind.WAREHOUSE,
              name: 'backstage-images'
            },
            sources: {
              direct: true
            }
          },
          {
            origin: {
              kind: StageSpecRequestedFreightOriginKind.WAREHOUSE,
              name: 'flagd-ui-images'
            },
            sources: {
              direct: true
            }
          },
          {
            origin: {
              kind: StageSpecRequestedFreightOriginKind.WAREHOUSE,
              name: 'claudecodeui-images'
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
                    },
                    {
                      key: 'dev.backstage',
                      value: 'ghcr.io/pittampalliorg/backstage:${{ imageFrom("ghcr.io/pittampalliorg/backstage").Tag }}'
                    },
                    {
                      key: 'dev.flagdUi',
                      value: `${acrRegistry}/${flagdImageName}:\${{ imageFrom("${acrRegistry}/${flagdImageName}").Tag }}`
                    },
                    {
                      key: 'dev.claudecodeui',
                      value: `${acrRegistry}/${claudecodeuiImageName}:\${{ imageFrom("${acrRegistry}/${claudecodeuiImageName}").Tag }}`
                    }
                  ]
                }
              },
              {
                uses: 'git-commit',
                config: {
                  path: './repo',
                  message: `chore(dev): promote images`
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
        },
        // Verification removed - not supported in Kargo core
      }
    });

    // 4. Staging Stage - Requires manual promotion from dev
    new Stage(this, 'staging-stage', {
      metadata: {
        name: 'staging',
        namespace: 'nextjs',
        labels: {
          'app.kubernetes.io/name': 'staging-stage',
          'app.kubernetes.io/part-of': 'nextjs-pipeline'
        }
      },
      spec: {
        requestedFreight: [
          {
            origin: {
              kind: StageSpecRequestedFreightOriginKind.WAREHOUSE,
              name: 'nextjs-images'
            },
            sources: {
              stages: ['dev'] // Only accept freight that has been through dev
            }
          },
          {
            origin: {
              kind: StageSpecRequestedFreightOriginKind.WAREHOUSE,
              name: 'backstage-images'
            },
            sources: {
              stages: ['dev'] // Only accept freight that has been through dev
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
                    },
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
                  message: `chore(staging): promote images`
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
        },
        // Verification removed - not supported in Kargo core
      }
    });

    // 5. Production Stage - Requires manual promotion from staging
    new Stage(this, 'prod-stage', {
      metadata: {
        name: 'prod',
        namespace: 'nextjs',
        labels: {
          'app.kubernetes.io/name': 'prod-stage',
          'app.kubernetes.io/part-of': 'nextjs-pipeline'
        }
      },
      spec: {
        requestedFreight: [
          {
            origin: {
              kind: StageSpecRequestedFreightOriginKind.WAREHOUSE,
              name: 'nextjs-images'
            },
            sources: {
              stages: ['staging'] // Only accept freight that has been through staging
            }
          },
          {
            origin: {
              kind: StageSpecRequestedFreightOriginKind.WAREHOUSE,
              name: 'backstage-images'
            },
            sources: {
              stages: ['staging'] // Only accept freight that has been through staging
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
                      branch: 'master', // Production uses master branch
                      path: './repo'
                    }
                  ]
                }
              },
              {
                uses: 'git-create-branch',
                config: {
                  path: './repo',
                  branch: `release/{{ .Freight.ID | trunc 7 }}`
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
                    },
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
                  message: `chore(prod): release images`
                }
              },
              {
                uses: 'git-push',
                config: {
                  path: './repo',
                  targetBranch: `release/{{ .Freight.ID | trunc 7 }}`
                }
              },
              // Note: Manual PR creation required for production releases
              // Kargo will push to release branch, then create PR manually
            ]
          }
        },
        // Verification removed - not supported in Kargo core
      }
    });

    // 6. Service Account for Kargo operations
    new ApiObject(this, 'kargo-git-sa', {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: {
        name: 'kargo-git',
        namespace: 'nextjs',
        labels: {
          'app.kubernetes.io/name': 'kargo-git',
          'app.kubernetes.io/part-of': 'nextjs-pipeline'
        }
      }
    });

    // 7. Role for Kargo to manage resources
    new ApiObject(this, 'kargo-role', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'Role',
      metadata: {
        name: 'kargo-promoter',
        namespace: 'nextjs'
      },
      rules: [
        {
          apiGroups: ['kargo.akuity.io'],
          resources: ['freights', 'stages', 'warehouses', 'promotions'],
          verbs: ['get', 'list', 'watch', 'create', 'update', 'patch']
        },
        {
          apiGroups: [''],
          resources: ['secrets'],
          verbs: ['get', 'list']
        }
      ]
    });

    // 8. RoleBinding
    new ApiObject(this, 'kargo-rolebinding', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: {
        name: 'kargo-promoter',
        namespace: 'nextjs'
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: 'kargo-promoter'
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'kargo-git',
          namespace: 'nextjs'
        }
      ]
    });

    // 9. ClusterRole for ArgoCD Application updates
    new ApiObject(this, 'kargo-argocd-updater-role', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRole',
      metadata: {
        name: 'kargo-argocd-updater',
        labels: {
          'app.kubernetes.io/name': 'kargo-argocd-updater',
          'app.kubernetes.io/part-of': 'nextjs-pipeline'
        }
      },
      rules: [
        {
          apiGroups: ['argoproj.io'],
          resources: ['applications'],
          verbs: ['get', 'list', 'patch', 'update']
        }
      ]
    });

    // 10. ClusterRoleBinding for ArgoCD Application updates
    new ApiObject(this, 'kargo-argocd-updater-binding', {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRoleBinding',
      metadata: {
        name: 'kargo-argocd-updater',
        labels: {
          'app.kubernetes.io/name': 'kargo-argocd-updater',
          'app.kubernetes.io/part-of': 'nextjs-pipeline'
        }
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: 'kargo-argocd-updater'
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: 'kargo-git',
          namespace: 'nextjs'
        },
        {
          kind: 'ServiceAccount',
          name: 'kargo-controller',
          namespace: 'kargo'
        }
      ]
    });
  }
}