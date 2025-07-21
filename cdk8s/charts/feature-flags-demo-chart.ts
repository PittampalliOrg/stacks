import { Construct } from 'constructs';
import { Chart, ChartProps } from 'cdk8s';
import { ApiObject } from 'cdk8s';

export class FeatureFlagsDemoChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    // Create the FeatureFlag custom resource
    new ApiObject(this, 'demo-flags', {
      apiVersion: 'core.openfeature.dev/v1beta1',
      kind: 'FeatureFlag',
      metadata: {
        name: 'demo-flags',
        namespace: props.namespace || 'default',
      },
      spec: {
        flagSpec: {
          flags: {
            enableNewUI: {
              state: 'ENABLED',
              variants: {
                'true': true,
                'false': false,
              },
              defaultVariant: 'false',
              targeting: {},
            },
            welcomeMessage: {
              state: 'ENABLED',
              variants: {
                default: 'Welcome to our app!',
                preview: 'Welcome to the preview version!',
                beta: 'Welcome to the beta!',
              },
              defaultVariant: 'default',
              targeting: {},
            },
            maxItems: {
              state: 'ENABLED',
              variants: {
                small: 10,
                medium: 50,
                large: 100,
              },
              defaultVariant: 'small',
              targeting: {},
            },
            theme: {
              state: 'ENABLED',
              variants: {
                default: {
                  primary: 'blue',
                  secondary: 'green',
                },
                dark: {
                  primary: '#1a1a1a',
                  secondary: '#2d2d2d',
                },
                colorful: {
                  primary: '#ff6b6b',
                  secondary: '#4ecdc4',
                },
              },
              defaultVariant: 'default',
              targeting: {},
            },
          },
        },
      },
    });
  }
}