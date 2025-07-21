import { IResolver, ResolutionContext } from 'cdk8s';

/**
 * Simple environment resolver that replaces ${VARIABLE} placeholders
 * with values from environment variables available in the ArgoCD repo-server
 */
export class EnvironmentResolver implements IResolver {
  constructor() {
    // No initialization needed - we'll use process.env directly
  }

  public resolve(context: ResolutionContext): void {
    // Only process string values
    if (typeof context.value !== 'string') {
      return;
    }

    // Look for placeholders like ${VARIABLE_NAME}
    const placeholderRegex = /\$\{([^}]+)\}/g;
    let hasReplacement = false;
    
    const newValue = context.value.replace(placeholderRegex, (match, varName) => {
      // First try with ARGOCD_ENV_ prefix
      let value = process.env[`ARGOCD_ENV_${varName}`];
      
      // If not found, try without prefix (for Azure, GitHub, Git vars)
      if (!value) {
        value = process.env[varName];
      }
      
      if (value !== undefined) {
        hasReplacement = true;
        return value;
      }
      
      // Return original placeholder if no value found
      return match;
    });

    if (hasReplacement) {
      context.replaceValue(newValue);
    }
  }
}