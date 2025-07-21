import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';
import { Quantity, IntOrString } from '../imports/k8s';

export interface FlagdUiChartProps extends ChartProps {
  namespace?: string;
}

/**
 * Flagd UI Chart
 * Provides a simple web UI for viewing FeatureFlag CRDs and monitoring
 */
export class FlagdUiChart extends Chart {
  constructor(scope: Construct, id: string, props: FlagdUiChartProps = {}) {
    super(scope, id, props);

    const namespace = props.namespace || 'default';

    // Create a ConfigMap with HTML/JS for a simple FeatureFlag viewer
    const uiConfigMap = new k8s.KubeConfigMap(this, 'flagd-ui-config', {
      metadata: {
        name: 'flagd-ui',
        namespace,
      },
      data: {
        'index.html': `<!DOCTYPE html>
<html>
<head>
    <title>Feature Flags Dashboard</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            color: #333;
            margin-bottom: 30px;
        }
        .flag-card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .flag-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .flag-name {
            font-size: 20px;
            font-weight: 600;
            color: #2c3e50;
        }
        .flag-state {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
        }
        .state-enabled {
            background: #d4edda;
            color: #155724;
        }
        .state-disabled {
            background: #f8d7da;
            color: #721c24;
        }
        .variants {
            margin-top: 15px;
        }
        .variant {
            background: #f8f9fa;
            padding: 10px;
            margin: 5px 0;
            border-radius: 4px;
            font-family: monospace;
            font-size: 14px;
        }
        .default-variant {
            background: #e7f3ff;
            border: 1px solid #b3d9ff;
        }
        .edit-btn {
            background: #28a745;
            color: white;
            border: none;
            padding: 4px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-left: 10px;
        }
        .edit-btn:hover {
            background: #218838;
        }
        .save-btn {
            background: #28a745;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 5px;
        }
        .save-btn:hover {
            background: #218838;
        }
        .cancel-btn {
            background: #6c757d;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        .cancel-btn:hover {
            background: #5a6268;
        }
        .edit-form {
            margin-top: 15px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 4px;
            border: 1px solid #dee2e6;
        }
        .form-group {
            margin-bottom: 10px;
        }
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
        }
        .form-group select,
        .form-group input {
            width: 100%;
            padding: 6px 8px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 14px;
        }
        .namespace-selector {
            margin-bottom: 20px;
        }
        select {
            padding: 8px 12px;
            font-size: 16px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }
        .error {
            background: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .refresh-btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        .refresh-btn:hover {
            background: #0056b3;
        }
        .metadata {
            color: #666;
            font-size: 14px;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Feature Flags Dashboard</h1>
        <div class="namespace-selector">
            <label for="namespace">Namespace: </label>
            <select id="namespace" onchange="loadFlags()">
                <option value="">All namespaces</option>
                <option value="default">default</option>
                <option value="nextjs">nextjs</option>
                <option value="kagent">kagent</option>
                <option value="mcp-servers">mcp-servers</option>
            </select>
            <button class="refresh-btn" onclick="loadFlags()" style="margin-left: 10px;">Refresh</button>
        </div>
        <div id="content">
            <div class="loading">Loading feature flags...</div>
        </div>
    </div>

    <script>
        let editingFlags = {};
        
        async function loadFlags() {
            const namespace = document.getElementById('namespace').value;
            const content = document.getElementById('content');
            
            content.innerHTML = '<div class="loading">Loading feature flags...</div>';
            
            try {
                const url = namespace 
                    ? \`/apis/core.openfeature.dev/v1beta1/namespaces/\${namespace}/featureflags\`
                    : '/apis/core.openfeature.dev/v1beta1/featureflags';
                    
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(\`HTTP error! status: \${response.status}\`);
                }
                
                const data = await response.json();
                
                if (!data.items || data.items.length === 0) {
                    content.innerHTML = '<p>No feature flags found.</p>';
                    return;
                }
                
                content.innerHTML = data.items.map(flag => renderFlag(flag)).join('');
                
            } catch (error) {
                content.innerHTML = \`<div class="error">Error loading feature flags: \${error.message}</div>\`;
            }
        }
        
        function renderFlag(flag) {
            const flags = flag.spec.flagSpec?.flags || {};
            const flagEntries = Object.entries(flags);
            
            if (flagEntries.length === 0) {
                return \`
                    <div class="flag-card">
                        <div class="flag-header">
                            <div class="flag-name">\${flag.metadata.name}</div>
                        </div>
                        <p>No flags defined</p>
                        <div class="metadata">
                            Namespace: \${flag.metadata.namespace || 'default'}
                        </div>
                    </div>
                \`;
            }
            
            return flagEntries.map(([flagName, flagConfig]) => \`
                <div class="flag-card">
                    <div class="flag-header">
                        <div class="flag-name">\${flagName}</div>
                        <div>
                            <span class="flag-state \${flagConfig.state === 'ENABLED' ? 'state-enabled' : 'state-disabled'}">
                                \${flagConfig.state || 'UNKNOWN'}
                            </span>
                            \${!editingFlags[flag.metadata.name + ':' + flagName] ? 
                                '<button class="edit-btn" onclick="editFlag(\'' + flag.metadata.name + '\', \'' + flagName + '\', \'' + flag.metadata.namespace + '\')">Edit</button>' : 
                                ''
                            }
                        </div>
                    </div>
                    
                    <div class="variants">
                        <strong>Variants:</strong>
                        \${Object.entries(flagConfig.variants || {}).map(([name, value]) => \`
                            <div class="variant \${name === flagConfig.defaultVariant ? 'default-variant' : ''}">
                                <strong>\${name}</strong>: \${JSON.stringify(value)}
                                \${name === flagConfig.defaultVariant ? ' (default)' : ''}
                            </div>
                        \`).join('')}
                    </div>
                    
                    \${editingFlags[flag.metadata.name + ':' + flagName] ? renderEditForm(flag, flagName, flagConfig) : ''}
                    
                    <div class="metadata">
                        Configuration: \${flag.metadata.name} | Namespace: \${flag.metadata.namespace || 'default'}
                    </div>
                </div>
            \`).join('');
        }
        
        function renderEditForm(flag, flagName, flagConfig) {
            const formId = flag.metadata.name + ':' + flagName;
            return \`
                <div class="edit-form" id="edit-form-\${formId}">
                    <div class="form-group">
                        <label for="state-\${formId}">State:</label>
                        <select id="state-\${formId}" value="\${flagConfig.state}">
                            <option value="ENABLED" \${flagConfig.state === 'ENABLED' ? 'selected' : ''}>ENABLED</option>
                            <option value="DISABLED" \${flagConfig.state === 'DISABLED' ? 'selected' : ''}>DISABLED</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="default-\${formId}">Default Variant:</label>
                        <select id="default-\${formId}">
                            \${Object.keys(flagConfig.variants || {}).map(variant => 
                                \`<option value="\${variant}" \${variant === flagConfig.defaultVariant ? 'selected' : ''}>\${variant}</option>\`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Variants:</label>
                        \${Object.entries(flagConfig.variants || {}).map(([name, value]) => \`
                            <div style="margin-bottom: 5px;">
                                <strong>\${name}:</strong>
                                <input type="text" id="variant-\${formId}-\${name}" value="\${JSON.stringify(value)}" style="width: calc(100% - 80px); margin-left: 10px;" />
                            </div>
                        \`).join('')}
                    </div>
                    <div>
                        <button class="save-btn" onclick="saveFlag('\${flag.metadata.name}', '\${flagName}', '\${flag.metadata.namespace}')">Save</button>
                        <button class="cancel-btn" onclick="cancelEdit('\${flag.metadata.name}', '\${flagName}')">Cancel</button>
                    </div>
                </div>
            \`;
        }
        
        function editFlag(featureFlagName, flagName, namespace) {
            editingFlags[featureFlagName + ':' + flagName] = true;
            loadFlags();
        }
        
        function cancelEdit(featureFlagName, flagName) {
            delete editingFlags[featureFlagName + ':' + flagName];
            loadFlags();
        }
        
        async function saveFlag(featureFlagName, flagName, namespace) {
            const formId = featureFlagName + ':' + flagName;
            const content = document.getElementById('content');
            
            try {
                // Get the current FeatureFlag resource
                const getResponse = await fetch(\`/apis/core.openfeature.dev/v1beta1/namespaces/\${namespace || 'default'}/featureflags/\${featureFlagName}\`);
                if (!getResponse.ok) {
                    throw new Error(\`Failed to get current flag: \${getResponse.status}\`);
                }
                const currentFlag = await getResponse.json();
                
                // Update the specific flag within the resource
                const newState = document.getElementById(\`state-\${formId}\`).value;
                const newDefault = document.getElementById(\`default-\${formId}\`).value;
                
                // Update variants
                const variants = {};
                const currentVariants = currentFlag.spec.flagSpec.flags[flagName].variants || {};
                Object.keys(currentVariants).forEach(variantName => {
                    const input = document.getElementById(\`variant-\${formId}-\${variantName}\`);
                    if (input) {
                        try {
                            variants[variantName] = JSON.parse(input.value);
                        } catch (e) {
                            variants[variantName] = input.value;
                        }
                    }
                });
                
                // Update the flag configuration
                currentFlag.spec.flagSpec.flags[flagName].state = newState;
                currentFlag.spec.flagSpec.flags[flagName].defaultVariant = newDefault;
                currentFlag.spec.flagSpec.flags[flagName].variants = variants;
                
                // Send the update
                const updateResponse = await fetch(\`/apis/core.openfeature.dev/v1beta1/namespaces/\${namespace || 'default'}/featureflags/\${featureFlagName}\`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(currentFlag)
                });
                
                if (!updateResponse.ok) {
                    const error = await updateResponse.text();
                    throw new Error(\`Failed to update flag: \${updateResponse.status} - \${error}\`);
                }
                
                // Clear editing state and reload
                delete editingFlags[formId];
                loadFlags();
                
            } catch (error) {
                alert(\`Error saving flag: \${error.message}\`);
            }
        }
        
        // Load flags on page load
        loadFlags();
        
        // Auto-refresh every 30 seconds (but not if editing)
        setInterval(() => {
            if (Object.keys(editingFlags).length === 0) {
                loadFlags();
            }
        }, 30000);
    </script>
</body>
</html>`,
        'nginx.conf': `server {
    listen 8080;
    server_name _;
    
    # DNS resolver for Kubernetes - using kube-dns service IP
    resolver 10.96.0.10 valid=5s;
    
    root /usr/share/nginx/html;
    index index.html;
    
    # Proxy Kubernetes API requests
    location ~ ^/apis/core.openfeature.dev/ {
        proxy_pass https://kubernetes.default.svc.cluster.local$request_uri;
        proxy_ssl_verify off;
        proxy_set_header Authorization "Bearer $SERVICE_ACCOUNT_TOKEN";
        proxy_set_header Accept application/json;
        proxy_set_header Content-Type application/json;
        
        # Enable request body for PUT/PATCH requests
        proxy_request_buffering off;
        client_max_body_size 1m;
    }
    
    location / {
        try_files $uri $uri/ =404;
    }
}`
      }
    });

    // Create ServiceAccount with permissions to read FeatureFlag CRDs
    const serviceAccount = new k8s.KubeServiceAccount(this, 'flagd-ui-sa', {
      metadata: {
        name: 'flagd-ui',
        namespace,
      },
    });

    // Create Role for reading FeatureFlag CRDs
    const role = new k8s.KubeRole(this, 'flagd-ui-role', {
      metadata: {
        name: 'flagd-ui-reader',
        namespace,
      },
      rules: [{
        apiGroups: ['core.openfeature.dev'],
        resources: ['featureflags'],
        verbs: ['get', 'list', 'watch', 'update', 'patch'],
      }],
    });

    // Bind role to service account
    new k8s.KubeRoleBinding(this, 'flagd-ui-rolebinding', {
      metadata: {
        name: 'flagd-ui-reader',
        namespace,
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: role.metadata.name!,
      },
      subjects: [{
        kind: 'ServiceAccount',
        name: serviceAccount.metadata.name!,
        namespace,
      }],
    });

    // Create ClusterRole for reading across namespaces
    const clusterRole = new k8s.KubeClusterRole(this, 'flagd-ui-cluster-role', {
      metadata: {
        name: 'flagd-ui-reader',
      },
      rules: [{
        apiGroups: ['core.openfeature.dev'],
        resources: ['featureflags'],
        verbs: ['get', 'list', 'watch', 'update', 'patch'],
      }],
    });

    // Bind cluster role to service account
    new k8s.KubeClusterRoleBinding(this, 'flagd-ui-clusterrolebinding', {
      metadata: {
        name: 'flagd-ui-reader',
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: clusterRole.metadata.name!,
      },
      subjects: [{
        kind: 'ServiceAccount',
        name: serviceAccount.metadata.name!,
        namespace,
      }],
    });

    // Create Deployment for the UI
    const deployment = new k8s.KubeDeployment(this, 'flagd-ui-deployment', {
      metadata: {
        name: 'flagd-ui',
        namespace,
        labels: {
          app: 'flagd-ui',
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: 'flagd-ui',
          },
        },
        template: {
          metadata: {
            labels: {
              app: 'flagd-ui',
            },
          },
          spec: {
            serviceAccountName: serviceAccount.metadata.name,
            initContainers: [{
              name: 'token-reader',
              image: 'busybox:1.36',
              command: ['sh', '-c'],
              args: [`
                TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
                echo "SERVICE_ACCOUNT_TOKEN=$TOKEN" > /shared/token.env
              `],
              volumeMounts: [{
                name: 'shared',
                mountPath: '/shared',
              }],
            }],
            containers: [{
              name: 'nginx',
              image: 'nginx:alpine',
              command: ['sh', '-c'],
              args: [`
                export $(cat /shared/token.env)
                envsubst '$SERVICE_ACCOUNT_TOKEN' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
                nginx -g 'daemon off;'
              `],
              ports: [{
                containerPort: 8080,
              }],
              volumeMounts: [
                {
                  name: 'config',
                  mountPath: '/usr/share/nginx/html/index.html',
                  subPath: 'index.html',
                },
                {
                  name: 'config',
                  mountPath: '/etc/nginx/conf.d/default.conf.template',
                  subPath: 'nginx.conf',
                },
                {
                  name: 'shared',
                  mountPath: '/shared',
                },
              ],
              resources: {
                requests: {
                  cpu: Quantity.fromString('10m'),
                  memory: Quantity.fromString('32Mi'),
                },
                limits: {
                  cpu: Quantity.fromString('100m'),
                  memory: Quantity.fromString('128Mi'),
                },
              },
            }],
            volumes: [
              {
                name: 'config',
                configMap: {
                  name: uiConfigMap.metadata.name!,
                },
              },
              {
                name: 'shared',
                emptyDir: {},
              },
            ],
          },
        },
      },
    });

