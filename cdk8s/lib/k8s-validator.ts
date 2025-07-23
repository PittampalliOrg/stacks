import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface ValidationResult {
  file: string;
  violations: Violation[];
}

interface Violation {
  rule: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  resource: string;
}

export class K8sValidator {
  private violations: ValidationResult[] = [];

  public async validateDirectory(dir: string): Promise<ValidationResult[]> {
    const files = this.getAllYamlFiles(dir);
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const docs = yaml.loadAll(content);
      
      const fileViolations: Violation[] = [];
      
      for (const doc of docs) {
        if (doc && typeof doc === 'object') {
          this.validateResource(doc as any, file, fileViolations);
        }
      }
      
      if (fileViolations.length > 0) {
        this.violations.push({ file, violations: fileViolations });
      }
    }
    
    return this.violations;
  }

  private getAllYamlFiles(dir: string): string[] {
    const files: string[] = [];
    
    const walk = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir);
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
          files.push(fullPath);
        }
      }
    };
    
    walk(dir);
    return files;
  }

  private validateResource(resource: any, file: string, violations: Violation[]) {
    const kind = resource.kind;
    const metadata = resource.metadata || {};
    const name = metadata.name || 'unknown';
    const resourceId = `${kind}/${name}`;

    // Check for common issues based on resource type
    switch (kind) {
      case 'Deployment':
      case 'StatefulSet':
      case 'DaemonSet':
        this.validateWorkload(resource, resourceId, violations);
        break;
      case 'Service':
        this.validateService(resource, resourceId, violations);
        break;
      case 'Ingress':
        this.validateIngress(resource, resourceId, violations);
        break;
      case 'ConfigMap':
      case 'Secret':
        this.validateConfigMapSecret(resource, resourceId, violations);
        break;
    }

    // Common validations for all resources
    this.validateMetadata(resource, resourceId, violations);
  }

  private validateWorkload(resource: any, resourceId: string, violations: Violation[]) {
    const spec = resource.spec || {};
    const template = spec.template || {};
    const podSpec = template.spec || {};
    const containers = podSpec.containers || [];

    // Check replicas
    if (resource.kind === 'Deployment' && !spec.replicas) {
      violations.push({
        rule: 'DEPLOYMENT_MISSING_REPLICAS',
        message: 'Deployment should specify replicas',
        severity: 'warning',
        resource: resourceId
      });
    }

    // Check containers
    for (const container of containers) {
      const containerName = container.name || 'unknown';
      const containerId = `${resourceId}/container/${containerName}`;

      // Check image tag
      if (!container.image || container.image.endsWith(':latest') || !container.image.includes(':')) {
        violations.push({
          rule: 'CONTAINER_IMAGE_TAG_MISSING',
          message: `Container ${containerName} is using latest tag or missing tag`,
          severity: 'error',
          resource: containerId
        });
      }

      // Check resources
      if (!container.resources) {
        violations.push({
          rule: 'CONTAINER_MISSING_RESOURCES',
          message: `Container ${containerName} is missing resource requests and limits`,
          severity: 'warning',
          resource: containerId
        });
      } else {
        if (!container.resources.requests?.memory || !container.resources.limits?.memory) {
          violations.push({
            rule: 'CONTAINER_MISSING_MEMORY_REQUEST_LIMIT',
            message: `Container ${containerName} is missing memory request or limit`,
            severity: 'warning',
            resource: containerId
          });
        }
        if (!container.resources.requests?.cpu || !container.resources.limits?.cpu) {
          violations.push({
            rule: 'CONTAINER_MISSING_CPU_REQUEST_LIMIT',
            message: `Container ${containerName} is missing CPU request or limit`,
            severity: 'warning',
            resource: containerId
          });
        }
      }

      // Check probes
      if (!container.livenessProbe) {
        violations.push({
          rule: 'CONTAINER_MISSING_LIVENESS_PROBE',
          message: `Container ${containerName} is missing liveness probe`,
          severity: 'info',
          resource: containerId
        });
      }

      if (!container.readinessProbe) {
        violations.push({
          rule: 'CONTAINER_MISSING_READINESS_PROBE',
          message: `Container ${containerName} is missing readiness probe`,
          severity: 'info',
          resource: containerId
        });
      }

      // Check security context
      if (!container.securityContext) {
        violations.push({
          rule: 'CONTAINER_MISSING_SECURITY_CONTEXT',
          message: `Container ${containerName} is missing security context`,
          severity: 'warning',
          resource: containerId
        });
      }
    }

    // Check pod security context
    if (!podSpec.securityContext) {
      violations.push({
        rule: 'WORKLOAD_MISSING_SECURITY_CONTEXT',
        message: 'Workload is missing pod security context',
        severity: 'warning',
        resource: resourceId
      });
    }
  }

  private validateService(resource: any, resourceId: string, violations: Violation[]) {
    const spec = resource.spec || {};

    if (!spec.selector || Object.keys(spec.selector).length === 0) {
      violations.push({
        rule: 'SERVICE_MISSING_SELECTOR',
        message: 'Service is missing selector',
        severity: 'error',
        resource: resourceId
      });
    }
  }

  private validateIngress(resource: any, resourceId: string, violations: Violation[]) {
    const spec = resource.spec || {};
    const rules = spec.rules || [];

    for (const rule of rules) {
      if (rule.host && !this.isValidDomain(rule.host)) {
        violations.push({
          rule: 'INGRESS_INVALID_HOST',
          message: `Ingress host "${rule.host}" is not a valid domain`,
          severity: 'warning',
          resource: resourceId
        });
      }
    }
  }

  private validateConfigMapSecret(resource: any, resourceId: string, violations: Violation[]) {
    const data = resource.data || {};
    const binaryData = resource.binaryData || {};

    if (Object.keys(data).length === 0 && Object.keys(binaryData).length === 0) {
      violations.push({
        rule: 'CONFIGMAP_SECRET_EMPTY',
        message: `${resource.kind} has no data`,
        severity: 'info',
        resource: resourceId
      });
    }
  }

  private validateMetadata(resource: any, resourceId: string, violations: Violation[]) {
    const metadata = resource.metadata || {};

    if (!metadata.labels || Object.keys(metadata.labels).length === 0) {
      violations.push({
        rule: 'RESOURCE_MISSING_LABELS',
        message: 'Resource is missing labels',
        severity: 'info',
        resource: resourceId
      });
    }
  }

  private isValidDomain(domain: string): boolean {
    // Basic domain validation
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    return domainRegex.test(domain) || domain === 'localhost';
  }

  public printReport() {
    if (this.violations.length === 0) {
      console.log('\n✅ No violations found!');
      return;
    }

    console.log('\n🔍 Validation Report:');
    console.log('====================\n');

    let totalViolations = 0;
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    for (const result of this.violations) {
      console.log(`📄 File: ${result.file}`);
      
      for (const violation of result.violations) {
        totalViolations++;
        
        const icon = violation.severity === 'error' ? '❌' : 
                    violation.severity === 'warning' ? '⚠️' : 'ℹ️';
        
        console.log(`  ${icon} [${violation.severity.toUpperCase()}] ${violation.rule}`);
        console.log(`     Resource: ${violation.resource}`);
        console.log(`     Message: ${violation.message}`);
        console.log('');

        if (violation.severity === 'error') errorCount++;
        else if (violation.severity === 'warning') warningCount++;
        else infoCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Total violations: ${totalViolations}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   ⚠️  Warnings: ${warningCount}`);
    console.log(`   ℹ️  Info: ${infoCount}`);
  }
}