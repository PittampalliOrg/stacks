import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';

export interface NextJsFeatureFlagsChartProps extends ChartProps {
  namespace?: string;
}

/**
 * Next.js Application Feature Flags Chart
 * Manages feature flags for Next.js application features
 */
export class NextJsFeatureFlagsChart extends Chart {
  constructor(scope: Construct, id: string, props: NextJsFeatureFlagsChartProps = {}) {
    super(scope, id, props);

    const namespace = props.namespace || 'default';

    // Create FeatureFlag for Next.js application features
    new ApiObject(this, 'nextjs-app-features', {
      apiVersion: 'core.openfeature.dev/v1beta1',
      kind: 'FeatureFlag',
      metadata: {
        name: 'nextjs-app-features',
        namespace,
        annotations: {
          'argocd.argoproj.io/sync-wave': '8' // After infrastructure but before app deployment
        }
      },
      spec: {
        flagSpec: {
          flags: {
            // AI Model Features
            'enable-reasoning-model': {
              state: 'ENABLED',
              variants: {
                on: true,
                off: false
              },
              defaultVariant: 'on',
              // Temporarily disable complex targeting until we fix the syntax
              // targeting: {
              //   if: [
              //     { var: 'environment' },
              //     { '==': [{ var: 'environment' }, 'production'] },
              //     'on',
              //     'off'
              //   ]
              // }
            },
            
            // File Upload Configuration
            'max-file-upload-size': {
              state: 'ENABLED',
              variants: {
                small: 10,    // 10MB
                medium: 50,   // 50MB
                large: 100    // 100MB
              },
              defaultVariant: 'small',
              // Temporarily disable complex targeting until we fix the syntax
              // targeting: {
              //   if: [
              //     { var: 'environment' },
              //     { '==': [{ var: 'environment' }, 'production'] },
              //     'medium',
              //     'small'
              //   ]
              // }
            },
            
            // Feature Toggles
            'enable-mcp-servers': {
              state: 'ENABLED',
              variants: {
                on: true,
                off: false
              },
              defaultVariant: 'on'
            },
            
            'enable-artifact-creation': {
              state: 'ENABLED',
              variants: {
                on: true,
                off: false
              },
              defaultVariant: 'on'
            },
            
            'enable-weather-tool': {
              state: 'ENABLED',
              variants: {
                on: true,
                off: false
              },
              defaultVariant: 'on'
            },
            
            // Experimental Features
            'enable-code-execution': {
              state: 'ENABLED',
              variants: {
                on: true,
                off: false
              },
              defaultVariant: 'off' // Disabled by default for safety
            },
            
            'enable-image-generation': {
              state: 'ENABLED',
              variants: {
                on: true,
                off: false
              },
              defaultVariant: 'off'
            },
            
            // Rate Limiting
            'rate-limit-requests-per-minute': {
              state: 'ENABLED',
              variants: {
                low: 10,
                medium: 30,
                high: 60,
                unlimited: 999999
              },
              defaultVariant: 'medium',
              // Temporarily disable complex targeting until we fix the syntax
              // targeting: {
              //   if: [
              //     { var: 'userTier' },
              //     { '==': [{ var: 'userTier' }, 'premium'] },
              //     'high',
              //     'medium'
              //   ]
              // }
            },
            
            // A/B Testing
            'ui-theme-variant': {
              state: 'ENABLED',
              variants: {
                classic: 'classic',
                modern: 'modern',
                experimental: 'experimental'
              },
              defaultVariant: 'classic',
              // Temporarily disable complex targeting until we fix the syntax
              // targeting: {
              //   fractional: [
              //     { var: 'userId' },
              //     [
              //       ['modern', 20],
              //       ['experimental', 5],
              //       ['classic', 75]
              //     ]
              //   ]
              // }
            },
            
            // Maintenance Mode
            'maintenance-mode': {
              state: 'ENABLED',
              variants: {
                on: true,
                off: false
              },
              defaultVariant: 'off'
            },
            
            // Debug Features
            'enable-debug-logs': {
              state: 'ENABLED',
              variants: {
                on: true,
                off: false
              },
              defaultVariant: 'off',
              // Temporarily disable complex targeting until we fix the syntax
              // targeting: {
              //   if: [
              //     { var: 'environment' },
              //     { '!=': [{ var: 'environment' }, 'production'] },
              //     'on',
              //     'off'
              //   ]
              // }
            },
            
            // UI Component Visibility
            'show-env-variables-display': {
              state: 'ENABLED',
              variants: {
                on: true,
                off: false
              },
              defaultVariant: 'off' // Default to hidden for security
            }
          }
        }
      }
    });
  }
}