    // Create Service
    const service = new k8s.KubeService(this, 'flagd-ui-service', {
      metadata: {
        name: 'flagd-ui',
        namespace,
        labels: {
          app: 'flagd-ui',
        },
      },
      spec: {
        selector: {
          app: 'flagd-ui',
        },
        ports: [{
          port: 80,
          targetPort: IntOrString.fromNumber(8080),
          protocol: 'TCP',
        }],
        type: 'ClusterIP',
      },
    });

    // Create Ingress
    new k8s.KubeIngress(this, 'flagd-ui-ingress', {
      metadata: {
        name: 'flagd-ui',
        namespace,
        annotations: {
          'nginx.ingress.kubernetes.io/ssl-redirect': 'false',
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [
          {
            host: `flagd.${process.env.INGRESS_HOST || 'localtest.me'}`,
            http: {
              paths: [{
                path: '/',
                pathType: 'Prefix',
                backend: {
                  service: {
                    name: service.metadata.name!,
                    port: {
                      number: 80,
                    },
                  },
                },
              }],
            },
          },
        ],
      },
    });

    // Create ConfigMap for Grafana dashboard
    new k8s.KubeConfigMap(this, 'flagd-grafana-dashboard', {
      metadata: {
        name: 'flagd-grafana-dashboard',
        namespace: 'monitoring',
        labels: {
          grafana_dashboard: '1',
        },
      },
      data: {
        'flagd-dashboard.json': JSON.stringify({
          "annotations": {
            "list": [
              {
                "builtIn": 1,
                "datasource": {
                  "type": "grafana",
                  "uid": "-- Grafana --"
                },
                "enable": true,
                "hide": true,
                "iconColor": "rgba(0, 211, 255, 1)",
                "name": "Annotations & Alerts",
                "type": "dashboard"
              }
            ]
          },
          "editable": true,
          "fiscalYearStartMonth": 0,
          "graphTooltip": 0,
          "id": null,
          "links": [],
          "liveNow": false,
          "panels": [
            {
              "datasource": {
                "type": "prometheus",
                "uid": "${datasource}"
              },
              "fieldConfig": {
                "defaults": {
                  "color": {
                    "mode": "palette-classic"
                  },
                  "custom": {
                    "axisCenteredZero": false,
                    "axisColorMode": "text",
                    "axisLabel": "",
                    "axisPlacement": "auto",
                    "barAlignment": 0,
                    "drawStyle": "line",
                    "fillOpacity": 0,
                    "gradientMode": "none",
                    "hideFrom": {
                      "tooltip": false,
                      "viz": false,
                      "legend": false
                    },
                    "insertNulls": false,
                    "lineInterpolation": "linear",
                    "lineWidth": 1,
                    "pointSize": 5,
                    "scaleDistribution": {
                      "type": "linear"
                    },
                    "showPoints": "auto",
                    "spanNulls": false,
                    "stacking": {
                      "group": "A",
                      "mode": "none"
                    },
                    "thresholdsStyle": {
                      "mode": "off"
                    }
                  },
                  "mappings": [],
                  "thresholds": {
                    "mode": "absolute",
                    "steps": [
                      {
                        "color": "green",
                        "value": null
                      },
                      {
                        "color": "red",
                        "value": 80
                      }
                    ]
                  },
                  "unit": "short"
                },
                "overrides": []
              },
              "gridPos": {
                "h": 8,
                "w": 12,
                "x": 0,
                "y": 0
              },
              "id": 1,
              "options": {
                "legend": {
                  "calcs": [],
                  "displayMode": "list",
                  "placement": "bottom",
                  "showLegend": true
                },
                "tooltip": {
                  "mode": "single",
                  "sort": "none"
                }
              },
              "targets": [
                {
                  "datasource": {
                    "type": "prometheus",
                    "uid": "${datasource}"
                  },
                  "editorMode": "code",
                  "expr": "rate(flagd_evaluations_total[5m])",
                  "refId": "A"
                }
              ],
              "title": "Flag Evaluations Rate",
              "type": "timeseries"
            },
            {
              "datasource": {
                "type": "prometheus",
                "uid": "${datasource}"
              },
              "fieldConfig": {
                "defaults": {
                  "mappings": [],
                  "thresholds": {
                    "mode": "percentage",
                    "steps": [
                      {
                        "color": "green",
                        "value": null
                      }
                    ]
                  },
                  "unit": "short"
                },
                "overrides": []
              },
              "gridPos": {
                "h": 8,
                "w": 12,
                "x": 12,
                "y": 0
              },
              "id": 2,
              "options": {
                "orientation": "auto",
                "reduceOptions": {
                  "values": false,
                  "calcs": ["lastNotNull"],
                  "fields": ""
                },
                "showThresholdLabels": false,
                "showThresholdMarkers": true
              },
              "pluginVersion": "10.0.0",
              "targets": [
                {
                  "datasource": {
                    "type": "prometheus",
                    "uid": "${datasource}"
                  },
                  "editorMode": "code",
                  "expr": "sum(rate(flagd_evaluations_total[5m]))",
                  "refId": "A"
                }
              ],
              "title": "Total Evaluations Rate",
              "type": "gauge"
            }
          ],
          "refresh": "10s",
          "schemaVersion": 38,
          "style": "dark",
          "tags": ["flagd", "feature-flags"],
          "templating": {
            "list": [
              {
                "current": {
                  "selected": false,
                  "text": "Prometheus",
                  "value": "prometheus"
                },
                "hide": 0,
                "includeAll": false,
                "multi": false,
                "name": "datasource",
                "options": [],
                "query": "prometheus",
                "queryValue": "",
                "refresh": 1,
                "regex": "",
                "skipUrlSync": false,
                "type": "datasource"
              }
            ]
          },
          "time": {
            "from": "now-1h",
            "to": "now"
          },
          "timepicker": {},
          "timezone": "",
          "title": "Flagd Feature Flags",
          "uid": "flagd-dashboard",
          "version": 0,
          "weekStart": ""
        }, null, 2),
      },
    });
  }
}