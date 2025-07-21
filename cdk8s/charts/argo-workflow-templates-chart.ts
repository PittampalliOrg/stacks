import { Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { WorkflowTemplate, ClusterWorkflowTemplate } from '../imports/argoproj.io';

export class ArgoWorkflowTemplatesChart extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Simple Hello World WorkflowTemplate
    new WorkflowTemplate(this, 'hello-world-template', {
      metadata: {
        name: 'hello-world-template',
        namespace: 'argo',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'workflow-type': 'hello-world'
        },
        annotations: {
          'workflows.argoproj.io/description': 'Simple hello world workflow template',
          'workflows.argoproj.io/tags': 'example,simple'
        }
      },
      spec: {
        entrypoint: 'main',
        arguments: {
          parameters: [
            {
              name: 'greeting',
              value: 'Hello from CDK8s WorkflowTemplate!'
            }
          ]
        },
        templates: [
          {
            name: 'main',
            inputs: {
              parameters: [
                {
                  name: 'greeting',
                  default: 'Hello World!'
                }
              ]
            },
            container: {
              image: 'alpine:latest',
              command: ['sh', '-c'],
              args: [
                'echo "{{inputs.parameters.greeting}}"; ' +
                'echo "Submitted at: $(date)"; ' +
                'echo "Hostname: $(hostname)"; ' +
                'echo "Success!"'
              ]
            }
          }
        ]
      }
    });

    // Data Processing Pipeline WorkflowTemplate
    new WorkflowTemplate(this, 'data-pipeline-template', {
      metadata: {
        name: 'data-pipeline-template',
        namespace: 'argo',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'workflow-type': 'data-processing'
        },
        annotations: {
          'workflows.argoproj.io/description': 'Data processing pipeline with parameter passing',
          'workflows.argoproj.io/tags': 'data,pipeline,processing'
        }
      },
      spec: {
        serviceAccountName: 'argo-workflow',
        entrypoint: 'main',
        arguments: {
          parameters: [
            {
              name: 'data-source',
              value: 'default-source'
            },
            {
              name: 'processing-mode',
              value: 'standard',
              enum: ['standard', 'fast', 'thorough']
            }
          ]
        },
        templates: [
          {
            name: 'main',
            dag: {
              tasks: [
                {
                  name: 'generate-data',
                  template: 'generate',
                  arguments: {
                    parameters: [
                      {
                        name: 'source',
                        value: '{{workflow.parameters.data-source}}'
                      }
                    ]
                  }
                },
                {
                  name: 'process-data',
                  dependencies: ['generate-data'],
                  template: 'process',
                  arguments: {
                    parameters: [
                      {
                        name: 'input-data',
                        value: '{{tasks.generate-data.outputs.result}}'
                      },
                      {
                        name: 'mode',
                        value: '{{workflow.parameters.processing-mode}}'
                      }
                    ]
                  }
                },
                {
                  name: 'transform-data',
                  dependencies: ['process-data'],
                  template: 'transform',
                  arguments: {
                    parameters: [
                      {
                        name: 'processed-data',
                        value: '{{tasks.process-data.outputs.result}}'
                      }
                    ]
                  }
                }
              ]
            }
          },
          {
            name: 'generate',
            inputs: {
              parameters: [
                {
                  name: 'source'
                }
              ]
            },
            script: {
              image: 'python:3.9-alpine',
              command: ['python'],
              source: `
import json
import random
data = {
    "id": random.randint(1000, 9999),
    "value": random.randint(1, 100),
    "source": "{{inputs.parameters.source}}",
    "timestamp": "2025-06-04"
}
print(json.dumps(data))
              `.trim()
            }
          },
          {
            name: 'process',
            inputs: {
              parameters: [
                {
                  name: 'input-data'
                },
                {
                  name: 'mode'
                }
              ]
            },
            script: {
              image: 'python:3.9-alpine',
              command: ['python'],
              source: `
import json
data = json.loads('{{inputs.parameters.input-data}}')
data['processed'] = True
data['processing_mode'] = '{{inputs.parameters.mode}}'
if '{{inputs.parameters.mode}}' == 'fast':
    data['value'] = data['value'] * 2
elif '{{inputs.parameters.mode}}' == 'thorough':
    data['value'] = data['value'] * 3
    data['quality'] = 'high'
else:
    data['value'] = data['value'] * 1.5
print(json.dumps(data))
              `.trim()
            }
          },
          {
            name: 'transform',
            inputs: {
              parameters: [
                {
                  name: 'processed-data'
                }
              ]
            },
            container: {
              image: 'alpine:latest',
              command: ['sh', '-c'],
              args: [
                'echo "Final transformed data:"; ' +
                'echo \'{{inputs.parameters.processed-data}}\' | ' +
                'sed \'s/,/,\\n/g\' | sed \'s/{/{\\n/g\' | sed \'s/}/\\n}/g\''
              ]
            }
          }
        ]
      }
    });

    // Batch Processing WorkflowTemplate with Dynamic Parallelism
    new WorkflowTemplate(this, 'batch-processor-template', {
      metadata: {
        name: 'batch-processor-template',
        namespace: 'argo',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'workflow-type': 'batch-processing'
        },
        annotations: {
          'workflows.argoproj.io/description': 'Batch processing with dynamic parallelism',
          'workflows.argoproj.io/tags': 'batch,parallel,processing'
        }
      },
      spec: {
        serviceAccountName: 'argo-workflow',
        entrypoint: 'batch-process',
        parallelism: 2,  // Default parallelism for the workflow
        arguments: {
          parameters: [
            {
              name: 'batch-size',
              value: '5'
            },
            {
              name: 'parallel-limit',
              value: '2'
            }
          ]
        },
        templates: [
          {
            name: 'batch-process',
            steps: [
              [
                {
                  name: 'generate-batch',
                  template: 'generate-items',
                  arguments: {
                    parameters: [
                      {
                        name: 'count',
                        value: '{{workflow.parameters.batch-size}}'
                      }
                    ]
                  }
                }
              ],
              [
                {
                  name: 'process-items',
                  template: 'process-item',
                  arguments: {
                    parameters: [
                      {
                        name: 'item',
                        value: '{{item}}'
                      }
                    ]
                  },
                  withParam: '{{steps.generate-batch.outputs.result}}'
                }
              ],
              [
                {
                  name: 'summarize',
                  template: 'summarize-batch'
                }
              ]
            ]
          },
          {
            name: 'generate-items',
            inputs: {
              parameters: [
                {
                  name: 'count'
                }
              ]
            },
            script: {
              image: 'python:3.9-alpine',
              command: ['python'],
              source: `
import json
count = int('{{inputs.parameters.count}}')
items = [f"item-{i+1}" for i in range(count)]
print(json.dumps(items))
              `.trim()
            }
          },
          {
            name: 'process-item',
            inputs: {
              parameters: [
                {
                  name: 'item'
                }
              ]
            },
            container: {
              image: 'alpine:latest',
              command: ['sh', '-c'],
              args: [
                'echo "Processing {{inputs.parameters.item}}..."; ' +
                'sleep $((RANDOM % 3 + 1)); ' +
                'echo "{{inputs.parameters.item}} processed successfully!"'
              ]
            }
          },
          {
            name: 'summarize-batch',
            container: {
              image: 'alpine:latest',
              command: ['sh', '-c'],
              args: [
                'echo "Batch processing completed!"; ' +
                'echo "Total items processed: {{workflow.parameters.batch-size}}"; ' +
                'echo "Parallelism limit: {{workflow.parameters.parallel-limit}}"'
              ]
            }
          }
        ]
      }
    });

    // ClusterWorkflowTemplate for common utilities
    new ClusterWorkflowTemplate(this, 'utility-template', {
      metadata: {
        name: 'utility-templates',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'workflow-type': 'utilities'
        },
        annotations: {
          'workflows.argoproj.io/description': 'Common utility templates available cluster-wide',
          'workflows.argoproj.io/tags': 'utilities,common'
        }
      },
      spec: {
        templates: [
          {
            name: 'echo-message',
            inputs: {
              parameters: [
                {
                  name: 'message'
                }
              ]
            },
            container: {
              image: 'alpine:latest',
              command: ['echo'],
              args: ['{{inputs.parameters.message}}']
            }
          },
          {
            name: 'http-request',
            inputs: {
              parameters: [
                {
                  name: 'url'
                },
                {
                  name: 'method',
                  default: 'GET'
                }
              ]
            },
            container: {
              image: 'curlimages/curl:latest',
              command: ['curl'],
              args: ['-X', '{{inputs.parameters.method}}', '{{inputs.parameters.url}}', '-v']
            }
          },
          {
            name: 'json-processor',
            inputs: {
              parameters: [
                {
                  name: 'json-data'
                },
                {
                  name: 'jq-filter',
                  default: '.'
                }
              ]
            },
            container: {
              image: 'stedolan/jq:latest',
              command: ['sh', '-c'],
              args: [
                'echo \'{{inputs.parameters.json-data}}\' | jq \'{{inputs.parameters.jq-filter}}\''
              ]
            }
          }
        ]
      }
    });

    // WorkflowTemplate that uses ClusterWorkflowTemplate
    new WorkflowTemplate(this, 'composite-template', {
      metadata: {
        name: 'composite-workflow-template',
        namespace: 'argo',
        labels: {
          'app.kubernetes.io/managed-by': 'cdk8s',
          'workflow-type': 'composite'
        },
        annotations: {
          'workflows.argoproj.io/description': 'Demonstrates using templates from ClusterWorkflowTemplate',
          'workflows.argoproj.io/tags': 'composite,advanced'
        }
      },
      spec: {
        serviceAccountName: 'argo-workflow',
        entrypoint: 'main',
        arguments: {
          parameters: [
            {
              name: 'api-url',
              value: 'https://api.github.com/repos/argoproj/argo-workflows'
            }
          ]
        },
        templates: [
          {
            name: 'main',
            steps: [
              [
                {
                  name: 'fetch-data',
                  templateRef: {
                    name: 'utility-templates',
                    template: 'http-request',
                    clusterScope: true
                  },
                  arguments: {
                    parameters: [
                      {
                        name: 'url',
                        value: '{{workflow.parameters.api-url}}'
                      }
                    ]
                  }
                }
              ],
              [
                {
                  name: 'echo-result',
                  templateRef: {
                    name: 'utility-templates',
                    template: 'echo-message',
                    clusterScope: true
                  },
                  arguments: {
                    parameters: [
                      {
                        name: 'message',
                        value: 'API request completed successfully!'
                      }
                    ]
                  }
                }
              ]
            ]
          }
        ]
      }
    });
  }
}