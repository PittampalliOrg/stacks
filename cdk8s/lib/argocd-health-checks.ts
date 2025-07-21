/**
 * ArgoCD Custom Health Checks
 * 
 * This module provides custom health check configurations for ArgoCD
 * to better handle External Secrets and other custom resources.
 */

export const externalSecretHealthCheck = `
health_status = {}
if obj.status ~= nil then
  if obj.status.conditions ~= nil then
    for i, condition in ipairs(obj.status.conditions) do
      if condition.type == "Ready" then
        if condition.status == "True" then
          health_status.status = "Healthy"
          health_status.message = condition.message or "ExternalSecret is ready"
          return health_status
        else
          health_status.status = "Degraded"
          health_status.message = condition.message or "ExternalSecret is not ready"
          return health_status
        end
      end
    end
  end
  if obj.status.refreshTime ~= nil then
    health_status.status = "Progressing"
    health_status.message = "ExternalSecret is refreshing"
    return health_status
  end
end
health_status.status = "Progressing"
health_status.message = "Waiting for ExternalSecret to sync"
return health_status
`;

export const clusterSecretStoreHealthCheck = `
health_status = {}
if obj.status ~= nil then
  if obj.status.conditions ~= nil then
    for i, condition in ipairs(obj.status.conditions) do
      if condition.type == "Ready" then
        if condition.status == "True" then
          health_status.status = "Healthy"
          health_status.message = condition.message or "ClusterSecretStore is ready"
          return health_status
        else
          health_status.status = "Degraded"  
          health_status.message = condition.message or "ClusterSecretStore is not ready"
          return health_status
        end
      end
    end
  end
end
health_status.status = "Progressing"
health_status.message = "Waiting for ClusterSecretStore to be ready"
return health_status
`;

export const githubAccessTokenHealthCheck = `
health_status = {}
-- GithubAccessToken generator doesn't have a status field
-- We'll consider it healthy if it exists
health_status.status = "Healthy"
health_status.message = "GithubAccessToken generator created"
return health_status
`;