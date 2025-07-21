import { Chart, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';

export class DaggerInfraChart extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const ns = 'argo';

    // Note: ServiceAccount 'argo-workflow' is created by the argo-workflows Helm chart
    // We only need to create the additional RBAC resources

    // Role for Argo Workflows
    new k8s.KubeRole(this, 'argo-workflow-role', {
      metadata: { 
        name: 'argo-workflow-role', 
        namespace: ns 
      },
      rules: [
        {
          apiGroups: [''],
          resources: ['pods', 'pods/exec', 'pods/log'],
          verbs: ['create', 'delete', 'get', 'list', 'patch', 'update', 'watch']
        },
        {
          apiGroups: [''],
          resources: ['configmaps'],
          verbs: ['get', 'list', 'watch']
        },
        {
          apiGroups: [''],
          resources: ['persistentvolumeclaims'],
          verbs: ['create', 'delete', 'get', 'list', 'update', 'watch']
        },
        {
          apiGroups: ['argoproj.io'],
          resources: [
            'workflows',
            'workflows/finalizers',
            'workflowtasksets',
            'workflowtasksets/finalizers',
            'workflowtemplates',
            'workflowtemplaterefs'
          ],
          verbs: ['create', 'delete', 'get', 'list', 'patch', 'update', 'watch']
        }
      ]
    });

    // RoleBinding
    new k8s.KubeRoleBinding(this, 'argo-workflow-rb', {
      metadata: { 
        name: 'argo-workflow-binding', 
        namespace: ns 
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: 'argo-workflow-role'
      },
      subjects: [{
        kind: 'ServiceAccount',
        name: 'argo-workflow',
        namespace: ns
      }]
    });

    // Note: If you have Dagger workflow templates in YAML files,
    // you can add them here. For now, this sets up the RBAC
    // infrastructure needed for Dagger workflows.
    
    // Example of how to add a workflow template:
    // new ApiObject(this, 'dagger-workflow-template', {
    //   apiVersion: 'argoproj.io/v1alpha1',
    //   kind: 'WorkflowTemplate',
    //   metadata: {
    //     name: 'dagger-build-template',
    //     namespace: ns
    //   },
    //   spec: {
    //     // ... workflow template spec
    //   }
    // });
  }
}