#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';

/**
 * This script restructures the CDK8S output to match IDPBuilder package structure
 * It copies values files and organizes manifests into the proper directory structure
 */

const DIST_DIR = path.join(__dirname, '..', 'dist');
const SOURCE_DIR = path.join(__dirname, '..', '..', 'ai-platform-engineering');

interface PackageStructure {
  name: string;
  hasValues?: boolean;
  manifests?: string[];
}

const packages: PackageStructure[] = [
  {
    name: 'vault',
    hasValues: true,
    manifests: ['vault-ingress.yaml', 'vault-secret-store.yaml', 'vault-init-job.yaml', 'vault-config-job.yaml', 'vault-unsealer.yaml']
  },
  {
    name: 'backstage',
    manifests: ['backstage-argocd-secrets.yaml', 'backstage-namespace-rbac.yaml', 'backstage-secrets.yaml', 'backstage-database.yaml', 'backstage-app.yaml']
  },
  {
    name: 'ai-platform-engineering',
    manifests: ['ai-platform-engineering-ingress.yaml']
  }
];

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src: string, dest: string) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${src} to ${dest}`);
  } else {
    console.warn(`Source file not found: ${src}`);
  }
}

function main() {
  console.log('Restructuring CDK8S output for IDPBuilder compatibility...');

  packages.forEach(pkg => {
    const pkgDir = path.join(DIST_DIR, pkg.name);
    const manifestsDir = path.join(pkgDir, 'manifests');

    // Create package directories
    ensureDir(pkgDir);
    ensureDir(manifestsDir);

    // Copy values file if exists
    if (pkg.hasValues) {
      const sourceValues = path.join(SOURCE_DIR, pkg.name, 'values.yaml');
      const destValues = path.join(pkgDir, 'values.yaml');
      copyFile(sourceValues, destValues);
    }

    // Move manifest files to manifests directory
    if (pkg.manifests) {
      pkg.manifests.forEach(manifest => {
        const srcManifest = path.join(DIST_DIR, manifest);
        const destManifest = path.join(manifestsDir, manifest.replace(`${pkg.name}-`, ''));
        
        if (fs.existsSync(srcManifest)) {
          fs.renameSync(srcManifest, destManifest);
          console.log(`Moved ${manifest} to ${path.relative(DIST_DIR, destManifest)}`);
        }
      });
    }
  });

  // Special handling for backstage - combine all manifests into install.yaml
  const backstageManifestsDir = path.join(DIST_DIR, 'backstage', 'manifests');
  const installYaml = path.join(backstageManifestsDir, 'install.yaml');
  const argocdSecretsYaml = path.join(backstageManifestsDir, 'argocd-secrets.yaml');
  
  // Read all backstage manifests except argocd-secrets
  const backstageFiles = fs.readdirSync(backstageManifestsDir)
    .filter(f => f.endsWith('.yaml') && f !== 'argocd-secrets.yaml')
    .sort();
  
  let combinedContent = '';
  backstageFiles.forEach(file => {
    const content = fs.readFileSync(path.join(backstageManifestsDir, file), 'utf-8');
    combinedContent += content + '\n---\n';
    if (file !== 'argocd-secrets.yaml') {
      fs.unlinkSync(path.join(backstageManifestsDir, file));
    }
  });

  if (combinedContent) {
    fs.writeFileSync(installYaml, combinedContent.trim());
    console.log('Created backstage/manifests/install.yaml');
  }

  console.log('Package restructuring complete!');
}

main();