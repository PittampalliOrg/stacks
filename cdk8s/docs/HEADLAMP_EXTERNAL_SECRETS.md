# Managing External Secrets with Headlamp

This guide explains how to manage External Secrets through the Headlamp Kubernetes dashboard.

## Overview

Headlamp has been configured to support External Secrets management through its native Custom Resource Definition (CRD) support. Since External Secrets Operator uses CRDs (ExternalSecret, SecretStore, ClusterSecretStore), you can view and manage these resources directly in Headlamp.

## Architecture

The Headlamp deployment has been enhanced with:
- Plugin management capabilities via sidecar container
- Volume mounts for plugin persistence
- Plugin watching enabled for dynamic plugin loading
- ConfigMap-based plugin configuration

## Accessing External Secrets in Headlamp

1. **Navigate to Custom Resources**
   - Open Headlamp dashboard
   - Go to "Workloads" → "Custom Resources"
   - Look for External Secrets resources:
     - `ExternalSecret`
     - `SecretStore`
     - `ClusterSecretStore`

2. **View External Secrets**
   - Click on any External Secret resource type
   - You'll see a list of all resources of that type
   - Click on individual resources to view details, status, and sync information

3. **Create/Edit External Secrets**
   - Use the "Create" button to add new External Secret resources
   - Edit existing resources using the YAML editor
   - Monitor sync status in the resource details view

## Plugin Management

The Headlamp Chart now supports plugin management. To add plugins:

```typescript
new HeadlampChart(this, 'headlamp', {
  enablePluginManager: true,  // Enabled by default
  plugins: [
    {
      name: 'my-plugin',
      source: 'https://artifacthub.io/packages/headlamp/my-repo/my_plugin',
      version: '1.0.0'
    }
  ]
});
```

## Features

### Current Capabilities
- View all External Secret resources across namespaces
- Create and edit External Secret configurations
- Monitor sync status and errors
- Access secret store configurations
- Full YAML editing support

### Plugin System Benefits
- Extensible architecture for future enhancements
- Dynamic plugin loading with watch mode
- Persistent plugin storage
- Sidecar-based plugin management

## Best Practices

1. **Resource Organization**
   - Use meaningful names for External Secrets
   - Group related secrets in the same namespace
   - Use labels for better organization

2. **Security**
   - Limit access to SecretStore configurations
   - Use ClusterSecretStore for shared configurations
   - Monitor sync failures for security issues

3. **Monitoring**
   - Regularly check sync status
   - Set up alerts for sync failures
   - Review secret refresh intervals

## Future Enhancements

While Headlamp's native CRD support provides good functionality for External Secrets management, future enhancements could include:

1. **Custom External Secrets Plugin**
   - Enhanced UI for External Secret creation
   - Visual secret store configuration
   - Sync status dashboard
   - Quick actions for refresh/sync

2. **Integration Features**
   - Direct integration with secret providers
   - Secret validation tools
   - Audit logging for secret access

## Troubleshooting

### Plugin Not Loading
- Check Headlamp logs for plugin errors
- Verify plugin configuration in ConfigMap
- Ensure plugin source URL is accessible

### External Secrets Not Visible
- Verify External Secrets Operator is installed
- Check RBAC permissions for Headlamp service account
- Ensure CRDs are properly registered

### Sync Failures
- Check SecretStore configuration
- Verify provider credentials
- Review External Secret spec for errors

## Reference

- [Headlamp Documentation](https://headlamp.dev/)
- [External Secrets Operator](https://external-secrets.io/)
- [Headlamp Plugins on Artifact Hub](https://artifacthub.io/packages/search?kind=19)