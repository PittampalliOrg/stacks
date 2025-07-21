import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Chart for deploying Grafana dashboards for kgateway monitoring
 */
export class KGatewayGrafanaDashboardsChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    const namespace = 'monitoring';

    // Envoy dashboard JSON (simplified version focusing on key metrics)
    const envoyDashboard = {
      "annotations": {
        "list": [
          {
            "builtIn": 1,
            "datasource": {
              "type": "datasource",
              "uid": "grafana"
            },
            "enable": true,
            "hide": true,
            "iconColor": "rgba(0, 211, 255, 1)",
            "name": "Annotations & Alerts",
            "target": {
              "limit": 100,
              "matchAny": false,
              "tags": [],
              "type": "dashboard"
            },
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
                "mode": "thresholds"
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
              "unit": "reqps"
            },
            "overrides": []
          },
          "gridPos": {
            "h": 8,
            "w": 12,
            "x": 0,
            "y": 0
          },
          "id": 2,
          "options": {
            "orientation": "auto",
            "reduceOptions": {
              "calcs": [
                "lastNotNull"
              ],
              "fields": "",
              "values": false
            },
            "showThresholdLabels": false,
            "showThresholdMarkers": true
          },
          "pluginVersion": "9.5.2",
          "targets": [
            {
              "datasource": {
                "type": "prometheus",
                "uid": "${datasource}"
              },
              "editorMode": "code",
              "expr": "sum(rate(envoy_cluster_upstream_rq_total{gateway_name=\"$gateway\"}[5m]))",
              "legendFormat": "Total RPS",
              "range": true,
              "refId": "A"
            }
          ],
          "title": "Total Request Rate",
          "type": "gauge"
        },
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
                "fillOpacity": 10,
                "gradientMode": "none",
                "hideFrom": {
                  "tooltip": false,
                  "viz": false,
                  "legend": false
                },
                "lineInterpolation": "linear",
                "lineWidth": 1,
                "pointSize": 5,
                "scaleDistribution": {
                  "type": "linear"
                },
                "showPoints": "never",
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
              "unit": "percentunit"
            },
            "overrides": []
          },
          "gridPos": {
            "h": 8,
            "w": 12,
            "x": 12,
            "y": 0
          },
          "id": 3,
          "options": {
            "tooltip": {
              "mode": "single",
              "sort": "none"
            },
            "legend": {
              "calcs": [],
              "displayMode": "list",
              "placement": "bottom",
              "showLegend": true
            }
          },
          "targets": [
            {
              "datasource": {
                "type": "prometheus",
                "uid": "${datasource}"
              },
              "editorMode": "code",
              "expr": "sum(rate(envoy_cluster_upstream_rq_xx{gateway_name=\"$gateway\",envoy_response_code=~\"2..\"}[5m])) / sum(rate(envoy_cluster_upstream_rq_xx{gateway_name=\"$gateway\"}[5m]))",
              "legendFormat": "Success Rate",
              "range": true,
              "refId": "A"
            }
          ],
          "title": "Success Rate",
          "type": "timeseries"
        },
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
                "fillOpacity": 10,
                "gradientMode": "none",
                "hideFrom": {
                  "tooltip": false,
                  "viz": false,
                  "legend": false
                },
                "lineInterpolation": "linear",
                "lineWidth": 1,
                "pointSize": 5,
                "scaleDistribution": {
                  "type": "linear"
                },
                "showPoints": "never",
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
              "unit": "ms"
            },
            "overrides": []
          },
          "gridPos": {
            "h": 8,
            "w": 12,
            "x": 0,
            "y": 8
          },
          "id": 4,
          "options": {
            "tooltip": {
              "mode": "single",
              "sort": "none"
            },
            "legend": {
              "calcs": [],
              "displayMode": "list",
              "placement": "bottom",
              "showLegend": true
            }
          },
          "targets": [
            {
              "datasource": {
                "type": "prometheus",
                "uid": "${datasource}"
              },
              "editorMode": "code",
              "expr": "histogram_quantile(0.5, sum(rate(envoy_cluster_upstream_rq_time_bucket{gateway_name=\"$gateway\"}[5m])) by (le))",
              "legendFormat": "p50",
              "range": true,
              "refId": "A"
            },
            {
              "datasource": {
                "type": "prometheus",
                "uid": "${datasource}"
              },
              "editorMode": "code",
              "expr": "histogram_quantile(0.95, sum(rate(envoy_cluster_upstream_rq_time_bucket{gateway_name=\"$gateway\"}[5m])) by (le))",
              "legendFormat": "p95",
              "range": true,
              "refId": "B"
            },
            {
              "datasource": {
                "type": "prometheus",
                "uid": "${datasource}"
              },
              "editorMode": "code",
              "expr": "histogram_quantile(0.99, sum(rate(envoy_cluster_upstream_rq_time_bucket{gateway_name=\"$gateway\"}[5m])) by (le))",
              "legendFormat": "p99",
              "range": true,
              "refId": "C"
            }
          ],
          "title": "Request Latency",
          "type": "timeseries"
        },
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
                "fillOpacity": 10,
                "gradientMode": "none",
                "hideFrom": {
                  "tooltip": false,
                  "viz": false,
                  "legend": false
                },
                "lineInterpolation": "linear",
                "lineWidth": 1,
                "pointSize": 5,
                "scaleDistribution": {
                  "type": "linear"
                },
                "showPoints": "never",
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
            "x": 12,
            "y": 8
          },
          "id": 5,
          "options": {
            "tooltip": {
              "mode": "single",
              "sort": "none"
            },
            "legend": {
              "calcs": [],
              "displayMode": "list",
              "placement": "bottom",
              "showLegend": true
            }
          },
          "targets": [
            {
              "datasource": {
                "type": "prometheus",
                "uid": "${datasource}"
              },
              "editorMode": "code",
              "expr": "sum(envoy_server_total_connections{gateway_name=\"$gateway\"})",
              "legendFormat": "Total Connections",
              "range": true,
              "refId": "A"
            },
            {
              "datasource": {
                "type": "prometheus",
                "uid": "${datasource}"
              },
              "editorMode": "code",
              "expr": "sum(envoy_server_live_connections{gateway_name=\"$gateway\"})",
              "legendFormat": "Live Connections",
              "range": true,
              "refId": "B"
            }
          ],
          "title": "Connections",
          "type": "timeseries"
        }
      ],
      "refresh": "10s",
      "schemaVersion": 38,
      "style": "dark",
      "tags": ["kgateway", "envoy"],
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
            "label": "Data Source",
            "multi": false,
            "name": "datasource",
            "options": [],
            "query": "prometheus",
            "queryValue": "",
            "refresh": 1,
            "regex": "",
            "skipUrlSync": false,
            "type": "datasource"
          },
          {
            "current": {
              "selected": false,
              "text": "mcp-gateway",
              "value": "mcp-gateway"
            },
            "datasource": {
              "type": "prometheus",
              "uid": "${datasource}"
            },
            "definition": "label_values(envoy_server_uptime, gateway_name)",
            "hide": 0,
            "includeAll": false,
            "label": "Gateway",
            "multi": false,
            "name": "gateway",
            "options": [],
            "query": {
              "query": "label_values(envoy_server_uptime, gateway_name)",
              "refId": "PrometheusVariableQueryEditor-VariableQuery"
            },
            "refresh": 1,
            "regex": "",
            "skipUrlSync": false,
            "sort": 0,
            "type": "query"
          }
        ]
      },
      "time": {
        "from": "now-6h",
        "to": "now"
      },
      "timepicker": {},
      "timezone": "",
      "title": "KGateway Envoy Metrics",
      "uid": "kgateway-envoy",
      "version": 1,
      "weekStart": ""
    };

    // Create ConfigMap with Envoy dashboard
    new k8s.KubeConfigMap(this, 'envoy-dashboard', {
      metadata: {
        name: 'kgateway-envoy-dashboard',
        namespace: namespace,
        labels: {
          'grafana_dashboard': '1', // This label tells Grafana to import this dashboard
          'app.kubernetes.io/name': 'grafana',
          'app.kubernetes.io/component': 'dashboard',
        },
      },
      data: {
        'kgateway-envoy.json': JSON.stringify(envoyDashboard, null, 2),
      },
    });

    // Create kgateway-specific dashboard
    const kgatewayDashboard = {
      "annotations": {
        "list": [
          {
            "builtIn": 1,
            "datasource": {
              "type": "datasource",
              "uid": "grafana"
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
                "mode": "thresholds"
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
                    "value": 0
                  }
                ]
              },
              "unit": "short"
            },
            "overrides": []
          },
          "gridPos": {
            "h": 8,
            "w": 6,
            "x": 0,
            "y": 0
          },
          "id": 1,
          "options": {
            "colorMode": "value",
            "graphMode": "none",
            "justifyMode": "auto",
            "orientation": "auto",
            "reduceOptions": {
              "calcs": [
                "lastNotNull"
              ],
              "fields": "",
              "values": false
            },
            "text": {},
            "textMode": "auto"
          },
          "pluginVersion": "9.5.2",
          "targets": [
            {
              "datasource": {
                "type": "prometheus",
                "uid": "${datasource}"
              },
              "editorMode": "code",
              "expr": "up{job=\"kgateway_control_plane\"}",
              "legendFormat": "Control Plane Status",
              "range": true,
              "refId": "A"
            }
          ],
          "title": "Control Plane Status",
          "type": "stat"
        },
        {
          "datasource": {
            "type": "prometheus",
            "uid": "${datasource}"
          },
          "fieldConfig": {
            "defaults": {
              "color": {
                "mode": "thresholds"
              },
              "mappings": [],
              "thresholds": {
                "mode": "absolute",
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
            "w": 6,
            "x": 6,
            "y": 0
          },
          "id": 2,
          "options": {
            "colorMode": "value",
            "graphMode": "none",
            "justifyMode": "auto",
            "orientation": "auto",
            "reduceOptions": {
              "calcs": [
                "lastNotNull"
              ],
              "fields": "",
              "values": false
            },
            "text": {},
            "textMode": "auto"
          },
          "pluginVersion": "9.5.2",
          "targets": [
            {
              "datasource": {
                "type": "prometheus",
                "uid": "${datasource}"
              },
              "editorMode": "code",
              "expr": "count(up{job=\"kgateway_data_plane\"})",
              "legendFormat": "Active Gateways",
              "range": true,
              "refId": "A"
            }
          ],
          "title": "Active Gateway Proxies",
          "type": "stat"
        },
        {
          "datasource": {
            "type": "prometheus",
            "uid": "${datasource}"
          },
          "fieldConfig": {
            "defaults": {
              "color": {
                "mode": "thresholds"
              },
              "mappings": [],
              "thresholds": {
                "mode": "absolute",
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
            "w": 6,
            "x": 12,
            "y": 0
          },
          "id": 3,
          "options": {
            "colorMode": "value",
            "graphMode": "none",
            "justifyMode": "auto",
            "orientation": "auto",
            "reduceOptions": {
              "calcs": [
                "lastNotNull"
              ],
              "fields": "",
              "values": false
            },
            "text": {},
            "textMode": "auto"
          },
          "pluginVersion": "9.5.2",
          "targets": [
            {
              "datasource": {
                "type": "prometheus",
                "uid": "${datasource}"
              },
              "editorMode": "code",
              "expr": "count(up{job=\"mcp_gateway\"})",
              "legendFormat": "MCP Gateways",
              "range": true,
              "refId": "A"
            }
          ],
          "title": "Active MCP Gateways",
          "type": "stat"
        }
      ],
      "refresh": "10s",
      "schemaVersion": 38,
      "style": "dark",
      "tags": ["kgateway", "control-plane"],
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
            "label": "Data Source",
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
        "from": "now-6h",
        "to": "now"
      },
      "timepicker": {},
      "timezone": "",
      "title": "KGateway Control Plane",
      "uid": "kgateway-control-plane",
      "version": 1,
      "weekStart": ""
    };

    // Create ConfigMap with kgateway dashboard
    new k8s.KubeConfigMap(this, 'kgateway-dashboard', {
      metadata: {
        name: 'kgateway-control-plane-dashboard',
        namespace: namespace,
        labels: {
          'grafana_dashboard': '1',
          'app.kubernetes.io/name': 'grafana',
          'app.kubernetes.io/component': 'dashboard',
        },
      },
      data: {
        'kgateway-control-plane.json': JSON.stringify(kgatewayDashboard, null, 2),
      },
    });
  }
}