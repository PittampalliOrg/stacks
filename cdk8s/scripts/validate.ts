#!/usr/bin/env ts-node

import { K8sValidator } from '../lib/k8s-validator';
import * as path from 'path';

async function main() {
  const distDir = path.join(__dirname, '..', 'dist');
  
  console.log('🚀 Running Kubernetes manifest validation...');
  console.log(`📁 Validating directory: ${distDir}`);
  
  const validator = new K8sValidator();
  const results = await validator.validateDirectory(distDir);
  
  validator.printReport();
  
  // Exit with error if there are any error-level violations
  const hasErrors = results.some(r => r.violations.some(v => v.severity === 'error'));
  if (hasErrors) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});