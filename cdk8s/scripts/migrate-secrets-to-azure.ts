#!/usr/bin/env ts-node

/**
 * Migration script to copy secrets from HashiCorp Vault to Azure Key Vault
 * 
 * Prerequisites:
 * - Azure CLI installed and authenticated
 * - Vault CLI installed
 * - Environment variables set:
 *   - VAULT_ADDR: Vault server address
 *   - VAULT_TOKEN: Vault authentication token
 *   - AZURE_KEYVAULT_NAME: Target Azure Key Vault name
 * 
 * Usage:
 *   npm run migrate-secrets-to-azure
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface SecretMapping {
  vaultPath: string;
  azureKeyName: string;
  properties: string[];
}

// Define the mapping between Vault paths and Azure Key Vault secret names
const secretMappings: SecretMapping[] = [
  {
    vaultPath: 'secret/ai-platform-engineering/global',
    azureKeyName: 'ai-platform-engineering-global',
    properties: [
      'LLM_PROVIDER',
      'AZURE_OPENAI_API_KEY',
      'AZURE_OPENAI_ENDPOINT',
      'AZURE_OPENAI_API_VERSION',
      'AZURE_OPENAI_DEPLOYMENT',
      'OPENAI_API_KEY',
      'OPENAI_ENDPOINT',
      'OPENAI_MODEL_NAME',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_REGION',
      'AWS_BEDROCK_MODEL_ID',
      'AWS_BEDROCK_PROVIDER'
    ]
  },
  {
    vaultPath: 'secret/ai-platform-engineering/argocd-secret',
    azureKeyName: 'ai-platform-engineering-argocd',
    properties: ['ARGOCD_TOKEN', 'ARGOCD_API_URL', 'ARGOCD_VERIFY_SSL']
  },
  {
    vaultPath: 'secret/ai-platform-engineering/github-secret',
    azureKeyName: 'ai-platform-engineering-github',
    properties: ['GITHUB_PERSONAL_ACCESS_TOKEN']
  },
  {
    vaultPath: 'secret/ai-platform-engineering/jira-secret',
    azureKeyName: 'ai-platform-engineering-jira',
    properties: ['ATLASSIAN_TOKEN', 'ATLASSIAN_EMAIL', 'ATLASSIAN_API_URL', 'ATLASSIAN_VERIFY_SSL']
  },
  {
    vaultPath: 'secret/ai-platform-engineering/pagerduty-secret',
    azureKeyName: 'ai-platform-engineering-pagerduty',
    properties: ['PAGERDUTY_API_KEY', 'PAGERDUTY_API_URL']
  },
  {
    vaultPath: 'secret/ai-platform-engineering/slack-secret',
    azureKeyName: 'ai-platform-engineering-slack',
    properties: ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'SLACK_SIGNING_SECRET', 'SLACK_CLIENT_SECRET', 'SLACK_TEAM_ID']
  }
];

function execCommand(command: string): string {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (error: any) {
    console.error(`Error executing command: ${command}`);
    console.error(error.message);
    return '';
  }
}

function validateEnvironment(): void {
  const requiredEnvVars = ['VAULT_ADDR', 'VAULT_TOKEN', 'AZURE_KEYVAULT_NAME'];
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    console.error('Please set:');
    missing.forEach(envVar => {
      console.error(`  export ${envVar}=<value>`);
    });
    process.exit(1);
  }

  // Check if tools are installed
  try {
    execSync('vault version', { stdio: 'ignore' });
  } catch {
    console.error('Vault CLI not found. Please install vault.');
    process.exit(1);
  }

  try {
    execSync('az --version', { stdio: 'ignore' });
  } catch {
    console.error('Azure CLI not found. Please install az.');
    process.exit(1);
  }

  // Check Azure CLI authentication
  const accountInfo = execCommand('az account show');
  if (!accountInfo) {
    console.error('Not authenticated to Azure. Please run: az login');
    process.exit(1);
  }
}

function readVaultSecret(path: string): Record<string, any> {
  console.log(`Reading secret from Vault: ${path}`);
  const result = execCommand(`vault kv get -format=json ${path}`);
  
  if (!result) {
    console.warn(`  No secret found at ${path}`);
    return {};
  }

  try {
    const parsed = JSON.parse(result);
    return parsed.data?.data || {};
  } catch (error) {
    console.error(`  Failed to parse Vault response for ${path}`);
    return {};
  }
}

function createAzureKeyVaultSecret(name: string, value: Record<string, any>): boolean {
  const keyVaultName = process.env.AZURE_KEYVAULT_NAME;
  console.log(`Creating/updating Azure Key Vault secret: ${name}`);
  
  // Convert object to JSON string
  const jsonValue = JSON.stringify(value, null, 2);
  
  // Create temporary file to avoid command line length issues
  const tmpFile = path.join('/tmp', `${name}-secret.json`);
  fs.writeFileSync(tmpFile, jsonValue);
  
  try {
    // Create or update the secret
    execCommand(`az keyvault secret set --vault-name ${keyVaultName} --name "${name}" --file "${tmpFile}" --content-type "application/json"`);
    console.log(`  ✓ Successfully created/updated secret: ${name}`);
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to create/update secret: ${name}`);
    return false;
  } finally {
    // Clean up temporary file
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  }
}

async function migrateSecrets(): Promise<void> {
  console.log('Starting secret migration from Vault to Azure Key Vault...\n');
  
  validateEnvironment();
  
  const results = {
    successful: 0,
    failed: 0,
    skipped: 0
  };

  for (const mapping of secretMappings) {
    console.log(`\nProcessing: ${mapping.vaultPath} -> ${mapping.azureKeyName}`);
    
    // Read from Vault
    const vaultData = readVaultSecret(mapping.vaultPath);
    
    if (Object.keys(vaultData).length === 0) {
      console.log('  Skipping: No data found in Vault');
      results.skipped++;
      continue;
    }

    // Filter only the properties we need
    const filteredData: Record<string, any> = {};
    for (const prop of mapping.properties) {
      if (vaultData[prop] !== undefined) {
        filteredData[prop] = vaultData[prop];
      } else {
        // Set empty string for missing properties
        filteredData[prop] = '';
      }
    }

    // Create in Azure Key Vault
    if (createAzureKeyVaultSecret(mapping.azureKeyName, filteredData)) {
      results.successful++;
    } else {
      results.failed++;
    }
  }

  console.log('\n=== Migration Summary ===');
  console.log(`Successful: ${results.successful}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Total: ${secretMappings.length}`);

  if (results.failed > 0) {
    console.error('\nMigration completed with errors. Please review the failed secrets.');
    process.exit(1);
  } else {
    console.log('\nMigration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Verify secrets in Azure Portal');
    console.log('2. Update any missing or placeholder values');
    console.log('3. Test with: export AI_PLATFORM_SECRET_STORE=azure-keyvault-store');
    console.log('4. Update applications.ts to use aiPlatformAzureConfig');
  }
}

// Run the migration
migrateSecrets().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});